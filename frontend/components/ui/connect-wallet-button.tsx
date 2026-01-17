"use client"

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, LogOut, RefreshCw } from 'lucide-react'

export function ConnectWalletButton() {
    const { address, isConnected } = useAccount()
    const { connect, connectors, isPending, error } = useConnect()
    const { disconnect } = useDisconnect()
    const [mounted, setMounted] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Prevent hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true)
    }, [])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Return a placeholder during SSR to avoid hydration mismatch
    if (!mounted) {
        return (
            <button
                type="button"
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-100 text-base font-semibold opacity-50"
                disabled
            >
                Connect Wallet
            </button>
        )
    }

    const handleConnect = () => {
        const injectedConnector = connectors.find(c => c.id === 'injected')
        if (injectedConnector) {
            connect({ connector: injectedConnector })
        }
    }

    const handleChangeAccount = async () => {
        setIsDropdownOpen(false)
        // Request account switch via MetaMask
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                await window.ethereum.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }],
                })
            } catch (err) {
                console.error('Failed to change account:', err)
            }
        }
    }

    const handleDisconnect = () => {
        setIsDropdownOpen(false)
        disconnect()
    }

    if (isConnected && address) {
        return (
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    type="button"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-100 text-base font-semibold hover:border-zinc-600 transition-all duration-200 shadow-lg shadow-zinc-950/50"
                >
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {address.slice(0, 6)}...{address.slice(-4)}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-zinc-950/50 z-50 overflow-hidden">
                        <button
                            onClick={handleChangeAccount}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Change Account
                        </button>
                        <button
                            onClick={handleDisconnect}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-zinc-800 transition-colors border-t border-zinc-800"
                        >
                            <LogOut className="w-4 h-4" />
                            Disconnect
                        </button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <button
                onClick={handleConnect}
                disabled={isPending}
                type="button"
                className="group relative px-8 py-3.5 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-100 text-base font-semibold hover:border-zinc-600 transition-all duration-200 shadow-lg shadow-zinc-950/50 hover:shadow-zinc-900/50 disabled:opacity-50"
            >
                <span className="relative z-10">
                    {isPending ? 'Connecting...' : 'Connect Wallet'}
                </span>
            </button>
            {error && (
                <p className="text-red-400 text-xs max-w-xs text-right">{error.message}</p>
            )}
        </div>
    )
}
