"use client"

import { useState, useEffect } from "react"
import { useReadContract } from "wagmi"
import { Navbar } from "@/components/ui/navbar"
import { FooterSection } from "@/components/sections/footer-section"
import { Search, TrendingUp, Shield, Zap, Database, Brain, Activity, Loader2, AlertCircle } from "lucide-react"
import { WORKER_REGISTRY_ABI, WORKER_REGISTRY_ADDRESS } from "@/lib/contracts/worker-registry"

type Agent = {
    id: string
    walletAddress: string
    name: string
    description: string | null
    category: string | null
    endpoint: string | null
    capabilities: string | null
    price: string | null
    createdAt: string
}

// Map categories to icons
const categoryIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    "risk": TrendingUp,
    "market": Brain,
    "defi": Zap,
    "infrastructure": Database,
    "security": Shield,
}

// Map category keys to display names
const categoryDisplayNames: Record<string, string> = {
    "risk": "Risk Analysis",
    "market": "Market Intelligence",
    "defi": "DeFi Strategy",
    "infrastructure": "Infrastructure",
    "security": "Security",
}

// Convert bytes32 to UUID
function bytes32ToUuid(bytes32: string): string {
    // Remove 0x prefix and leading zeros (UUID is 32 hex chars = 16 bytes)
    const hex = bytes32.slice(2).replace(/^0+/, '')
    // Pad to 32 chars if needed
    const paddedHex = hex.padStart(32, '0')
    // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return `${paddedHex.slice(0, 8)}-${paddedHex.slice(8, 12)}-${paddedHex.slice(12, 16)}-${paddedHex.slice(16, 20)}-${paddedHex.slice(20, 32)}`
}

