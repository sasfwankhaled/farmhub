// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_ADMIN_EMAILS = ['saafwanrawashdeh@gmail.com'];

const parseAdminEmails = () => {
  const raw = Deno.env.get('ADMIN_EMAILS') || '';
  const values = raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return new Set(values.length > 0 ? values : DEFAULT_ADMIN_EMAILS);
};

const ADMIN_EMAILS = parseAdminEmails();

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !serviceRole) {
      return json(500, { error: 'edge-function-env-missing' });
    }

    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.replace('Bearer ', '').trim();
    if (!jwt) {
      return json(401, { error: 'missing-jwt' });
    }

    const authClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authUserRes, error: authErr } = await authClient.auth.getUser();
    if (authErr || !authUserRes.user?.email) {
      return json(401, { error: 'invalid-jwt' });
    }
    const callerEmail = authUserRes.user.email.toLowerCase();
    if (!ADMIN_EMAILS.has(callerEmail)) {
      return json(403, { error: 'forbidden' });
    }

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    if (body?.action !== 'ensure_farmer_user') {
      return json(400, { error: 'unsupported-action' });
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '').trim();
    if (!email || !password || password.length < 6) {
      return json(400, { error: 'invalid-email-or-password' });
    }

    let page = 1;
    const perPage = 200;
    let foundUserId: string | null = null;
    for (;;) {
      const { data: listed, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) {
        return json(500, { error: `list-users-failed:${listError.message}` });
      }
      const users = listed?.users || [];
      const found = users.find((u) => (u.email || '').toLowerCase() === email);
      if (found) {
        foundUserId = found.id;
        break;
      }
      if (users.length < perPage) break;
      page += 1;
    }

    if (foundUserId) {
      const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(foundUserId, {
        password,
      });
      if (updateError) {
        return json(500, { error: `update-user-failed:${updateError.message}` });
      }
      return json(200, { userId: updated.user.id, email });
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'farmer' },
    });
    if (createError || !created.user) {
      return json(500, { error: `create-user-failed:${createError?.message || 'unknown'}` });
    }

    return json(200, { userId: created.user.id, email });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : String(error) });
  }
});
