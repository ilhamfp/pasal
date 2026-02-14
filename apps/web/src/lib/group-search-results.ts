export interface ChunkResult {
  id: number;
  work_id: number;
  content: string;
  metadata: Record<string, string>;
  score: number;
  snippet?: string;
}

export interface GroupedResult {
  work_id: number;
  bestChunk: ChunkResult;
  bestScore: number;
  matchingPasals: string[];
  totalChunks: number;
}

export function groupChunksByWork(chunks: ChunkResult[]): GroupedResult[] {
  const groups = new Map<number, ChunkResult[]>();

  for (const chunk of chunks) {
    const list = groups.get(chunk.work_id);
    if (list) {
      list.push(chunk);
    } else {
      groups.set(chunk.work_id, [chunk]);
    }
  }

  const results: GroupedResult[] = [];

  for (const [work_id, groupChunks] of groups) {
    // Sort by score descending to pick best chunk
    groupChunks.sort((a, b) => b.score - a.score);

    // Collect unique pasal numbers
    const pasalSet = new Set<string>();
    for (const c of groupChunks) {
      const pasal = c.metadata?.pasal;
      if (pasal) pasalSet.add(pasal);
    }

    results.push({
      work_id,
      bestChunk: groupChunks[0],
      bestScore: groupChunks[0].score,
      matchingPasals: [...pasalSet],
      totalChunks: groupChunks.length,
    });
  }

  // Sort by best score descending
  results.sort((a, b) => b.bestScore - a.bestScore);

  return results;
}

export function formatPasalList(pasals: string[]): string {
  if (pasals.length === 0) return "";
  if (pasals.length <= 3) return `Pasal ${pasals.join(", ")}`;
  const shown = pasals.slice(0, 3).join(", ");
  return `Pasal ${shown} +${pasals.length - 3} lainnya`;
}
