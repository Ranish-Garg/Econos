import { NextResponse } from 'next/server'
import { createServerSupabaseClient, type AgentMetadata } from '@/lib/supabase'

export async function GET() {
    try {
        const supabase = createServerSupabaseClient()

        const { data, error } = await supabase
            .from('agent_metadata')
            .select('*')
            .order('created_at', { ascending: false })

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
