// OCR for scanned PDF pages. Small sequential requests reduce burst rate and payload size.
import { PDFDocument } from "pdf-lib";
import { AiError, getProvider } from "./gateway.server";

const BATCH = 2;
const MAX_OCR_PAGES = 200;
const MAX_PDF_BYTES = 5_500_000; // below the adapter's combined inline limit

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pages"],
  properties: {
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "text"],
        properties: { index: { type: "integer" }, text: { type: "string" } },
      },
    },
  },
};

/** Fills text for pages with almost no text layer. Never silently skips unprocessed pages. */
export async function ocrScannedPages(bytes: Uint8Array, pages: { page: number; text: string }[]) {
  const targets = pages.filter(p => p.text.replace(/\s/g, "").length < 20);
  if (!targets.length) return pages;
  if (targets.length > MAX_OCR_PAGES) throw new AiError("الملف يحتاج قراءة أكثر من 200 صفحة مصورة. قسمه إلى ملفات أصغر", 413);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const provider = getProvider();

  async function run(batch: typeof targets): Promise<void> {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, batch.map(p => p.page - 1));
    copied.forEach(pg => out.addPage(pg));
    const pdf = await out.save();
    if (pdf.byteLength > MAX_PDF_BYTES) {
      if (batch.length > 1) {
        const middle = Math.ceil(batch.length / 2);
        await run(batch.slice(0, middle));
        await run(batch.slice(middle));
        return;
      }
      throw new AiError(`الصفحة ${batch[0]!.page} كبيرة جدًا للقراءة المباشرة. اضغط صور هذه الصفحة ثم ارفع الملف مجددًا`, 413);
    }
    let res: { pages: { index: number; text: string }[] };
    try {
      res = await provider.generateJson<{ pages: { index: number; text: string }[] }>({
        system: "You are a precise OCR engine. Transcribe ALL visible text on each page exactly as written (keep Arabic as Arabic, keep numbers, headings, exercises and tables as plain text lines). Do not summarize, translate, correct or invent anything. If a page has no text, return an empty string.",
        user: `The attached PDF has ${batch.length} page(s). Return one entry per page with index 1..${batch.length} in order.`,
        schemaName: "ocr_pages",
        schema: SCHEMA,
        effort: "low",
        files: [{ filename: `pages-${batch[0]!.page}.pdf`, base64: toBase64(pdf) }],
      });
    } catch (error) {
      // A payload rejection can be reduced. Do not multiply 429/503 retries by splitting.
      if (error instanceof AiError && error.status === 413 && batch.length > 1) {
        for (const page of batch) await run([page]);
        return;
      }
      throw error;
    }
    if (!Array.isArray(res.pages) || res.pages.length !== batch.length) throw new AiError("رد قراءة الصفحات غير مكتمل. لم يتم اعتماد الملف", 502);
    const seen = new Set<number>();
    for (const page of res.pages) {
      if (!Number.isInteger(page.index) || page.index < 1 || page.index > batch.length || seen.has(page.index) || typeof page.text !== "string") {
        throw new AiError("ترقيم أو محتوى صفحات OCR غير صالح. لم يتم اعتماد الملف", 502);
      }
      seen.add(page.index);
    }
    for (const page of res.pages) batch[page.index - 1]!.text = page.text;
  }

  for (let index = 0; index < targets.length; index += BATCH) {
    const batch = targets.slice(index, index + BATCH);
    console.info("OCR batch", { firstPage: batch[0]!.page, pageCount: batch.length, totalOcrPages: targets.length });
    await run(batch);
  }
  return pages;
}
