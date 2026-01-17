import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, type AgentMetadata } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { ids } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: 'No IDs provided' },
                { status: 400 }
            )
        }

        const supabase = createServerSupabaseClient()

        // Fetch agents by their UUIDs
        const { data, error } = await supabase
            .from('agent_metadata')
            .select('*')
            .in('id', ids)

        if (error) {
            console.error('Supabase fetch error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch agents', details: error.message },
                { status: 500 }
            )
        }

        // Transform to frontend-friendly format
        const agents = (data as AgentMetadata[]).map(agent => ({
            id: agent.id,
            walletAddress: agent.wallet_address,
            name: agent.name,
            description: agent.description,
            category: agent.category,
            endpoint: agent.endpoint,
            capabilities: agent.capabilities,
            price: agent.price,
            createdAt: agent.created_at,
        }))

        return NextResponse.json({
            success: true,
            agents,
            count: agents.length,
        })

    } catch (error) {
        console.error('Agents fetch error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch agents', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
