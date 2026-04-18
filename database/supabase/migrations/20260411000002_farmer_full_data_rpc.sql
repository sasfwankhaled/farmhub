-- ================================================================
-- RPC شاملة تجلب كل بيانات المزرعة - نسخة مصححة
-- تتجاوز RLS وترجع الأسماء الحقيقية مع معالجة أنواع البيانات بدقة
-- ================================================================
CREATE OR REPLACE FUNCTION public.fetch_farm_full_data(p_farm_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_farm_uuid UUID;
    v_farm_name TEXT;
    v_farmer_ids TEXT[];
    v_result JSON;
BEGIN
    -- تحويل المعرف بشكل آمن
    BEGIN
        v_farm_uuid := p_farm_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN JSON_BUILD_OBJECT('error', 'Invalid farm ID');
    END;

    -- جلب اسم المزرعة (SECURITY DEFINER يتجاوز RLS)
    SELECT name, farmer_ids
    INTO v_farm_name, v_farmer_ids
    FROM public.farms
    WHERE id = v_farm_uuid;

    IF v_farm_name IS NULL THEN
        RETURN JSON_BUILD_OBJECT('error', 'Farm not found');
    END IF;

    IF v_farmer_ids IS NULL OR array_length(v_farmer_ids, 1) IS NULL THEN
        v_farmer_ids := ARRAY[]::TEXT[];
    END IF;

    -- بناء النتيجة الكاملة
    SELECT JSON_BUILD_OBJECT(
        'farm_id', v_farm_uuid::TEXT,
        'farm_name', v_farm_name,
        'farmer_ids', v_farmer_ids,

        -- الشحنات مع الأسماء الحقيقية من الجداول الأصلية
        'shipments', COALESCE((
            SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', s.id::TEXT,
                    'shipmentNumber', s.shipment_number,
                    'farmerId', s.farmer_id,
                    'cropId', s.crop_id,
                    'cropName', COALESCE(s.crop_name, c.name, 'محصول غير محدد'),
                    'merchantId', s.merchant_id,
                    'merchantName', COALESCE(s.merchant_name, e.name, 'تاجر غير محدد'),
                    'packagesCount', s.packages_count,
                    'packagesCountA', s.packages_count_a,
                    'packagesCountB', s.packages_count_b,
                    'grade', s.grade,
                    'weightKg', s.weight_kg,
                    'date', s.date,
                    'day', s.day,
                    'status', s.status,
                    'totalSaleAmount', s.total_sale_amount,
                    'farmerNetAmount', s.farmer_net_amount,
                    'merchantCommissionAmount', s.merchant_commission_amount,
                    'boxRentalTotal', s.box_rental_total,
                    'farmId', s.farm_id,
                    'receiptImageUrl', s.receipt_image_url,
                    'notes', s.notes
                ) ORDER BY s.date DESC
            )
            FROM public.shipments s
            LEFT JOIN public.crops c ON c.id = s.crop_id::UUID
            LEFT JOIN public.entities e ON e.id = s.merchant_id::UUID
            WHERE s.farmer_id = ANY(v_farmer_ids)
        ), '[]'::JSON),

        -- المصاريف
        'farm_expenses', COALESCE((
            SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', fe.id::TEXT,
                    'type', fe.type,
                    'quantity', fe.quantity,
                    'cost', fe.cost,
                    'total', fe.total,
                    'date', fe.date,
                    'day', fe.day,
                    'notes', fe.notes,
                    'farmId', fe.farm_id::TEXT,
                    'farmerId', fe.farmer_id
                ) ORDER BY fe.date DESC
            )
            FROM public.farm_expenses fe
            WHERE fe.farm_id = v_farm_uuid OR fe.farmer_id = ANY(v_farmer_ids)
        ), '[]'::JSON),

        -- الدوام مع أسماء العمال الحقيقية
        'attendance', COALESCE((
            SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', a.id::TEXT,
                    'workerId', a.worker_id,
                    'workerName', COALESCE(a.worker_name, ent.name, 'عامل غير محدد'),
                    'hourlyRate', a.hourly_rate,
                    'farmId', a.farm_id::TEXT,
                    'farmerId', a.farmer_id,
                    'date', a.date,
                    'day', a.day,
                    'startTime', a.start_time,
                    'endTime', a.end_time,
                    'totalHours', a.total_hours,
                    'totalCost', a.total_cost
                ) ORDER BY a.date DESC
            )
            FROM public.attendance a
            LEFT JOIN public.entities ent ON ent.id::TEXT = a.worker_id
            WHERE a.farm_id = v_farm_uuid OR a.farmer_id = ANY(v_farmer_ids)
        ), '[]'::JSON),

        -- دفعات العمال مع أسماء العمال الحقيقية
        'worker_payments', COALESCE((
            SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', wp.id::TEXT,
                    'workerId', wp.worker_id,
                    'workerName', COALESCE(wp.worker_name, ent2.name, 'عامل غير محدد'),
                    'amount', wp.amount,
                    'date', wp.date,
                    'day', wp.day,
                    'notes', wp.notes,
                    'farmId', wp.farm_id::TEXT,
                    'farmerId', wp.farmer_id
                ) ORDER BY wp.date DESC
            )
            FROM public.worker_payments wp
            LEFT JOIN public.entities ent2 ON ent2.id::TEXT = wp.worker_id
            WHERE wp.farm_id = v_farm_uuid OR wp.farmer_id = ANY(v_farmer_ids)
        ), '[]'::JSON),

        -- قائمة العمال المرتبطين بالمزرعة
        'workers', COALESCE((
            SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                    'id', ent3.id::TEXT,
                    'name', ent3.name,
                    'type', ent3.type,
                    'hourlyRate', ent3.hourly_rate
                )
            )
            FROM public.entities ent3
            WHERE ent3.type = 'worker'
              AND ent3.id::TEXT IN (
                SELECT DISTINCT a2.worker_id FROM public.attendance a2
                WHERE a2.farmer_id = ANY(v_farmer_ids) OR a2.farm_id = v_farm_uuid
                UNION
                SELECT DISTINCT wp2.worker_id FROM public.worker_payments wp2
                WHERE wp2.farmer_id = ANY(v_farmer_ids) OR wp2.farm_id = v_farm_uuid
              )
        ), '[]'::JSON),

        -- الإحصائيات المالية الإجمالية
        'analytics', (
            WITH ss AS (
                SELECT
                    COALESCE(SUM(total_sale_amount), 0) AS total_sales,
                    COALESCE(SUM(farmer_net_amount), 0) AS total_farmer_net,
                    COALESCE(SUM(merchant_commission_amount), 0) AS total_commission,
                    COALESCE(SUM(box_rental_total), 0) AS total_transport,
                    COALESCE(SUM(CASE WHEN status IN ('collected','farmer_delivered','archived') THEN total_sale_amount ELSE 0 END), 0) AS collected_sales,
                    COALESCE(SUM(CASE WHEN status IN ('collected','farmer_delivered','archived') THEN farmer_net_amount ELSE 0 END), 0) AS collected_farmer_net,
                    COALESCE(SUM(packages_count), 0) AS total_production
                FROM public.shipments
                WHERE farmer_id = ANY(v_farmer_ids)
            ),
            es AS (
                SELECT
                    COALESCE(SUM(CASE WHEN type='water' THEN total ELSE 0 END), 0) AS water,
                    COALESCE(SUM(CASE WHEN type='boxes' THEN total ELSE 0 END), 0) AS boxes,
                    COALESCE(SUM(CASE WHEN type='supplies' THEN total ELSE 0 END), 0) AS supplies,
                    COALESCE(SUM(total), 0) AS total_expenses
                FROM public.farm_expenses
                WHERE farm_id = v_farm_uuid OR farmer_id = ANY(v_farmer_ids)
            ),
            ws AS (
                SELECT COALESCE(SUM(total_cost), 0) AS attendance_cost
                FROM public.attendance
                WHERE farm_id = v_farm_uuid OR farmer_id = ANY(v_farmer_ids)
            ),
            ps AS (
                SELECT COALESCE(SUM(amount), 0) AS payments
                FROM public.worker_payments
                WHERE farm_id = v_farm_uuid OR farmer_id = ANY(v_farmer_ids)
            )
            SELECT JSON_BUILD_OBJECT(
                'totalSales', ss.total_sales,
                'totalFarmerNet', ss.total_farmer_net,
                'collectedSales', ss.collected_sales,
                'collectedFarmerNet', ss.collected_farmer_net,
                'pendingSales', ss.total_sales - ss.collected_sales,
                'pendingFarmerNet', ss.total_farmer_net - ss.collected_farmer_net,
                'totalCommission', ss.total_commission,
                'totalTransport', ss.total_transport,
                'totalProduction', ss.total_production,
                'waterExpenses', es.water,
                'boxesExpenses', es.boxes,
                'suppliesExpenses', es.supplies,
                'attendanceCost', ws.attendance_cost,
                'workerPayments', ps.payments,
                'totalExpenses', es.total_expenses + ws.attendance_cost,
                'netProfit', ss.total_sales - (es.total_expenses + ws.attendance_cost),
                'farmerNetProfit', ss.total_farmer_net - (es.total_expenses + ws.attendance_cost)
            )
            FROM ss, es, ws, ps
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