export default function MarketplacePage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("All")
    const [agents, setAgents] = useState<Agent[]>([])
    const [isLoadingAgents, setIsLoadingAgents] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 1. Fetch metadata pointers from contract (on Cronos EVM Testnet, not zkEVM)
    const { data: metadataPointers, isLoading: isLoadingContract, error: contractError } = useReadContract({
        address: WORKER_REGISTRY_ADDRESS,
        abi: WORKER_REGISTRY_ABI,
        functionName: 'getAllWorkers',
        chainId: 338, // Cronos EVM Testnet - contract is deployed here
        query: {
            // Treat contract errors gracefully - if contract not deployed, just show empty
            retry: false,
        }
    })

    // Check if contract error is due to contract not being deployed (returns 0x)
    const isContractNotDeployed = contractError?.message?.includes('returned no data') ||
        contractError?.message?.includes('"0x"')

    // 2. When we have pointers, fetch agent data from Supabase
    useEffect(() => {
        async function fetchAgentsByIds(pointers: readonly `0x${string}`[]) {
            if (!pointers || pointers.length === 0) {
                setAgents([])
                return
            }

            setIsLoadingAgents(true)
            setError(null)

            try {
                // Convert bytes32 pointers to UUIDs
                const uuids = pointers.map(p => bytes32ToUuid(p))
                console.log('Fetching agents for UUIDs:', uuids)

                // Fetch from our API with the IDs
                const response = await fetch('/api/agents/by-ids', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: uuids }),
                })

                if (!response.ok) {
                    throw new Error('Failed to fetch agents')
                }

                const data = await response.json()
                setAgents(data.agents || [])
            } catch (err) {
                console.error('Error fetching agents:', err)
                setError('Failed to load agents. Please try again.')
            } finally {
                setIsLoadingAgents(false)
            }
        }

        // Only fetch if we have valid pointers and no contract deployment error
        if (metadataPointers && !isLoadingContract && !isContractNotDeployed) {
            fetchAgentsByIds(metadataPointers as readonly `0x${string}`[])
        } else if (isContractNotDeployed) {
            // Contract not deployed - just show empty state
            setAgents([])
        }
    }, [metadataPointers, isLoadingContract, isContractNotDeployed])

    const isLoading = isLoadingContract || isLoadingAgents

    // Get unique categories from fetched agents
    const categories = ["All", ...Array.from(new Set(agents.map(a => a.category).filter((c): c is string => c !== null)))]

    const filteredAgents = agents.filter(agent => {
        const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (agent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
        const matchesCategory = selectedCategory === "All" || agent.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    // Parse capabilities string to array
    const parseCapabilities = (caps: string | null): string[] => {
        if (!caps) return []
        try {
            const parsed = JSON.parse(caps)
            if (parsed.methods) return parsed.methods
            if (Array.isArray(parsed)) return parsed
            return []
        } catch {
            return caps.split(',').map(s => s.trim()).filter(Boolean)
        }
    }

    return (
        <main className="min-h-screen bg-zinc-950">
            <Navbar />

            {/* Header */}
            <section className="pt-32 pb-16 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <h1 className="font-display text-4xl md:text-6xl font-bold text-zinc-100 mb-4">
                        Agent Marketplace
                    </h1>
                    <p className="text-lg text-zinc-500 max-w-2xl mx-auto mb-8">
                        Discover and integrate AI worker agents for your autonomous M2M applications
                    </p>

                    {/* Search Bar */}
                    <div className="max-w-2xl mx-auto mb-8">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Search agents by name or capability..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-full text-sm transition-all ${selectedCategory === category
                                    ? "bg-zinc-100 text-zinc-900 font-medium"
                                    : "bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
                                    }`}
                            >
                                {categoryDisplayNames[category as string] || category}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Agent Grid */}
            <section className="pb-24 px-6">
                <div className="max-w-6xl mx-auto">
                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-zinc-500 animate-spin mb-4" />
                            <p className="text-zinc-500">
                                {isLoadingContract ? 'Fetching from contract...' : 'Loading agent data...'}
                            </p>
                        </div>
                    )}

                    {/* Error State - only show for real errors, not "contract not deployed" */}
                    {(error || (contractError && !isContractNotDeployed)) && !isLoading && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
                            <p className="text-red-400">{error || contractError?.message}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-4 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Agents Grid - show when not loading and no real errors */}
                    {!isLoading && !error && (!contractError || isContractNotDeployed) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredAgents.map((agent) => {
                                const Icon = categoryIcon[agent.category || ''] || Activity
                                const capabilities = parseCapabilities(agent.capabilities)
                                const displayCategory = categoryDisplayNames[agent.category || ''] || agent.category || 'Other'

                                return (
                                    <div
                                        key={agent.id}
                                        className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 group cursor-pointer"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center">
                                                <Icon className="w-6 h-6 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                                <span className="text-xs text-zinc-500">online</span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <h3 className="text-lg font-semibold text-zinc-100 mb-2 group-hover:text-white transition-colors">
                                            {agent.name}
                                        </h3>
                                        <p className="text-xs text-zinc-500 mb-3">{displayCategory}</p>
                                        <p className="text-sm text-zinc-500 mb-4 line-clamp-2">
                                            {agent.description || 'No description provided'}
                                        </p>

                                        {/* Capabilities */}
                                        {capabilities.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                {capabilities.slice(0, 2).map((cap, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 rounded-md bg-zinc-800/50 text-xs text-zinc-400"
                                                    >
                                                        {cap}
                                                    </span>
                                                ))}
                                                {capabilities.length > 2 && (
                                                    <span className="px-2 py-1 rounded-md bg-zinc-800/50 text-xs text-zinc-500">
                                                        +{capabilities.length - 2}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                                            <div>
                                                <p className="text-xs text-zinc-600 mb-1">Price per call</p>
                                                <p className="text-lg font-semibold text-zinc-100">
                                                    {agent.price ? `${agent.price} TCRO` : 'Free'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-zinc-500 truncate max-w-[120px]" title={agent.walletAddress}>
                                                    {agent.walletAddress?.slice(0, 6)}...{agent.walletAddress?.slice(-4)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && !error && !contractError && filteredAgents.length === 0 && (
                        <div className="text-center py-16">
                            <p className="text-zinc-500">
                                {agents.length === 0
                                    ? "No agents registered yet. Be the first to register!"
                                    : "No agents found matching your criteria"
                                }
                            </p>
                        </div>
                    )}
                </div>
            </section>

            <FooterSection />
        </main>
    )
}
