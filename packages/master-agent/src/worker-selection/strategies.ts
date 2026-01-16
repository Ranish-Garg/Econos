import { Worker, WorkerWithMetadata } from '../types/worker';

/**
 * Worker selection strategies
 * 
 * Each strategy takes a list of workers and returns the best match
 * based on specific criteria.
 */

/**
 * Select worker with highest reputation
 */
export function selectByReputation(workers: Worker[]): Worker | null {
    if (workers.length === 0) return null;

    return workers.reduce((best, current) =>
        current.reputation > best.reputation ? current : best
    );
}

/**
 * Select worker with lowest price for a given service
 */
export function selectByCheapest(
    workers: WorkerWithMetadata[],
    serviceId: string
): WorkerWithMetadata | null {
    const workersWithPricing = workers.filter(
        w => w.pricing && w.pricing[serviceId]
    );

    if (workersWithPricing.length === 0) return null;

    return workersWithPricing.reduce((best, current) => {
        const bestPrice = BigInt(best.pricing![serviceId]);
        const currentPrice = BigInt(current.pricing![serviceId]);
        return currentPrice < bestPrice ? current : best;
    });
}

/**
 * State for round-robin selection
 */
const roundRobinState: Map<string, number> = new Map();

/**
 * Select worker using round-robin
 * Distributes load evenly across workers
 * 
 * @param workers - List of available workers
 * @param groupKey - Key to track rotation (e.g., task type)
 */
export function selectRoundRobin<T extends Worker>(
    workers: T[],
    groupKey: string = 'default'
): T | null {
    if (workers.length === 0) return null;

    const currentIndex = roundRobinState.get(groupKey) || 0;
    const nextIndex = (currentIndex + 1) % workers.length;
    roundRobinState.set(groupKey, nextIndex);

    return workers[currentIndex];
}

/**
 * Select worker by direct address match
 */
export function selectDirect<T extends Worker>(
    workers: T[],
    address: string
): T | null {
    return workers.find(w =>
        w.address.toLowerCase() === address.toLowerCase()
    ) || null;
}

/**
 * Select worker with capability and highest reputation
 */
export function selectByCapabilityAndReputation(
    workers: WorkerWithMetadata[],
    capability: string
): WorkerWithMetadata | null {
    const capable = workers.filter(
        w => w.capabilities?.includes(capability)
    );

    if (capable.length === 0) return null;

    return capable.reduce((best, current) =>
        current.reputation > best.reputation ? current : best
    );
}

/**
 * Weighted score selection
 * 
 * Combines multiple factors with configurable weights
 */
export interface SelectionWeights {
    reputation: number;  // Weight for reputation score
    price: number;       // Weight for price (lower is better)
}

export function selectByWeightedScore(
    workers: WorkerWithMetadata[],
    serviceId: string,
    weights: SelectionWeights = { reputation: 0.7, price: 0.3 }
): WorkerWithMetadata | null {
    const workersWithPricing = workers.filter(
        w => w.pricing && w.pricing[serviceId]
    );

    if (workersWithPricing.length === 0) return null;

    // Normalize prices (inverse because lower is better)
    const prices = workersWithPricing.map(w => BigInt(w.pricing![serviceId]));
    const maxPrice = prices.reduce((a, b) => a > b ? a : b, 0n);
    const minPrice = prices.reduce((a, b) => a < b ? a : b, maxPrice);
    const priceRange = maxPrice - minPrice || 1n;

    // Calculate scores
    const scored = workersWithPricing.map(w => {
        const price = BigInt(w.pricing![serviceId]);
        const normalizedPrice = Number((maxPrice - price) * 100n / priceRange) / 100;
        const normalizedRep = w.reputation / 100;

        const score =
            weights.reputation * normalizedRep +
            weights.price * normalizedPrice;

        return { worker: w, score };
    });

    // Return worker with highest score
    return scored.reduce((best, current) =>
        current.score > best.score ? current : best
    ).worker;
}

/**
 * Filter workers by minimum reputation threshold
 */
export function filterByReputation<T extends Worker>(
    workers: T[],
    minReputation: number
): T[] {
    return workers.filter(w => w.reputation >= minReputation);
}

/**
 * Filter workers that have all required capabilities
 */
export function filterByCapabilities(
    workers: WorkerWithMetadata[],
    requiredCapabilities: string[]
): WorkerWithMetadata[] {
    return workers.filter(w => {
        const caps = w.capabilities || [];
        return requiredCapabilities.every(req => caps.includes(req));
    });
}

/**
 * Filter workers within budget for a service
 */
export function filterByBudget(
    workers: WorkerWithMetadata[],
    serviceId: string,
    maxBudgetWei: bigint
): WorkerWithMetadata[] {
    return workers.filter(w => {
        if (!w.pricing || !w.pricing[serviceId]) return false;
        return BigInt(w.pricing[serviceId]) <= maxBudgetWei;
    });
}
