export type MatchInfo = {
    id: string;
    score: number;
    metadata: any;
};

export type ParentResult = {
    parentId: string;
    score: number;
    title?: string;
    snippet?: string;
    matchedChunks: MatchInfo[];
    metadata?: any;
};

export function aggregateMatches(
    matches: any[],
    topKParents = 10
): ParentResult[] {
    const grouped = new Map<string, MatchInfo[]>();
    for (const m of matches) {
        const meta = m.metadata || {};
        const parentId =
            meta.parentId || meta.parent_id || meta.parent || "unknown";
        const entry: MatchInfo = {
            id: m.id,
            score: m.score ?? 0,
            metadata: meta,
        };
        const arr = grouped.get(parentId) || [];
        arr.push(entry);
        grouped.set(parentId, arr);
    }

    const results: ParentResult[] = [];
    for (const [parentId, hits] of grouped.entries()) {
        hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const maxScore = hits[0]?.score ?? 0;
        const sumScore = hits.reduce((s, h) => s + (h.score ?? 0), 0);
        const aggScore = maxScore + 0.1 * sumScore;
        const firstMeta = hits[0]?.metadata || {};
        const snippet =
            (firstMeta?.title ? `${firstMeta.title} — ` : "") +
            (firstMeta?.snippet || firstMeta?.text?.slice?.(0, 160) || "");
        const finalSnippet = snippet ? snippet.slice(0, 300) : undefined;
        const result: ParentResult = {
            parentId,
            score: aggScore,
            title: firstMeta?.title,
            matchedChunks: hits,
            metadata: firstMeta,
        };
        if (finalSnippet) {
            result.snippet = finalSnippet;
        }
        results.push(result);
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topKParents);
}
