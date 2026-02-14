export interface DiffOp {
  type: "equal" | "insert" | "delete";
  text: string;
}

export interface DiffStats {
  changes: number;
  charsDeleted: number;
  charsInserted: number;
}

/** Max words before falling back to simple delete+insert diff */
const MAX_DIFF_WORDS = 2000;

/** Word-level diff using simple LCS algorithm */
export function computeDiff(original: string, modified: string): DiffOp[] {
  const origWords = original.split(/(\s+)/);
  const modWords = modified.split(/(\s+)/);
  const m = origWords.length;
  const n = modWords.length;

  // Guard against O(m*n) explosion on very large texts
  if (m * n > MAX_DIFF_WORDS * MAX_DIFF_WORDS) {
    return [
      { type: "delete", text: original },
      { type: "insert", text: modified },
    ];
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1] === modWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const ops: DiffOp[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === modWords[j - 1]) {
      ops.push({ type: "equal", text: origWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "insert", text: modWords[j - 1] });
      j--;
    } else {
      ops.push({ type: "delete", text: origWords[i - 1] });
      i--;
    }
  }

  ops.reverse();

  // Merge adjacent ops of same type
  const merged: DiffOp[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) {
      last.text += op.text;
    } else {
      merged.push({ ...op });
    }
  }

  return merged;
}

export function diffStats(ops: DiffOp[]): DiffStats {
  let changes = 0;
  let charsDeleted = 0;
  let charsInserted = 0;
  for (const op of ops) {
    if (op.type === "delete") {
      changes++;
      charsDeleted += op.text.trim().length;
    } else if (op.type === "insert") {
      changes++;
      charsInserted += op.text.trim().length;
    }
  }
  return { changes, charsDeleted, charsInserted };
}
