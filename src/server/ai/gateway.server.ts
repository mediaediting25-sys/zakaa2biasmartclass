// Provider-neutral AI adapter. Modules depend only on AiProvider, never a vendor SDK.
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const CHAT_MODEL = "openai/gpt-6-astra";
export const EMBED_MODEL = "google/gemini-embedding-2";

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type AiProvider = {
  name: string;
  model: string;
  generateJson<T>(input: {
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
    effort?: "low" | "medium" | "high";
    /** Optional PDF attachments (base64, no data: prefix). */
    files?: { filename: string; base64: string }[];
  }): Promise<T>;
};

function key() {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new AiError("AI is not configured", 401);
  return k;
}

function headers() {
  const k = key();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${k}`,
    "Lovable-API-Key": k,
    "X-Lovable-AIG-SDK": "fetch",
  };
}

async function failure(res: Response): Promise<never> {
  let msg = `AI request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string } | string; message?: string };
    msg =
      (typeof body.error === "string" ? body.error : body.error?.message) ?? body.message ?? msg;
  } catch {
    /* ignore */
  }
  if (res.status === 402) msg = "رصيد الذكاء الاصطناعي انتهى — AI credits exhausted. " + msg;
  if (res.status === 429) msg = "ضغط كبير على الخدمة، حاول بعد قليل — Rate limited. " + msg;
  throw new AiError(msg, res.status);
}

function stripFences(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
}

export const lovableProvider: AiProvider = {
  name: "lovable",
  model: CHAT_MODEL,
  async generateJson<T>({
    system,
    user,
    schemaName,
    schema,
    effort = "medium",
    files,
  }: Parameters<AiProvider["generateJson"]>[0]): Promise<T> {
    const res = await fetch(`${GATEWAY}/responses`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: CHAT_MODEL,
        instructions: system,
        input: [
          {
            role: "user",
            content: files?.length
              ? [
                  ...files.map((f) => ({
                    type: "input_file",
                    filename: f.filename,
                    file_data: `data:application/pdf;base64,${f.base64}`,
                  })),
                  { type: "input_text", text: user },
                ]
              : user,
          },
        ],
        reasoning: { effort },
        store: false,
        stream: true,
        text: { format: { type: "json_schema", name: schemaName, schema, strict: true } },
      }),
    });
    if (!res.ok || !res.body) await failure(res);
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    let refusal = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload) as { type: string; delta?: string; response?: { error?: { message?: string } } };
          if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
          else if (ev.type === "response.refusal.delta" && ev.delta) refusal += ev.delta;
          else if (ev.type === "response.failed" || ev.type === "error")
            throw new AiError(ev.response?.error?.message ?? "AI generation failed", 502);
        } catch (e) {
          if (e instanceof AiError) throw e;
        }
      }
    }
    if (!out && refusal) throw new AiError("AI refused: " + refusal, 422);
    if (!out) throw new AiError("AI returned empty output", 502);
    return JSON.parse(stripFences(out)) as T;
  },
};

export function getProvider(): AiProvider {
  return lovableProvider;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let s = 0; s < texts.length; s += 64) {
    const batch = texts.slice(s, s + 64);
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) await failure(res);
    const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...body.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}
