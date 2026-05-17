import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (!cronSecret || provided !== cronSecret) {
    if (req.method !== 'OPTIONS') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }
if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find payments older than 3 months with screenshot URLs
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: oldPayments, error: fetchError } = await supabase
      .from("payments")
      .select("id, proof_url")
      .not("proof_url", "is", null)
      .lt("created_at", threeMonthsAgo.toISOString());

    if (fetchError) throw fetchError;

    let deleted = 0;
    for (const payment of oldPayments || []) {
      if (!payment.proof_url || payment.proof_url.startsWith("http")) continue;

      // Delete from storage
      const { error: delError } = await supabase.storage
        .from("payment-screenshots")
        .remove([payment.proof_url]);

      if (!delError) {
        // Clear the proof_url
        await supabase
          .from("payments")
          .update({ proof_url: null })
          .eq("id", payment.id);
        deleted++;
      }
    }

    // Also clean payment_requests screenshots
    const { data: oldRequests } = await supabase
      .from("payment_requests")
      .select("id, screenshot_url")
      .not("screenshot_url", "is", null)
      .lt("created_at", threeMonthsAgo.toISOString());

    for (const req of oldRequests || []) {
      if (!req.screenshot_url || req.screenshot_url.startsWith("http")) continue;
      const { error: delError } = await supabase.storage
        .from("payment-screenshots")
        .remove([req.screenshot_url]);
      if (!delError) {
        await supabase
          .from("payment_requests")
          .update({ screenshot_url: null })
          .eq("id", req.id);
        deleted++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, deleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
