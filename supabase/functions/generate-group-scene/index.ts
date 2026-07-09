import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callFreeAI, FreeAiError } from '../_shared/free-ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { request_id } = await req.json();
    if (!request_id || typeof request_id !== 'string') {
      return new Response(JSON.stringify({ error: 'request_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: gr, error: grErr } = await adminClient
      .from('group_requests')
      .select('*')
      .eq('id', request_id)
      .single();
    if (grErr || !gr) {
      return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (gr.creator_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not allowed' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }




    const gr_req = gr.gender_requirements ?? {};
    const composition = `${gr_req.men || 0} men, ${gr_req.women || 0} women, ${gr_req.any || 0} any`;
    const isDark = gr.mode === 'dark';

    const systemPrompt = `You write immersive group chat scenes for an anonymous social app.
Return ONLY a JSON tool call with: title (max 60 chars), description (80-160 words, evocative, second-person plural "you all"), icebreakers (4 short open-ended questions), mood_tags (3-5 single-word tags).
Topic: ${gr.topic}. Group size: ${gr.member_limit}. Composition: ${composition}. Type: ${gr.type}.
Tone: ${isDark ? 'mature, sensual, emotionally charged — adults only, no illegal/non-consensual content' : 'warm, wholesome, emotionally safe, inclusive'}.
Avoid cliches. Use sensory detail.`;

    let args: string | null = null;
    try {
      const result = await callFreeAI({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a scene for a ${gr.type} group about "${gr.topic}".` },
        ],
        temperature: 0.9,
        tools: [{
          type: 'function',
          function: {
            name: 'set_scene',
            description: 'Provide the group scene',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                icebreakers: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
                mood_tags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6 },
              },
              required: ['title', 'description', 'icebreakers', 'mood_tags'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'set_scene' } },
      });
      args = result.toolArguments;
      // Fallback: some providers return JSON in content instead of tool call
      if (!args && result.content) {
        const m = result.content.match(/\{[\s\S]*\}/);
        if (m) args = m[0];
      }
    } catch (e) {
      const err = e as FreeAiError;
      return new Response(JSON.stringify({ error: err.message || 'AI failed' }), {
        status: err.status || 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!args) {
      return new Response(JSON.stringify({ error: 'No scene returned' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const scene = JSON.parse(args);

    const { error: updErr } = await adminClient
      .from('group_requests')
      .update({
        ai_scene_title: scene.title,
        ai_scene_description: scene.description,
        ai_icebreakers: scene.icebreakers ?? [],
        mood_tags: scene.mood_tags ?? [],
      })
      .eq('id', request_id);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ scene }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
