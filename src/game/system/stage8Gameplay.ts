export interface CollectiblePickupResult {
    collectedIds: Set<string>;
    collectedCount: number;
    score: number;
    collected: boolean;
}

export function applyCollectiblePickup(
    collectedIds: ReadonlySet<string>,
    collectibleId: string,
    currentCollectedCount: number,
    currentScore: number,
    collectiblePoints: number,
): CollectiblePickupResult {
    if (!collectibleId || collectedIds.has(collectibleId)) {
        return {
            collectedIds: new Set(collectedIds),
            collectedCount: currentCollectedCount,
            score: currentScore,
            collected: false,
        };
    }

    const nextIds = new Set(collectedIds);
    nextIds.add(collectibleId);

    return {
        collectedIds: nextIds,
        collectedCount: currentCollectedCount + 1,
        score: currentScore + Math.max(0, collectiblePoints),
        collected: true,
    };
}
