// OCR for scanned PDF pages: split image-only pages into small PDFs and let the AI read them.
import { PDFDocument } from "pdf-lib";

import { AiError, getProvider } from "./gateway.server";

const BATCH = 4; // pages per AI request
const CONCURRENCY = 3;
const MAX_OCR_PAGES = 200;

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

/** Fills `text` for pages with (almost) no text layer. Mutates and returns `pages`. */
export async function ocrScannedPages(bytes: Uint8Array, pages: { page: number; text: string }[]) {
  const targets = pages.filter((p) => p.text.replace(/\s/g, "").length < 20).slice(0, MAX_OCR_PAGES);
  if (!targets.length) return pages;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const batches: (typeof targets)[] = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));
  const provider = getProvider();

  async function run(batch: typeof targets) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, batch.map((p) => p.page - 1));
    copied.forEach((pg) => out.addPage(pg));
    const b64 = toBase64(await out.save());
    const res = await provider.generateJson<{ pages: { index: number; text: string }[] }>({
      system:
        "You are a precise OCR engine. Transcribe ALL visible text on each page exactly as written (keep Arabic as Arabic, keep numbers, headings, exercises and tables as plain text lines). Do not summarize, translate, correct or invent anything. If a page has no text, return an empty string.",
      user: `The attached PDF has ${batch.length} page(s). Return one entry per page with index 1..${batch.length} in order.`,
      schemaName: "ocr_pages",
      schema: SCHEMA,
      effort: "low",
      files: [{ filename: `pages-${batch[0]!.page}.pdf`, base64: b64 }],
    });
    for (const r of res.pages) {
      const target = batch[r.index - 1];
      if (target && r.text?.trim()) target.text = r.text;
    }
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      while (next < batches.length) {
        const b = batches[next++]!;
        try {
          await run(b);
        } catch (e) {
          console.error("OCR batch failed", b[0]!.page, e);
          if (e instanceof AiError || (e instanceof Error && /402|credits|429/.test(e.message))) throw e;
        }
      }
    }),
  );
  return pages;
}
