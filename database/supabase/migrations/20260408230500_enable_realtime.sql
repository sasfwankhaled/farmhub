-- Enable Realtime for all FarmHub tables so the UI updates instantly
begin;

alter publication supabase_realtime add table 
  entities, 
  crops, 
  farms, 
  farmer_accounts, 
  settings, 
  global_prices, 
  trips, 
  farm_expenses, 
  vehicle_expenses, 
  attendance, 
  worker_payments;

commit;
