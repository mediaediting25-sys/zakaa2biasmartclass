// Server-only Gemini adapter. Never import this file from browser code.
export const CHAT_MODEL = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
export const EMBED_MODEL = "gemini-embedding-2";
const IMAGE_MODEL = "gemini-3.1-flash-image";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

export class AiError extends Error {
  constructor(message: string, public status: number) { super(message); }
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
    files?: { filename: string; base64: string }[];
  }): Promise<T>;
};

type Part = {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
};
type Generated = {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: Part[] } }[];
};

async function request<T>(model: string, action: string, body: unknown): Promise<T> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new AiError("مفتاح Gemini غير مضبوط على الخادم", 503);
  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(model)}:${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new AiError("تعذر الاتصال بـ Gemini أو انتهت مهلة الطلب. راجع حالة المهمة قبل إعادة المحاولة", 504);
  }
  if (!res.ok) {
    // Never return the provider's raw response, prompts, or credentials to clients.
    const messages: Record<number, string> = {
      400: "رفض Gemini صيغة الطلب. راجع النموذج والمخطط وحجم الملف في إعدادات الخادم",
      401: "مفتاح Gemini غير صالح. راجع إعدادات الخادم",
      403: "Gemini رفض الوصول. راجع المفتاح وصلاحيات المشروع وتوفر الخدمة",
      404: "نموذج Gemini المطلوب غير متاح لهذا المشروع",
      429: "تم تجاوز حصة أو معدل استخدام Google. راجع الفوترة والحصة وانتظر قبل المحاولة",
    };
    throw new AiError(messages[res.status] ?? `تعذر إكمال طلب Gemini (${res.status})`, res.status);
  }
  try { return await res.json() as T; }
  catch { throw new AiError("وصل رد غير صالح من Gemini", 502); }
}

function parts(body: Generated): Part[] {
  const candidate = body.candidates?.[0];
  if (body.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== "STOP")) {
    throw new AiError(candidate?.finishReason === "MAX_TOKENS"
      ? "توقف التوليد لأن المحتوى طويل. قلل حجم الدفعة"
      : "لم يكتمل التوليد أو رفض Gemini هذا المحتوى", 422);
  }
  return (candidate?.content?.parts ?? []).filter(p => !p.thought);
}

export const geminiProvider: AiProvider = {
  name: "gemini",
  model: CHAT_MODEL,
  async generateJson<T>({ system, user, schema, files }: Parameters<AiProvider["generateJson"]>[0]): Promise<T> {
    // schemaName and effort are retained for caller compatibility. Google uses its default thinking policy.
    const input: Part[] = [];
    for (const file of files ?? []) {
      // Leave room for base64 overhead and the rest of the request; larger PDFs need the Files API.
      if (file.base64.length > 20_000_000) throw new AiError("ملف OCR كبير جدًا للإرسال المباشر. قسّمه إلى ملفات أصغر", 413);
      input.push({ inlineData: { mimeType: "application/pdf", data: file.base64 } });
    }
    input.push({ text: user });
    const body = await request<Generated>(CHAT_MODEL, "generateContent", {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: input }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, maxOutputTokens: 32768 },
    });
    const text = parts(body).map(p => p.text ?? "").join("").trim();
    if (!text) throw new AiError("لم يُرجع Gemini محتوى", 502);
    try { return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim()) as T; }
    catch { throw new AiError("أرجع Gemini JSON غير صالح. لم يتم اعتماد المحتوى", 502); }
  },
};

export function getProvider(): AiProvider { return geminiProvider; }

export async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let start = 0; start < texts.length; start += 32) {
    const batch = texts.slice(start, start + 32);
    const body = await request<{ embeddings?: { values?: number[] }[] }>(EMBED_MODEL, "batchEmbedContents", {
      requests: batch.map(text => ({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] }, outputDimensionality: 3072 })),
    });
    if (body.embeddings?.length !== batch.length) throw new AiError("رد الفهرسة غير مكتمل", 502);
    for (const embedding of body.embeddings) {
      const values = embedding.values;
      if (!values || values.length !== 3072 || values.some(v => !Number.isFinite(v))) throw new AiError("أبعاد الفهرسة غير صالحة", 502);
      out.push(values);
    }
  }
  return out;
}

export async function generateQuestionImage(prompt: string): Promise<{ base64: string; mimeType: string }> {
  const body = await request<Generated>(IMAGE_MODEL, "generateContent", {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });
  const image = parts(body).find(p => p.inlineData?.mimeType.startsWith("image/"))?.inlineData;
  if (!image?.data || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)) throw new AiError("لم يرجع Gemini صورة صالحة", 502);
  return { base64: image.data, mimeType: image.mimeType };
}
