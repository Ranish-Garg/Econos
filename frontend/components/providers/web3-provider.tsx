"use client"

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from '@/lib/wagmi-config'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

export function Web3Provider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)

    // Only render after mounting to avoid SSR localStorage issues
    useEffect(() => {
        setMounted(true)
    }, [])

    // During SSR and initial client render, don't render anything
    // This prevents wagmi hooks from being called outside of WagmiProvider
    if (!mounted) {
        return null
    }

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#f4f4f5', // zinc-100
                        accentColorForeground: '#18181b', // zinc-900
                        borderRadius: 'medium',
                        fontStack: 'system',
                    })}
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}
