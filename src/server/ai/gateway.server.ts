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

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3; // first attempt plus at most two retries
const REQUEST_BUDGET_MS = 240_000; // hosting may impose a shorter limit
const ATTEMPT_TIMEOUT_MS = 90_000;
const MAX_INLINE_BASE64 = 8_000_000; // about 6 MB of binary, across ALL attachments
const MAX_JSON_BYTES = 12_000_000;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function retryDelay(res: Response | undefined, attempt: number): number {
  const raw = res?.headers.get("Retry-After");
  let wait = 0;
  if (raw) {
    const seconds = Number(raw);
    wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(raw) - Date.now();
  }
  // Honor Retry-After as a minimum, never shorten a server-requested wait.
  return Math.max(Number.isFinite(wait) ? wait : 0, 2000 * 2 ** attempt) + Math.floor(Math.random() * 500);
}

async function quotaInfo(res: Response): Promise<{ permanent: boolean; waitMs: number }> {
  if (res.status !== 429) return { permanent: false, waitMs: 0 };
  try {
    const error = (await res.json() as { error?: { message?: string; details?: unknown[] } }).error;
    const details = error?.details ?? [];
    // Used only to classify provider errors. Never log/return the raw body.
    const diagnostic = JSON.stringify({ message: error?.message, details });
    const permanent = /per.?day|daily|billing|limit:\s*0|quotaValue["\s:]+0/i.test(diagnostic);
    let waitMs = 0;
    for (const item of details) {
      if (item && typeof item === "object" && "retryDelay" in item) {
        const delay = (item as { retryDelay?: unknown }).retryDelay;
        if (typeof delay === "string" && /^\d+(?:\.\d+)?s$/.test(delay)) waitMs = Math.max(waitMs, parseFloat(delay) * 1000);
      }
    }
    return { permanent, waitMs };
  } catch { return { permanent: false, waitMs: 0 }; }
}

async function request<T>(model: string, action: string, body: unknown): Promise<T> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new AiError("مفتاح Gemini غير مضبوط على الخادم", 503);
  const payload = JSON.stringify(body);
  if (new TextEncoder().encode(payload).byteLength > MAX_JSON_BYTES) {
    throw new AiError("حجم الطلب كبير للإرسال المباشر. قسم الملف أو قلل حجم الصفحات", 413);
  }
  const deadline = Date.now() + REQUEST_BUDGET_MS;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let res: Response | undefined;
    let status = 504;
    let mayRetry = true;
    let providerWait = 0;
    try {
      res = await fetch(`${API}/${encodeURIComponent(model)}:${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: payload,
        signal: AbortSignal.timeout(Math.max(1, Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now()))),
      });
      status = res.status;
      if (res.ok) {
        try { return await res.json() as T; }
        catch { throw new AiError("وصل رد غير صالح أو غير مكتمل من Gemini. لم تتم إعادة الطلب تلقائيًا", 502); }
      }
      mayRetry = RETRYABLE.has(status);
      if (status === 429) {
        const quota = await quotaInfo(res);
        mayRetry = !quota.permanent;
        providerWait = quota.waitMs;
      } else {
        try { await res.body?.cancel(); } catch { /* response cleanup only */ }
      }
    } catch (error) {
      if (error instanceof AiError) throw error;
      // Network/timeout failures can be transient. Google may have received the earlier request.
      status = 504;
    }
    const delay = Math.max(providerWait, retryDelay(res, attempt));
    const canRetry = mayRetry && attempt + 1 < MAX_ATTEMPTS && Date.now() + delay + 5000 < deadline;
    console.warn("Gemini request status", { model, action, status, attempt: attempt + 1, retrying: canRetry });
    if (canRetry) { await sleep(delay); continue; }
    const messages: Record<number, string> = {
      400: "رفض Gemini صيغة الطلب. راجع النموذج والمخطط وحجم الملف في إعدادات الخادم",
      401: "مفتاح Gemini غير صالح. راجع إعدادات الخادم",
      403: "Gemini رفض الوصول. راجع المفتاح وصلاحيات المشروع وتوفر الخدمة",
      404: "نموذج Gemini المطلوب غير متاح لهذا المشروع",
      413: "الملف أو الطلب كبير جدًا. قسم الملف أو قلل حجم الصفحات",
      429: "حصة Google أو معدل الطلبات غير متاح الآن. راجع الحصة والفوترة أو انتظر المدة المطلوبة",
      503: "خدمة Gemini مشغولة مؤقتًا. انتهت المحاولات المتاحة؛ انتظر قليلًا قبل إعادة المحاولة",
      504: "تعذر الاتصال بـ Gemini أو انتهت المهلة بعد المحاولات المتاحة. تحقق من حالة المهمة قبل المحاولة مجددًا",
    };
    throw new AiError(messages[status] ?? `تعذر إكمال طلب Gemini (${status}) بعد المحاولات المتاحة`, status);
  }
  throw new AiError("تعذر إكمال طلب Gemini", 503);
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
    const totalBase64 = (files ?? []).reduce((sum, file) => sum + file.base64.length, 0);
    if (totalBase64 > MAX_INLINE_BASE64) throw new AiError("ملف OCR كبير للإرسال المباشر. قسمه إلى صفحات أصغر أو اضغط الصور", 413);
    for (const file of files ?? []) {
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
  for (let start = 0; start < texts.length; start += 16) {
    const batch = texts.slice(start, start + 16);
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
