/**
 * Contract Addresses Configuration
 * 
 * Centralized configuration for all contract addresses used by the worker.
 */

export interface ContractAddresses {
    /** NativeEscrow contract address */
    nativeEscrow: string;
    /** WorkerRegistry contract address */
    workerRegistry: string;
    /** AgentPaymaster contract address */
    paymaster: string;
}

/**
 * Get contract addresses from environment variables
 */
export function getContractAddresses(): ContractAddresses {
    const nativeEscrow = process.env.ESCROW_ADDRESS;
    const workerRegistry = process.env.REGISTRY_ADDRESS;
    const paymaster = process.env.PAYMASTER_ADDRESS;

    if (!nativeEscrow) {
        throw new Error('ESCROW_CONTRACT_ADDRESS is not set in environment variables');
    }
    if (!workerRegistry) {
        throw new Error('REGISTRY_CONTRACT_ADDRESS is not set in environment variables');
    }
    if (!paymaster) {
        throw new Error('PAYMASTER_ADDRESS is not set in environment variables');
    }

    return {
        nativeEscrow,
        workerRegistry,
        paymaster,
    };
}

/**
 * EIP-712 Domain configuration
 */
export interface EIP712DomainConfig {
    name: string;
    version: string;
}

/**
 * Get EIP-712 domain configuration from environment or defaults
 */
export function getEIP712Config(): EIP712DomainConfig {
    return {
        name: process.env.EIP712_DOMAIN_NAME || 'Econos Master Agent',
        version: process.env.EIP712_DOMAIN_VERSION || '1',
    };
}
