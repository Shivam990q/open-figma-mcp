/**
 * APCA and WCAG contrast audit engine
 */

function srgbToLinear(c) {
  const norm = Math.max(0, Math.min(1, c));
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r, g, b) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function wcagContrast(fg, bg) {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function apcaContrast(fg, bg) {
  const yFg = 0.2126729 * srgbToLinear(fg.r) + 0.7151522 * srgbToLinear(fg.g) + 0.0721750 * srgbToLinear(fg.b);
  const yBg = 0.2126729 * srgbToLinear(bg.r) + 0.7151522 * srgbToLinear(bg.g) + 0.0721750 * srgbToLinear(bg.b);

  const blkThresh = 0.022;
  const blkClamp = 1.414;

  const yFgClamped = yFg > blkThresh ? yFg : yFg + Math.pow(blkThresh - yFg, blkClamp);
  const yBgClamped = yBg > blkThresh ? yBg : yBg + Math.pow(blkThresh - yBg, blkClamp);

  let lc;
  if (yBgClamped >= yFgClamped) {
    lc = (Math.pow(yBgClamped, 0.56) - Math.pow(yFgClamped, 0.62)) * 1.14;
  } else {
    lc = (Math.pow(yBgClamped, 0.65) - Math.pow(yFgClamped, 0.55)) * 1.14;
  }

  const scaled = Math.abs(lc) < 0.1 ? 0 : lc > 0 ? (lc - 0.027) * 100 : (lc + 0.027) * 100;
  return Number(scaled.toFixed(1));
}

export function auditColors(fg, bg) {
  const ratio = wcagContrast(fg, bg);
  const lc = apcaContrast(fg, bg);

  let apcaRating = 'FAIL';
  const absLc = Math.abs(lc);
  if (absLc >= 75) apcaRating = 'PREFERRED_BODY';
  else if (absLc >= 60) apcaRating = 'MINIMUM_CONTENT';
  else if (absLc >= 45) apcaRating = 'LARGE_DISPLAY_ONLY';

  return {
    wcagRatio: ratio,
    wcagAaPass: ratio >= 4.5,
    wcagAaaPass: ratio >= 7.0,
    apcaLc: lc,
    apcaRating,
  };
}
