import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (!cronSecret || provided !== cronSecret) {
    if (req.method !== 'OPTIONS') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }
if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find profiles scheduled for deletion that have passed the 24-hour window
    const { data: toDelete, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .not('scheduled_deletion_at', 'is', null)
      .lte('scheduled_deletion_at', new Date().toISOString());

    if (fetchError) throw fetchError;

    let deleted = 0;
    for (const profile of toDelete || []) {
      // Delete the auth user (cascade will handle profile & related data)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id);
      if (!error) deleted++;
    }

    return new Response(JSON.stringify({ deleted, checked: toDelete?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
