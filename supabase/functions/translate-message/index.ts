import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check global toggle
    const { data: enabledRow } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "translation_enabled")
      .maybeSingle();
    if (enabledRow && enabledRow.value === false) {
      return json({ error: "Translation disabled" }, 403);
    }

    const { data: modelRow } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "translation_model")
      .maybeSingle();
    const model =
      (typeof modelRow?.value === "string" ? modelRow.value : null) ||
      "google/gemini-3-flash-preview";

    const body = await req.json();
    const { message_id, target_language, text } = body ?? {};
    if (!target_language || typeof target_language !== "string") {
      return json({ error: "target_language required" }, 400);
    }

    let sourceText: string | null = text ?? null;

    // Verify access & cache check via message_id
    if (message_id) {
      const { data: msg, error: mErr } = await userClient
        .from("messages")
        .select("id, chat_id, content")
        .eq("id", message_id)
        .maybeSingle();
      if (mErr || !msg) return json({ error: "Message not found or not allowed" }, 404);
      sourceText = msg.content;

      const { data: cached } = await admin
        .from("message_translations")
        .select("translated_text, detected_language, status")
        .eq("message_id", message_id)
        .eq("target_language", target_language)
        .maybeSingle();
      if (cached) {
        return json({
          translated_text: cached.translated_text,
          detected_language: cached.detected_language,
          status: cached.status,
          cached: true,
        });
      }
    }

    if (!sourceText || !sourceText.trim()) {
      return json({ error: "No text" }, 400);
    }

    const systemPrompt = `You are an expert translator and linguist.
TASK: Translate the user's message into the target language code: "${target_language}".

Rules:
- Detect the source language accurately, including Roman Urdu (Urdu written in English letters, e.g., "ap kaisi ho"), Hinglish (Roman Hindi), Arabic transliteration, slang, and informal SMS-style text.
- Correct spelling/typo errors silently before translating.
- Produce a NATURAL, idiomatic translation that preserves tone, emotion, emojis, names, and technical terms. Do NOT translate literally.
- Preserve emoji order and any URLs/code/usernames verbatim.
- If the source language is ALREADY the target language, return the (possibly lightly cleaned) original text and set was_already_target=true.
- detected_language must be a short BCP-47-ish code: en, ur, hi, ar, es, fr, de, ru, zh, ja, ko, pt, tr, id, bn, fa, it, nl, etc. For Roman Urdu use "ur"; for Hinglish use "hi".
Return ONLY via the provided tool.`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sourceText },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_translation",
                description: "Return the translation result.",
                parameters: {
                  type: "object",
                  properties: {
                    detected_language: { type: "string" },
                    translated_text: { type: "string" },
                    was_already_target: { type: "boolean" },
                  },
                  required: [
                    "detected_language",
                    "translated_text",
                    "was_already_target",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_translation" },
          },
        }),
      },
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429)
        return json({ error: "Rate limit, try again shortly" }, 429);
      if (aiResp.status === 402)
        return json({ error: "AI credits exhausted" }, 402);
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return json({ error: "Translation failed" }, 500);
    }

    const aiData = await aiResp.json();
    const toolCall =
      aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!toolCall) {
      console.error("No tool call:", JSON.stringify(aiData));
      return json({ error: "Translation failed" }, 500);
    }
    const parsed = JSON.parse(toolCall);
    const translated_text: string = parsed.translated_text ?? sourceText;
    const detected_language: string = parsed.detected_language ?? "unknown";

    if (message_id) {
      await admin.from("message_translations").upsert(
        {
          message_id,
          target_language,
          translated_text,
          detected_language,
          status: "success",
        },
        { onConflict: "message_id,target_language" },
      );
    }

    return json({
      translated_text,
      detected_language,
      was_already_target: !!parsed.was_already_target,
      status: "success",
      cached: false,
    });
  } catch (e) {
    console.error("translate-message error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
