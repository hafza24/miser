// Free AI provider fallback: Groq -> OpenRouter -> Gemini (OpenAI-compat).
// All three expose OpenAI-compatible /chat/completions endpoints supporting tools.

export type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string };
export type ChatTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ChatTool[];
  tool_choice?: unknown;
}

export interface ChatResult {
  content: string | null;
  toolArguments: string | null;
  provider: string;
  model: string;
}

interface Provider {
  name: string;
  key: string | undefined;
  url: string;
  model: string;
}

function providers(): Provider[] {
  return [
    {
      name: 'groq',
      key: Deno.env.get('GROQ_API_KEY'),
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.3-70b-versatile',
    },
    {
      name: 'openrouter',
      key: Deno.env.get('OPENROUTER_API_KEY'),
      url: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
    },
    {
      name: 'gemini',
      key: Deno.env.get('GEMINI_API_KEY') ?? 'AIzaSyAzxA5MEZKkIjr4s3DbTJVeu3fVuFoREho',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: 'gemini-2.0-flash',
    },
  ];
}

export class FreeAiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function callFreeAI(opts: ChatOptions): Promise<ChatResult> {
  const list = providers().filter((p) => !!p.key);
  if (list.length === 0) {
    throw new FreeAiError('No free AI provider configured (set GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY).', 500);
  }

  const errors: string[] = [];
  let lastStatus = 500;

  for (const p of list) {
    try {
      const body: Record<string, unknown> = {
        model: p.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.8,
      };
      if (opts.max_tokens) body.max_tokens = opts.max_tokens;
      if (opts.tools) body.tools = opts.tools;
      if (opts.tool_choice) body.tool_choice = opts.tool_choice;

      const resp = await fetch(p.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${p.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        lastStatus = resp.status;
        const t = await resp.text();
        console.error(`[free-ai] ${p.name} ${resp.status}:`, t.slice(0, 500));
        errors.push(`${p.name}:${resp.status}`);
        // 401/402/429 -> try next provider
        continue;
      }

      const data = await resp.json();
      const choice = data?.choices?.[0]?.message;
      const content: string | null = choice?.content ?? null;
      const toolArguments: string | null =
        choice?.tool_calls?.[0]?.function?.arguments ?? null;

      if (!content && !toolArguments) {
        errors.push(`${p.name}:empty`);
        continue;
      }

      return { content, toolArguments, provider: p.name, model: p.model };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[free-ai] ${p.name} threw:`, msg);
      errors.push(`${p.name}:err`);
    }
  }

  throw new FreeAiError(`All free AI providers failed: ${errors.join(', ')}`, lastStatus);
}
