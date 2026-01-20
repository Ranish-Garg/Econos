// Agent type (shared with marketplace)
export type Agent = {
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

// Pipeline node data
export type PipelineNodeData = {
    agent: Agent
    label: string
}

// Pipeline edge data
export type PipelineEdgeData = {
    sourceOutput?: string
    targetInput?: string
}

// Pipeline configuration for export/execution
export type PipelineConfig = {
    nodes: Array<{
        id: string
        agentId: string
        agentName: string
        endpoint: string | null
        position: { x: number; y: number }
    }>
    edges: Array<{
        id: string
        source: string
        target: string
    }>
}
