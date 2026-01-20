'use client'

import { useReactFlow } from 'reactflow'
import { ZoomIn, ZoomOut, Maximize2, Trash2, Download, Play } from 'lucide-react'
import type { PipelineConfig } from '@/types/agent'

type PipelineControlsProps = {
    onClear: () => void
    onExecute: () => void
}

export function PipelineControls({ onClear, onExecute }: PipelineControlsProps) {
    const { zoomIn, zoomOut, fitView, getNodes, getEdges } = useReactFlow()

    const handleExport = () => {
        const nodes = getNodes()
        const edges = getEdges()

        const config: PipelineConfig = {
            nodes: nodes.map(node => ({
                id: node.id,
                agentId: node.data.agent.id,
                agentName: node.data.agent.name,
                endpoint: node.data.agent.endpoint,
                position: node.position,
            })),
            edges: edges.map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
            })),
        }

        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'pipeline.json'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 backdrop-blur-sm">
            {/* Zoom Controls */}
            <button
                onClick={() => zoomIn()}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Zoom In"
            >
                <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => zoomOut()}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Zoom Out"
            >
                <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => fitView({ padding: 0.2 })}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Fit View"
            >
                <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-5 bg-zinc-700 mx-0.5" />

            {/* Actions */}
            <button
                onClick={onClear}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                title="Clear Canvas"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={handleExport}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Export Pipeline"
            >
                <Download className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-5 bg-zinc-700 mx-0.5" />

            {/* Execute Button */}
            <button
                onClick={onExecute}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                title="Execute Pipeline"
            >
                <Play className="w-3 h-3" />
                <span className="text-xs">Run</span>
            </button>
        </div>
    )
}
