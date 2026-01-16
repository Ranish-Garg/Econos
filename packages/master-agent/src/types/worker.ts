/**
 * Worker information from the WorkerRegistry contract
 */
export interface Worker {
    /** Worker's wallet address */
    address: string;

    /** IPFS CID or other metadata pointer */
    metadataPointer: string;

    /** Reputation score (0-100) */
    reputation: number;

    /** Whether the worker is currently active */
    isActive: boolean;

    /** Unix timestamp of registration */
    registrationTime: number;
}

/**
 * Extended worker information with off-chain metadata
 */
export interface WorkerWithMetadata extends Worker {
    /** Parsed capabilities from metadata */
    capabilities?: string[];

    /** Pricing per service (service name -> wei amount) */
    pricing?: Record<string, string>;

    /** Worker's endpoint URL */
    endpoint?: string;

    /** Human-readable name */
    name?: string;

    /** Description of the worker */
    description?: string;
}

/**
 * Worker manifest from their /manifest endpoint
 */
export interface WorkerManifest {
    worker: {
        address: string;
        network: string;
        chainId: number;
        rpcUrl: string;
        explorerUrl: string;
    };
    services: Array<{
        id: string;
        name: string;
        description: string;
        endpoint: string;
        priceWei: string;
        priceDisplay: string;
        version: string;
    }>;
    protocol: {
        name: string;
        version: string;
        paymentHeader: string;
        responseFormat: string;
    };
    timestamp: number;
}

/**
 * Worker selection strategy types
 */
export type WorkerSelectionStrategy =
    | 'reputation'   // Select highest reputation
    | 'cheapest'     // Select lowest price
    | 'fastest'      // Select by response time
    | 'round-robin'  // Rotate through workers
    | 'direct';      // Direct match by address
