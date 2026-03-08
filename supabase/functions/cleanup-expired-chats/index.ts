import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    const chatIds = (expiredChats || []).map((c) => c.id);

    // Delete stale chat requests older than 24 hours
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: requestsError } = await supabase
      .from("chat_requests")
      .delete()
      .lt("created_at", staleThreshold);

    if (requestsError) throw requestsError;

    if (chatIds.length > 0) {
      // Delete messages, participants, timer_stop_requests, then chats
      await supabase.from("messages").delete().in("chat_id", chatIds);
      await supabase.from("timer_stop_requests").delete().in("chat_id", chatIds);
      await supabase.from("chat_participants").delete().in("chat_id", chatIds);
      await supabase.from("chats").delete().in("id", chatIds);
    }

    return new Response(
      JSON.stringify({ deletedChats: chatIds.length, cleanedRequests: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
