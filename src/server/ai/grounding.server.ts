// Grounding utilities: normalization, chunking, and quote verification.
export function normalize(s: string) {
  return s
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // tashkeel + tatweel
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim();
}

/** Returns 0..1: share of quote tokens found in order-insensitive window of the page. */
export function quoteSupport(quote: string | null | undefined, pageText: string | undefined) {
  if (!quote || !pageText) return 0;
  const q = normalize(quote);
  const p = normalize(pageText);
  if (!q) return 0;
  if (p.includes(q)) return 1;
  const tokens = q.split(" ").filter((t) => t.length > 1);
  if (!tokens.length) return 0;
  const pageTokens = new Set(p.split(" "));
  const hit = tokens.filter((t) => pageTokens.has(t)).length;
  return hit / tokens.length;
}

/** Find the best supporting page for a quote, tolerating a wrong page number from the model. */
export function locateQuote(quote: string, pages: Map<number, string>, claimed?: number | null) {
  const claimedScore = claimed != null ? quoteSupport(quote, pages.get(claimed)) : 0;
  if (claimedScore >= 0.85) return { page: claimed!, score: claimedScore };
  let best = { page: claimed ?? 0, score: claimedScore };
  for (const [n, text] of pages) {
    const sc = quoteSupport(quote, text);
    if (sc > best.score) best = { page: n, score: sc };
  }
  return best;
}

export function chunkPages(pages: { page: number; text: string }[], size = 1200, overlap = 150) {
  const chunks: { page: number; index: number; content: string }[] = [];
  for (const { page, text } of pages) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    let idx = 0;
    for (let s = 0; s < clean.length; s += size - overlap) {
      chunks.push({ page, index: idx++, content: clean.slice(s, s + size) });
      if (s + size >= clean.length) break;
    }
  }
  return chunks;
}
