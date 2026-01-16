import { ethers } from 'ethers';
import { getWorkerRegistryContract } from '../config/contracts';
import { Worker, WorkerWithMetadata, WorkerManifest } from '../types/worker';
import { logger, logWorkerEvent } from '../utils/logger';

/**
 * Worker Indexer
 * 
 * Queries the WorkerRegistry contract to discover available workers
 * and fetches their metadata from off-chain sources.
 */
export class WorkerIndexer {
    private registryContract: ethers.Contract;
    private workerCache: Map<string, WorkerWithMetadata> = new Map();
    private lastCacheUpdate: number = 0;
    private cacheValidityMs: number = 60000; // 1 minute cache

    constructor() {
        this.registryContract = getWorkerRegistryContract();
    }

    /**
     * Get worker info from the registry contract
     */
    async getWorkerByAddress(address: string): Promise<Worker | null> {
        try {
            const result = await this.registryContract.workers(address);

            // Check if worker exists (walletAddress will be zero address if not registered)
            if (result.walletAddress === ethers.ZeroAddress) {
                return null;
            }

            return {
                address: result.walletAddress,
                metadataPointer: result.metadataPointer,
                reputation: Number(result.reputation),
                isActive: result.isActive,
                registrationTime: Number(result.registrationTime),
            };
        } catch (error) {
            logger.error('Failed to get worker from registry', { address, error });
            return null;
        }
    }

    /**
     * Check if a worker is active
     */
    async isWorkerActive(address: string): Promise<boolean> {
        try {
            return await this.registryContract.isWorkerActive(address);
        } catch (error) {
            logger.error('Failed to check worker active status', { address, error });
            return false;
        }
    }

    /**
     * Fetch worker manifest from their endpoint
     */
    async fetchWorkerManifest(endpoint: string): Promise<WorkerManifest | null> {
        try {
            const response = await fetch(`${endpoint}/manifest`);
            if (!response.ok) {
                logger.warn('Worker manifest fetch failed', { endpoint, status: response.status });
                return null;
            }
            return await response.json() as WorkerManifest;
        } catch (error) {
            logger.warn('Failed to fetch worker manifest', { endpoint, error });
            return null;
        }
    }

    /**
     * Get active workers from a list of known addresses
     * 
     * Note: Since there's no enumeration function on the contract,
     * we rely on a list of known worker addresses (could come from
     * indexing WorkerRegistered events or an off-chain registry)
     */
    async getActiveWorkers(knownAddresses: string[]): Promise<Worker[]> {
        const workers: Worker[] = [];

        for (const address of knownAddresses) {
            const worker = await this.getWorkerByAddress(address);
            if (worker && worker.isActive) {
                workers.push(worker);
            }
        }

        logWorkerEvent('indexer', 'discovered_workers', 'info', {
            total: knownAddresses.length,
            active: workers.length,
        });

        return workers;
    }

    /**
     * Get workers with extended metadata
     * Fetches manifest from worker endpoints if available
     */
    async getWorkersWithMetadata(
        knownAddresses: string[],
        endpoints: Record<string, string>
    ): Promise<WorkerWithMetadata[]> {
        const workers = await this.getActiveWorkers(knownAddresses);
        const workersWithMetadata: WorkerWithMetadata[] = [];

        for (const worker of workers) {
            const endpoint = endpoints[worker.address];
            if (endpoint) {
                const manifest = await this.fetchWorkerManifest(endpoint);
                if (manifest) {
                    workersWithMetadata.push({
                        ...worker,
                        capabilities: manifest.services.map(s => s.id),
                        pricing: manifest.services.reduce((acc, s) => {
                            acc[s.id] = s.priceWei;
                            return acc;
                        }, {} as Record<string, string>),
                        endpoint,
                        name: `Worker ${worker.address.slice(0, 8)}`,
                        description: `Worker providing ${manifest.services.length} services`,
                    });
                } else {
                    workersWithMetadata.push(worker);
                }
            } else {
                workersWithMetadata.push(worker);
            }
        }

        return workersWithMetadata;
    }

    /**
     * Filter workers by capability
     */
    filterByCapability(
        workers: WorkerWithMetadata[],
        capability: string
    ): WorkerWithMetadata[] {
        return workers.filter(w =>
            w.capabilities?.includes(capability) ?? false
        );
    }

    /**
     * Filter workers by minimum reputation
     */
    filterByMinReputation(
        workers: Worker[],
        minReputation: number
    ): Worker[] {
        return workers.filter(w => w.reputation >= minReputation);
    }

    /**
     * Subscribe to WorkerRegistered events
     * Returns an unsubscribe function
     */
    onWorkerRegistered(
        callback: (worker: string, metadata: string) => void
    ): () => void {
        const handler = (worker: string, metadata: string) => {
            logWorkerEvent(worker, 'registered', 'info', { metadata });
            callback(worker, metadata);
        };

        this.registryContract.on('WorkerRegistered', handler);

        return () => {
            this.registryContract.off('WorkerRegistered', handler);
        };
    }

    /**
     * Subscribe to WorkerBanned events
     */
    onWorkerBanned(callback: (worker: string) => void): () => void {
        const handler = (worker: string) => {
            logWorkerEvent(worker, 'banned', 'warn');
            callback(worker);
        };

        this.registryContract.on('WorkerBanned', handler);

        return () => {
            this.registryContract.off('WorkerBanned', handler);
        };
    }
}
