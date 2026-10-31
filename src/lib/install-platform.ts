export function installPlatform(userAgent: string, maxTouchPoints: number) {
  const ios = /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const mobile = ios || /android|mobile/i.test(userAgent);
  const embedded = /FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(userAgent);
  return { ios, mobile, embedded };
}