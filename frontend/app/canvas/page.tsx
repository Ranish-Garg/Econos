'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import ReactFlow, {
    Background,
    Controls,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    type Connection,
    type Edge,
    type Node,
    type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Navbar } from '@/components/ui/navbar'
import { AgentSidebar } from '@/components/canvas/agent-sidebar'
import { AgentNode } from '@/components/canvas/agent-node'
import { PipelineControls } from '@/components/canvas/pipeline-controls'
import type { Agent, PipelineNodeData } from '@/types/agent'

// Register custom node types
const nodeTypes = {
    agent: AgentNode,
}

// Custom edge styles
const defaultEdgeOptions = {
    style: { strokeWidth: 1.5, stroke: '#3b82f6' },
    type: 'smoothstep',
    animated: false,
}

function CanvasContent() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null)
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

    // Calculate total pipeline amount
    const pipelineStats = useMemo(() => {
        let total = 0
        nodes.forEach((node: Node<PipelineNodeData>) => {
            const price = parseFloat(node.data?.agent?.price || '0')
            total += price
        })
        return {
            agentCount: nodes.length,
            totalAmount: total.toFixed(4),
        }
    }, [nodes])

    // Handle new connections between nodes
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    )

    // Handle drag start from sidebar
    const onDragStart = (event: React.DragEvent, agent: Agent) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(agent))
        event.dataTransfer.effectAllowed = 'move'
    }

    // Handle drag over canvas
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    // Handle drop on canvas
    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault()

            if (!reactFlowWrapper.current || !reactFlowInstance) return

            const agentData = event.dataTransfer.getData('application/reactflow')
            if (!agentData) return

            const agent: Agent = JSON.parse(agentData)

            // Get drop position
            const bounds = reactFlowWrapper.current.getBoundingClientRect()
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
            })

            // Create new node
            const newNode: Node<PipelineNodeData> = {
                id: `${agent.id}-${Date.now()}`,
                type: 'agent',
                position,
                data: {
                    agent,
                    label: agent.name,
                },
            }

            setNodes((nds) => nds.concat(newNode))
        },
        [reactFlowInstance, setNodes]
    )

    // Clear all nodes and edges
    const handleClear = useCallback(() => {
        setNodes([])
        setEdges([])
    }, [setNodes, setEdges])

    // Execute pipeline (placeholder - could integrate with master agent)
    const handleExecute = useCallback(() => {
        if (nodes.length === 0) {
            alert('Add some agents to the canvas first!')
            return
        }

        // Find root nodes (no incoming edges)
        const targetIds = new Set(edges.map((e: Edge) => e.target))
        const rootNodes = nodes.filter((n: Node) => !targetIds.has(n.id))

        if (rootNodes.length === 0 && nodes.length > 0) {
            alert('Pipeline has a cycle - please ensure there is a clear starting point.')
            return
        }

        // Build execution order (topological sort)
        const order: string[] = []
        const visited = new Set<string>()

        const visit = (nodeId: string) => {
            if (visited.has(nodeId)) return
            visited.add(nodeId)
            order.push(nodeId)

            // Find connected nodes
            const nextEdges = edges.filter((e: Edge) => e.source === nodeId)
            nextEdges.forEach((e: Edge) => visit(e.target))
        }

        rootNodes.forEach((n: Node) => visit(n.id))

        // Log execution plan
        const executionPlan = order.map((id: string) => {
            const node = nodes.find((n: Node) => n.id === id)
            return node?.data.agent.name
        })

        console.log('Pipeline Execution Order:', executionPlan)
        alert(`Pipeline will execute: ${executionPlan.join(' → ')}`)

        // TODO: Actually execute via master agent API
    }, [nodes, edges])

    return (
        <div className="flex h-[calc(100vh-5rem)] bg-zinc-950 mt-20">
            {/* Sidebar */}
            <AgentSidebar onDragStart={onDragStart} />

            {/* Canvas */}
            <div className="flex-1 relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={defaultEdgeOptions}
                    fitView
                    className="bg-zinc-950"
                >
                    <Background color="#27272a" gap={16} />
                    <Controls
                        className="!bg-zinc-900 !border-zinc-800 !rounded-md [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700 [&>button]:!w-6 [&>button]:!h-6"
                    />
                    <PipelineControls onClear={handleClear} onExecute={handleExecute} />
                </ReactFlow>

                {/* Empty state */}
                {nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <p className="text-zinc-500 text-sm mb-1">Drag agents from the sidebar</p>
                            <p className="text-zinc-600 text-xs">Connect them to build your pipeline</p>
                        </div>
                    </div>
                )}

                {/* Pipeline Stats Bar */}
                {nodes.length > 0 && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20
                                    bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 
                                    rounded-lg px-4 py-2 flex items-center gap-4 shadow-lg pointer-events-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-400 text-xs">Agents:</span>
                            <span className="text-white font-medium text-sm">{pipelineStats.agentCount}</span>
                        </div>
                        <div className="w-px h-4 bg-zinc-700" />
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-400 text-xs">Total Cost:</span>
                            <span className="text-green-400 font-medium text-sm">{pipelineStats.totalAmount} TCRO</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function CanvasPage() {
    return (
        <main className="min-h-screen bg-zinc-950">
            <Navbar />
            <ReactFlowProvider>
                <CanvasContent />
            </ReactFlowProvider>
        </main>
    )
}
