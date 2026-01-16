import { ethers } from 'ethers';

/**
 * Hash an object using keccak256
 * Serializes to JSON and hashes the result
 */
export function hashObject(obj: unknown): string {
    const json = JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );
    return ethers.keccak256(ethers.toUtf8Bytes(json));
}

/**
 * Convert a string to bytes32
 * Pads or truncates as needed
 */
export function toBytes32(str: string): string {
    // If already a bytes32 hex string, return as-is
    if (str.startsWith('0x') && str.length === 66) {
        return str;
    }

    // Encode as UTF-8 bytes and pad/truncate to 32 bytes
    const bytes = ethers.toUtf8Bytes(str);
    if (bytes.length > 32) {
        // Hash if too long
        return ethers.keccak256(bytes);
    }

    // Pad with zeros
    const padded = new Uint8Array(32);
    padded.set(bytes);
    return ethers.hexlify(padded);
}

/**
 * Generate a unique task ID as bytes32
 * Uses UUID v4 with keccak256 hash
 */
export function generateTaskId(): string {
    const uuid = crypto.randomUUID();
    return ethers.keccak256(ethers.toUtf8Bytes(uuid));
}

/**
 * Get current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

/**
 * Calculate deadline from current time plus duration
 */
export function calculateDeadline(durationSeconds: number): number {
    return getCurrentTimestamp() + durationSeconds;
}
