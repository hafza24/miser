import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type Mode = 'light' | 'dark';
type SceneType = 'friendly' | 'romantic' | 'cute' | 'intimate' | 'hot' | 'intense';

const TONES: Record<Mode, Record<string, string>> = {
  light: {
    friendly: 'warm, playful, wholesome and emotionally safe',
    romantic: 'tender, affectionate, poetic and sweet',
    cute: 'adorable, fluffy, gentle and heartwarming',
  },
  dark: {
    intimate: 'close, sensual, magnetic and emotionally deep',
    hot: 'passionate, fiery, bold and seductive',
    intense: 'raw, electric, high-stakes and psychologically charged',
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, sceneType, mode, otherUserId, chatId, isContinuation } = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3 || prompt.trim().length > 200) {
      return new Response(JSON.stringify({ error: 'Prompt must be between 3 and 200 characters.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedMode: Mode = mode === 'dark' ? 'dark' : 'light';
    const normalizedType = String(sceneType).toLowerCase() as SceneType;
    const validTypes = normalizedMode === 'light'
      ? ['friendly', 'romantic', 'cute']
      : ['intimate', 'hot', 'intense'];

    if (!validTypes.includes(normalizedType)) {
      return new Response(JSON.stringify({ error: 'Invalid scene type for mode.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify participants
    const { data: participants, error: participantsError } = await adminClient
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', chatId)
      .in('user_id', [user.id, otherUserId]);

    if (participantsError || !participants || participants.length !== 2) {
      return new Response(JSON.stringify({ error: 'You can only generate scenes for active chat participants.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get profiles
    const { data: profiles, error: profileError } = await adminClient
      .from('profiles')
      .select('user_id, alias, character_title, character_description, character_personality, character_life_story, interests, mood_preference')
      .in('user_id', [user.id, otherUserId]);

    if (profileError || !profiles || profiles.length < 2) {
      return new Response(JSON.stringify({ error: 'Could not load profiles for scene generation.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const me = profiles.find((p) => p.user_id === user.id);
    const other = profiles.find((p) => p.user_id === otherUserId);

    if (!me || !other) {
      return new Response(JSON.stringify({ error: 'Missing profile data.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch previous scenes from chat for continuation context
    let previousScenes: string[] = [];
    if (isContinuation) {
      const { data: sceneMessages } = await adminClient
        .from('messages')
        .select('content, sender_id, created_at')
        .eq('chat_id', chatId)
        .like('content', '📖 Scene%')
        .order('created_at', { ascending: true })
        .limit(10);

      if (sceneMessages && sceneMessages.length > 0) {
        previousScenes = sceneMessages.map((m) => {
          const who = m.sender_id === user.id ? me.alias : other.alias;
          // Strip the "📖 Scene\n\n" prefix
          const text = m.content.replace(/^📖 Scene\n\n/, '');
          return `[By ${who}]:\n${text}`;
        });
      }
    }

    const tone = TONES[normalizedMode][normalizedType];

    const continuationContext = previousScenes.length > 0
      ? `\n\nPREVIOUS SCENES IN THIS STORYLINE (continue from where the last scene left off — advance the plot, don't repeat):\n---\n${previousScenes.join('\n---\n')}\n---`
      : '';

    const continuationInstruction = isContinuation
      ? `\nThis is a CONTINUATION. The requesting user is "${me.alias}". Focus the next scene part on their character taking the lead / responding, while naturally continuing from the previous scene's events. Advance the narrative forward.`
      : '';

    const systemPrompt = `You are a creative scene writer for two anonymous chat users.
Write only one immersive third-person scene, 140-260 words.
Tone: ${tone}.
Scene type: ${normalizedType}.
${normalizedMode === 'light' ? 'Keep it wholesome, safe, and non-explicit.' : 'Keep it mature and emotionally intense, but no illegal/non-consensual content.'}
Avoid cliches. Use concrete sensory details and emotional subtext.
Return only the final scene text, no title, no bullet points.${continuationInstruction}`;

    const userPrompt = `
User prompt: ${prompt.trim()}

Profile A (${me.alias}):
- title: ${me.character_title ?? 'none'}
- description: ${me.character_description ?? 'none'}
- personality: ${(me.character_personality ?? []).join(', ') || 'none'}
- life story: ${me.character_life_story ?? 'none'}
- interests: ${(me.interests ?? []).join(', ') || 'none'}
- mood: ${me.mood_preference ?? 'none'}

Profile B (${other.alias}):
- title: ${other.character_title ?? 'none'}
- description: ${other.character_description ?? 'none'}
- personality: ${(other.character_personality ?? []).join(', ') || 'none'}
- life story: ${other.character_life_story ?? 'none'}
- interests: ${(other.interests ?? []).join(', ') || 'none'}
- mood: ${other.mood_preference ?? 'none'}
${continuationContext}`;

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI service is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits are required to generate scenes.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('AI gateway error:', aiResponse.status, text);
      return new Response(JSON.stringify({ error: 'Failed to generate scene.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const scene = aiData?.choices?.[0]?.message?.content?.trim();

    if (!scene) {
      return new Response(JSON.stringify({ error: 'The AI returned an empty scene.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ scene }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
