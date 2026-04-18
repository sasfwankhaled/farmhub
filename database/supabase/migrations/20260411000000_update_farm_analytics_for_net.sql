-- إعداد الوظيفة البرمجية لتجاوز كافة قيود RLS وجلب البيانات بدقة فورية
CREATE OR REPLACE FUNCTION public.fetch_farm_analytics(f_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_report JSON;
    v_farmer_ids TEXT[];
    v_farm_name TEXT;
    v_farm_uuid UUID;
BEGIN
    -- تحويل المعرف لـ UUID بشكل آمن
    v_farm_uuid := f_id::UUID;

    -- جلب اسم المزرعة ومعرفات المزارعين (بصلاحيات Security Definer)
    SELECT name, farmer_ids INTO v_farm_name, v_farmer_ids
    FROM farms WHERE id = v_farm_uuid;

    -- إذا لم يتم العثور على مزرعة، نرجع كائن فارغ مع الاسم المتوقع
    IF v_farm_name IS NULL THEN
        RETURN JSON_BUILD_OBJECT('error', 'Farm not found');
    END IF;

    -- إعداد الإحصائيات المالية والإنتاجية
    WITH shipment_stats AS (
        SELECT 
            COALESCE(SUM(total_sale_amount), 0) as total_sales,
            COALESCE(SUM(farmer_net_amount), 0) as total_farmer_net,
            COALESCE(SUM(merchant_commission_amount), 0) as total_commission,
            COALESCE(SUM(box_rental_total), 0) as total_transport,
            COALESCE(SUM(CASE WHEN status IN ('collected', 'farmer_delivered', 'archived') THEN total_sale_amount ELSE 0 END), 0) as collected_sales,
            COALESCE(SUM(CASE WHEN status IN ('collected', 'farmer_delivered', 'archived') THEN farmer_net_amount ELSE 0 END), 0) as collected_farmer_net,
            COALESCE(SUM(packages_count), 0) as total_production
        FROM public.shipments
        WHERE public.shipments.farmer_id = ANY(v_farmer_ids)
    ),
    expense_stats AS (
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'water' THEN total ELSE 0 END), 0) as water_expenses,
            COALESCE(SUM(CASE WHEN type = 'boxes' THEN total ELSE 0 END), 0) as boxes_expenses,
            COALESCE(SUM(CASE WHEN type = 'supplies' THEN total ELSE 0 END), 0) as supplies_expenses,
            COALESCE(SUM(total), 0) as total_farm_expenses
        FROM public.farm_expenses
        WHERE farm_id = v_farm_uuid OR farmer_id = ANY(v_farmer_ids)
    ),
    worker_stats AS (
        SELECT COALESCE(SUM(total_cost), 0) as total_attendance_cost FROM public.attendance WHERE farm_id = v_farm_uuid OR farmer_id = ANY(v_farmer_ids)
    ),
    payment_stats AS (
        SELECT COALESCE(SUM(amount), 0) as total_worker_payments FROM public.worker_payments WHERE farm_id = v_farm_uuid OR farmer_id = ANY(v_farmer_ids)
    ),
    -- جلب تقرير المحاصيل من جدول الشحنات مباشرة لضمان عدم تأثره بـ RLS لجدول الـ crops
    crop_stats AS (
        SELECT 
            s.crop_id,
            COALESCE(MAX(s.crop_name), (SELECT name FROM public.crops WHERE id::text = s.crop_id::text LIMIT 1), 'محصول غير مسمى') as name,
            COUNT(s.id) as trips_count,
            COALESCE(SUM(s.packages_count), 0) as production_quantity,
            COALESCE(SUM(s.total_sale_amount), 0) as sales,
            COALESCE(SUM(s.farmer_net_amount), 0) as farmer_net,
            COALESCE(SUM(CASE WHEN s.status IN ('collected', 'farmer_delivered', 'archived') THEN s.total_sale_amount ELSE 0 END), 0) as collected,
            COALESCE(SUM(CASE WHEN s.status IN ('collected', 'farmer_delivered', 'archived') THEN s.farmer_net_amount ELSE 0 END), 0) as collected_net,
            COALESCE(AVG(CASE WHEN s.total_sale_amount > 0 AND s.packages_count > 0 THEN s.total_sale_amount / s.packages_count ELSE NULL END), 0) as avg_price,
            COALESCE(AVG(CASE WHEN s.farmer_net_amount > 0 AND s.packages_count > 0 THEN s.farmer_net_amount / s.packages_count ELSE NULL END), 0) as avg_net_price
        FROM public.shipments s
        WHERE s.farmer_id = ANY(v_farmer_ids)
        GROUP BY s.crop_id
    )
    SELECT JSON_BUILD_OBJECT(
        'farm_name', v_farm_name,
        'total_sales', s.total_sales,
        'total_farmer_net', s.total_farmer_net,
        'collected_sales', s.collected_sales,
        'collected_farmer_net', s.collected_farmer_net,
        'total_commission', s.total_commission,
        'total_transport', s.total_transport,
        'pending_sales', s.total_sales - s.collected_sales,
        'pending_farmer_net', s.total_farmer_net - s.collected_farmer_net,
        'total_production', s.total_production,
        'water_expenses', e.water_expenses,
        'boxes_expenses', e.boxes_expenses,
        'supplies_expenses', e.supplies_expenses,
        'total_attendance_cost', w.total_attendance_cost,
        'total_worker_payments', p.total_worker_payments,
        'total_expenses', e.total_farm_expenses + w.total_attendance_cost,
        'net_profit', s.total_sales - (e.total_farm_expenses + w.total_attendance_cost),
        'farmer_net_profit', s.total_farmer_net - (e.total_farm_expenses + w.total_attendance_cost),
        'crop_report', COALESCE((SELECT JSON_AGG(JSON_BUILD_OBJECT(
            'id', cs.crop_id, 'name', cs.name, 'tripsCount', cs.trips_count, 'productionQuantity', cs.production_quantity,
            'sales', cs.sales, 'farmerNet', cs.farmer_net, 'collected', cs.collected, 'collectedNet', cs.collected_net, 
            'pending', cs.sales - cs.collected, 'pendingNet', cs.farmer_net - cs.collected_net,
            'averagePricePerUnit', cs.avg_price, 'averageNetPricePerUnit', cs.avg_net_price
        )) FROM crop_stats cs), '[]'::json)
    ) INTO v_report
    FROM shipment_stats s, expense_stats e, worker_stats w, payment_stats p;

    RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تحديث فوري لكافة البيانات القديمة لضمان ظهور الأسماء
UPDATE public.shipments s
SET 
  crop_name = (SELECT name FROM public.crops WHERE id::text = s.crop_id::text LIMIT 1),
  merchant_name = (SELECT name FROM public.entities WHERE id::text = s.merchant_id::text LIMIT 1)
WHERE crop_name IS NULL OR merchant_name IS NULL;
