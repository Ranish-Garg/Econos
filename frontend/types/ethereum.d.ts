// Type definitions for window.ethereum (EIP-1193)

interface EthereumProvider {
    isMetaMask?: boolean
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    on: (event: string, callback: (...args: unknown[]) => void) => void
    removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
}

declare global {
    interface Window {
        ethereum?: EthereumProvider
    }
}

export { }
