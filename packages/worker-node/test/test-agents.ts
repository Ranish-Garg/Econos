import 'dotenv/config';
import { createImageGenerationAgent } from '../src/services/image-generation/agent';
import { createSummaryGenerationAgent } from '../src/services/summary-generation/agent';
import { createResearcherAgent } from '../src/services/researcher/agent';
import { createWriterAgent } from '../src/services/writer/agent';
import { createMarketResearchAgent } from '../src/services/market-research/agent';

/**
 * Test all agents without payment verification
 */
async function testAllAgents() {
    console.log('\n🧪 Testing All Agents\n');
    console.log('='.repeat(60));

    // Test 1: Image Generation
    console.log('\n📸 Test 1: Image Generation Agent');
    console.log('-'.repeat(40));
    try {
        const imageAgent = createImageGenerationAgent();
        const imageResult = await imageAgent.execute({
            prompt: 'A futuristic city with flying cars',
            style: 'artistic',
        });
        console.log('✅ SUCCESS');
        console.log('Enhanced Prompt:', (imageResult as any).enhancedPrompt?.slice(0, 100) + '...');
    } catch (error) {
        console.log('❌ FAILED:', error);
    }

    // Test 2: Summary Generation
    console.log('\n📝 Test 2: Summary Generation Agent');
    console.log('-'.repeat(40));
    try {
        const summaryAgent = createSummaryGenerationAgent();
        const summaryResult = await summaryAgent.execute({
            text: 'Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.',
            style: 'concise',
        });
        console.log('✅ SUCCESS');
        console.log('Summary:', (summaryResult as any).summary?.slice(0, 100) + '...');
    } catch (error) {
        console.log('❌ FAILED:', error);
    }

    // Test 3: Researcher
    console.log('\n🔬 Test 3: Researcher Agent');
    console.log('-'.repeat(40));
    try {
        const researcherAgent = createResearcherAgent();
        const researchResult = await researcherAgent.execute({
            topic: 'Benefits of blockchain technology',
            depth: 'quick',
        });
        console.log('✅ SUCCESS');
        console.log('Findings:', (researchResult as any).findings?.slice(0, 100) + '...');
    } catch (error) {
        console.log('❌ FAILED:', error);
    }

    // Test 4: Writer
    console.log('\n✍️  Test 4: Writer Agent');
    console.log('-'.repeat(40));
    try {
        const writerAgent = createWriterAgent();
        const writerResult = await writerAgent.execute({
            topic: 'Introduction to Web3',
            type: 'blog',
            tone: 'casual',
            targetLength: 200,
        });
        console.log('✅ SUCCESS');
        console.log('Content:', (writerResult as any).content?.slice(0, 100) + '...');
    } catch (error) {
        console.log('❌ FAILED:', error);
    }

    // Test 5: Market Research
    console.log('\n📊 Test 5: Market Research Agent');
    console.log('-'.repeat(40));
    try {
        const marketAgent = createMarketResearchAgent();
        const marketResult = await marketAgent.execute({
            query: 'What is the current state of CRO token?',
            tokens: ['CRO', 'BTC'],
            timeframe: '24h',
        });
        console.log('✅ SUCCESS');
        console.log('Analysis:', (marketResult as any).analysis?.slice(0, 100) + '...');
    } catch (error) {
        console.log('❌ FAILED:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 All tests completed!\n');
}

// Run tests
testAllAgents().catch(console.error);
