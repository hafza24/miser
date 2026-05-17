import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find expired chats where timer has not been stopped
    const { data: expiredChats, error: fetchError } = await supabase
      .from("chats")
      .select("id")
      .eq("timer_stopped", false)
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredChats || expiredChats.length === 0) {
      return new Response(
        JSON.stringify({ deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatIds = expiredChats.map((c) => c.id);

    // Delete messages, participants, timer_stop_requests, then chats
    await supabase.from("messages").delete().in("chat_id", chatIds);
    await supabase.from("timer_stop_requests").delete().in("chat_id", chatIds);
    await supabase.from("chat_participants").delete().in("chat_id", chatIds);
    await supabase.from("chats").delete().in("id", chatIds);

    return new Response(
      JSON.stringify({ deleted: chatIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
