import { ethers } from 'ethers';

/**
 * Cronos zkEVM Testnet Configuration
 */
export const cronosConfig = {
    rpcUrl: process.env.CRONOS_RPC_URL || 'https://testnet.zkevm.cronos.org/',
    chainId: parseInt(process.env.CRONOS_CHAIN_ID || '240', 10),
    blockConfirmations: parseInt(process.env.BLOCK_CONFIRMATIONS || '2', 10),
    networkName: 'Cronos zkEVM Sepolia Testnet',
    currencySymbol: 'zkTCRO',
    explorerUrl: 'https://explorer.zkevm.cronos.org/testnet',
};

/**
 * Create a read-only provider for Cronos zkEVM
 */
export function getProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(cronosConfig.rpcUrl, {
        chainId: cronosConfig.chainId,
        name: cronosConfig.networkName,
    });
}

/**
 * Create a signer wallet for the master agent
 */
export function getMasterWallet(): ethers.Wallet {
    const privateKey = process.env.MASTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('MASTER_PRIVATE_KEY is not set in environment variables');
    }
    return new ethers.Wallet(privateKey, getProvider());
}

/**
 * Get the master agent's address
 */
export function getMasterAddress(): string {
    const address = process.env.MASTER_ADDRESS;
    if (!address) {
        throw new Error('MASTER_ADDRESS is not set in environment variables');
    }
    return address;
}
