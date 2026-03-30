function toHalfWidth(str: string): string {
  return str.replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
}

function katakanaToHiragana(str: string): string {
  return str.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

export function normalizeJaText(input: string): string {
  return katakanaToHiragana(
    toHalfWidth(input)
      .normalize("NFKC")
      .replace(/[‐‑‒–—―ｰ]/g, "ー")
      .replace(/[()（）［］\[\]【】「」『』]/g, "")
      .replace(/[@＠]/g, "")
      .replace(/[・･:：,，.。!！?？\s]/g, "")
      .replace(/\\/g, "")
      .replace(/Ⅰ/g, "I")
      .replace(/Ⅱ/g, "II")
      .replace(/♀/g, "メス")
      .replace(/♂/g, "オス")
  );
}

export function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

export function findBestJaMatch(
  input: string,
  candidates: string[],
  options?: { maxDistance?: number }
): string | null {
  const normalizedInput = normalizeJaText(input);
  if (!normalizedInput) return null;

  const normalizedCandidates = candidates.map((candidate) => ({
    candidate,
    normalized: normalizeJaText(candidate),
  }));

  const exact = normalizedCandidates.find((entry) => entry.normalized === normalizedInput);
  if (exact) return exact.candidate;

  const contains = normalizedCandidates.find(
    (entry) =>
      entry.normalized.includes(normalizedInput) ||
      normalizedInput.includes(entry.normalized)
  );
  if (contains) return contains.candidate;

  let best: { candidate: string; distance: number } | null = null;
  const maxDistance = options?.maxDistance ?? (normalizedInput.length >= 6 ? 2 : 1);
  for (const entry of normalizedCandidates) {
    const distance = levenshtein(normalizedInput, entry.normalized);
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { candidate: entry.candidate, distance };
    }
  }

  return best?.candidate ?? null;
}

export function getJaMatchCandidates(
  input: string,
  candidates: string[],
  options?: { maxDistance?: number; limit?: number }
): string[] {
  const normalizedInput = normalizeJaText(input);
  if (!normalizedInput) return [];

  const limit = options?.limit ?? 3;
  const maxDistance = options?.maxDistance ?? (normalizedInput.length >= 6 ? 2 : 1);

  const scored = candidates.map((candidate) => {
    const normalized = normalizeJaText(candidate);
    const exact = normalized === normalizedInput;
    const contains = normalized.includes(normalizedInput) || normalizedInput.includes(normalized);
    const distance = levenshtein(normalizedInput, normalized);
    return {
      candidate,
      score: exact ? 0 : contains ? 1 : distance + 2,
      allowed: exact || contains || distance <= maxDistance,
    };
  });

  return scored
    .filter((entry) => entry.allowed)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
