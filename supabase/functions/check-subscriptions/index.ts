import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

Deno.serve(async (req) => {
    const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (!cronSecret || provided !== cronSecret) {
    if (req.method !== 'OPTIONS') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Expire subscriptions past their expiry date
  const { data: expired, error: expErr } = await supabase
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expiry_date", new Date().toISOString())
    .select("user_id, plan_id");

  if (expErr) {
    console.error("Error expiring subscriptions:", expErr);
    return new Response(JSON.stringify({ error: expErr.message }), { status: 500 });
  }

  // 2. For expired subs with dark_mode_access, re-block dark mode
  if (expired && expired.length > 0) {
    const planIds = [...new Set(expired.map((s: any) => s.plan_id))];
    const { data: plans } = await supabase
      .from("subscription_plans")
      .select("id, dark_mode_access")
      .in("id", planIds);

    const darkPlans = new Set((plans || []).filter((p: any) => p.dark_mode_access).map((p: any) => p.id));

    for (const sub of expired) {
      if (darkPlans.has(sub.plan_id)) {
        // Check if user has another active sub with dark mode
        const { data: otherSubs } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", sub.user_id)
          .eq("status", "active")
          .gt("expiry_date", new Date().toISOString())
          .limit(1);

        if (!otherSubs || otherSubs.length === 0) {
          await supabase
            .from("profiles")
            .update({ dark_mode_blocked: true, payment_status: "expired" })
            .eq("user_id", sub.user_id);
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      expired_count: expired?.length || 0,
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
