/**
 * Result Canonicalizer
 * 
 * Provides deterministic serialization and hashing of task results.
 * Ensures consistent hashing across different runs and environments.
 */

import { ethers } from 'ethers';

/**
 * Sort object keys recursively for deterministic serialization
 */
function sortObjectKeys(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }

    if (typeof obj === 'object') {
        const sorted: Record<string, unknown> = {};
        const keys = Object.keys(obj as Record<string, unknown>).sort();
        for (const key of keys) {
            sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
        }
        return sorted;
    }

    return obj;
}

/**
 * Canonicalize an object to a deterministic JSON string
 * 
 * This ensures that the same data always produces the same string,
 * regardless of the order in which properties were defined.
 */
export function canonicalize(data: unknown): string {
    const sorted = sortObjectKeys(data);
    return JSON.stringify(sorted);
}

/**
 * Compute Keccak-256 hash of a string
 */
export function keccak256String(data: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(data));
}

/**
 * Compute deterministic hash of any data
 * 
 * 1. Canonicalizes the data (sorts keys recursively)
 * 2. Serializes to JSON string
 * 3. Computes Keccak-256 hash
 * 
 * @returns bytes32 hash string (0x prefixed)
 */
export function computeResultHash(data: unknown): string {
    const canonical = canonicalize(data);
    return keccak256String(canonical);
}

/**
 * Create a result submission payload
 * 
 * This is what gets stored/referenced on-chain.
 */
export interface ResultPayload {
    /** Original result data */
    data: unknown;
    /** Canonical JSON string */
    canonical: string;
    /** Keccak-256 hash of canonical JSON */
    hash: string;
    /** Timestamp of canonicalization */
    timestamp: number;
}

/**
 * Prepare result for on-chain submission
 */
export function prepareResult(data: unknown): ResultPayload {
    const canonical = canonicalize(data);
    const hash = keccak256String(canonical);

    return {
        data,
        canonical,
        hash,
        timestamp: Math.floor(Date.now() / 1000),
    };
}

/**
 * Verify that a result matches its claimed hash
 */
export function verifyResultHash(data: unknown, expectedHash: string): boolean {
    const actualHash = computeResultHash(data);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
