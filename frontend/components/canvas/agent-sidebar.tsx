'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, GripVertical } from 'lucide-react'
import type { Agent } from '@/types/agent'

type AgentSidebarProps = {
    onDragStart: (event: React.DragEvent, agent: Agent) => void
}

export function AgentSidebar({ onDragStart }: AgentSidebarProps) {
    const [agents, setAgents] = useState<Agent[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Fetch agents on mount
    useEffect(() => {
        async function fetchAgents() {
            try {
                // Try to fetch from the same API as marketplace
                const response = await fetch('/api/agents')
                if (response.ok) {
                    const data = await response.json()
                    setAgents(data.agents || [])
                }
            } catch (error) {
                console.error('Failed to fetch agents:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchAgents()
    }, [])

    const filteredAgents = agents.filter(agent =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (agent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    )

    return (
        <div className="w-56 h-full bg-zinc-900/80 border-r border-zinc-800 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-100 mb-2">Agents</h2>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                    />
                </div>
            </div>

            {/* Agent List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                    </div>
                ) : filteredAgents.length === 0 ? (
                    <p className="text-center text-xs text-zinc-500 py-6">
                        {agents.length === 0 ? 'No agents available' : 'No match'}
                    </p>
                ) : (
                    filteredAgents.map(agent => (
                        <div
                            key={agent.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, agent)}
                            className="px-2 py-2 rounded-md bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 cursor-grab active:cursor-grabbing transition-colors group"
                        >
                            <div className="flex items-center gap-1.5">
                                <GripVertical className="w-3 h-3 text-zinc-600 group-hover:text-zinc-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-zinc-200 truncate">{agent.name}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[10px] text-zinc-500 truncate">{agent.category || 'Agent'}</span>
                                        {agent.price && (
                                            <span className="text-[10px] text-green-400 flex-shrink-0">• {agent.price}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Hint */}
            <div className="px-2 py-2 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-500 text-center">
                    Drag to canvas
                </p>
            </div>
        </div>
    )
}
