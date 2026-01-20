'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Brain, Zap, TrendingUp, Database, Shield, Activity } from 'lucide-react'
import type { PipelineNodeData } from '@/types/agent'

// Map categories to icons
const categoryIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    risk: TrendingUp,
    market: Brain,
    defi: Zap,
    infrastructure: Database,
    security: Shield,
}

function AgentNodeComponent({ data, selected }: NodeProps<PipelineNodeData>) {
    const { agent } = data
    const Icon = categoryIcon[agent.category || ''] || Activity

    return (
        <div
            className={`
        relative px-2.5 py-1.5 min-w-[120px] max-w-[140px] rounded-md 
        bg-zinc-900 border transition-all duration-200
        ${selected ? 'border-blue-500 shadow-sm shadow-blue-500/20' : 'border-zinc-700 hover:border-zinc-600'}
      `}
        >
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-blue-500 !border !border-zinc-900"
            />

            {/* Content */}
            <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-2.5 h-2.5 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-[11px] font-medium text-zinc-100 truncate leading-tight">{agent.name}</p>
                    <div className="flex items-center gap-0.5">
                        <span className="text-[9px] text-zinc-500 truncate leading-tight">{agent.category || 'Agent'}</span>
                        {agent.price && (
                            <span className="text-[9px] font-medium text-green-400 flex-shrink-0">• {agent.price}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-green-500 !border !border-zinc-900"
            />
        </div>
    )
}

export const AgentNode = memo(AgentNodeComponent)
