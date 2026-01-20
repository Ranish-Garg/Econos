'use client'

import { http, createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import type { Chain } from 'wagmi/chains'

// Cronos zkEVM Testnet - using Chain ID 240 (0xF0)
export const cronoszkEVMTestnet: Chain = {
    id: 240,
    name: 'Cronos zkEVM Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'zkTCRO',
        symbol: 'zkTCRO',
    },
    rpcUrls: {
        default: {
            http: ['https://testnet.zkevm.cronos.org'],
        },
        public: {
            http: ['https://testnet.zkevm.cronos.org'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Cronos zkEVM Testnet Explorer',
            url: 'https://explorer.zkevm.cronos.org/testnet'
        },
    },
    testnet: true,
}

// Cronos EVM Testnet - Chain ID 338
export const cronosEVMTestnet: Chain = {
    id: 338,
    name: 'Cronos Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'TCRO',
        symbol: 'TCRO',
    },
    rpcUrls: {
        default: {
            http: ['https://evm-t3.cronos.org'],
        },
        public: {
            http: ['https://evm-t3.cronos.org'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Cronos Testnet Explorer',
            url: 'https://explorer.cronos.org/testnet'
        },
    },
    testnet: true,
}

// WalletConnect Project ID - Get one at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID'

// Only create connectors on client side to avoid localStorage SSR issues
function getConnectors() {
    if (typeof window === 'undefined') {
        return [injected()]
    }
    return [
        injected(),
        walletConnect({
            projectId,
            showQrModal: true,
        }),
    ]
}

export const config = createConfig({
    chains: [cronosEVMTestnet, cronoszkEVMTestnet],
    connectors: getConnectors(),
    transports: {
        [cronosEVMTestnet.id]: http('https://evm-t3.cronos.org'),
        [cronoszkEVMTestnet.id]: http('https://testnet.zkevm.cronos.org'),
    },
    ssr: true, // Enable SSR mode for wagmi
})

declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}

