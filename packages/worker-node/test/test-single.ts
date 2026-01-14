import 'dotenv/config';

/**
 * Test a single agent interactively
 * Usage: npx ts-node test/test-single.ts <agent-name>
 * 
 * Available agents:
 *   - image-generation
 *   - summary-generation
 *   - researcher
 *   - writer
 *   - market-research
 */

const agentName = process.argv[2];

if (!agentName) {
    console.log('Usage: npx ts-node test/test-single.ts <agent-name>');
    console.log('\nAvailable agents:');
    console.log('  - image-generation');
    console.log('  - summary-generation');
    console.log('  - researcher');
    console.log('  - writer');
    console.log('  - market-research');
    process.exit(1);
}

async function testSingleAgent() {
    console.log(`\n🧪 Testing: ${agentName}\n`);

    let agent: { execute: (input: unknown) => Promise<unknown> };
    let testInput: unknown;

    switch (agentName) {
        case 'image-generation':
            const { createImageGenerationAgent } = await import('../src/services/image-generation/agent');
            agent = createImageGenerationAgent();
            testInput = {
                prompt: 'A cute robot holding a red skateboard in a park',
                numberOfImages: 1,
                aspectRatio: '1:1',
                style: 'digital_art',
            };
            break;

        case 'summary-generation':
            const { createSummaryGenerationAgent } = await import('../src/services/summary-generation/agent');
            agent = createSummaryGenerationAgent();
            testInput = {
                text: 'The Cronos blockchain is an EVM-compatible Layer 1 chain built using the Cosmos SDK. It aims to make it easy for developers to port their Ethereum dApps to Cronos with minimal friction. The native token of Cronos is CRO, which is used for transaction fees and staking.',
                style: 'bullet-points',
            };
            break;

        case 'researcher':
            const { createResearcherAgent } = await import('../src/services/researcher/agent');
            agent = createResearcherAgent();
            testInput = {
                topic: 'Cronos zkEVM vs other Layer 2 solutions',
                depth: 'standard',
            };
            break;

        case 'writer':
            const { createWriterAgent } = await import('../src/services/writer/agent');
            agent = createWriterAgent();
            testInput = {
                topic: 'How AI agents are changing DeFi',
                type: 'article',
                tone: 'professional',
                targetLength: 300,
            };
            break;

        case 'market-research':
            const { createMarketResearchAgent } = await import('../src/services/market-research/agent');
            agent = createMarketResearchAgent();
            testInput = {
                query: 'Analyze the current market sentiment for Ethereum',
                tokens: ['ETH', 'BTC'],
                analysisType: 'comprehensive',
            };
            break;

        default:
            console.log(`❌ Unknown agent: ${agentName}`);
            process.exit(1);
    }

    console.log('Input:', JSON.stringify(testInput, null, 2));
    console.log('\nExecuting...\n');

    try {
        const result = await agent.execute(testInput);
        console.log('✅ SUCCESS\n');

        // Special handling for image generation - don't print huge base64
        if (agentName === 'image-generation') {
            const imgResult = result as { images: Array<{ imageBase64: string; mimeType: string }>;[key: string]: unknown };
            console.log('Output:', JSON.stringify({
                ...imgResult,
                images: imgResult.images.map(img => ({
                    ...img,
                    imageBase64: `[BASE64 IMAGE - ${img.imageBase64.length} chars]`,
                })),
            }, null, 2));

            // Save the first image to file for inspection
            if (imgResult.images[0]?.imageBase64) {
                const fs = await import('fs');
                const buffer = Buffer.from(imgResult.images[0].imageBase64, 'base64');
                fs.writeFileSync('test-generated-image.png', buffer);
                console.log('\n📸 Image saved to: test-generated-image.png');
            }
        } else {
            console.log('Output:', JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.log('❌ FAILED\n');
        console.error(error);
    }
}

testSingleAgent().catch(console.error);
