import { NextRequest, NextResponse } from 'next/server';

const MASTER_AGENT_URL = process.env.MASTER_AGENT_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message, taskType, params } = body;

        if (!message && !taskType) {
            return NextResponse.json(
                { error: 'Either message or taskType is required' },
                { status: 400 }
            );
        }

        // If taskType is provided, use direct /hire endpoint
        // Otherwise, use /chat for natural language processing
        const endpoint = taskType ? '/hire' : '/chat';
        const payload = taskType
            ? { taskType, params: params || { input: message } }
            : { message };

        const response = await fetch(`${MASTER_AGENT_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                {
                    error: data.error || 'Master agent request failed',
                    details: data.details || data.message,
                },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Master agent API error:', error);

        // Handle connection refused (server not running)
        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
            return NextResponse.json(
                {
                    error: 'Master agent server is not running',
                    details: 'Please start the master-agent server on port 4000',
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error', details: String(error) },
            { status: 500 }
        );
    }
}
