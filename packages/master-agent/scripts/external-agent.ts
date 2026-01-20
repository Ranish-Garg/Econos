import 'dotenv/config';
import axios from 'axios';
import { ethers } from 'ethers';

// CONFIG
const GATEWAY_URL = 'http://localhost:4000/hire';
const RPC_URL = process.env.CRONOS_RPC_URL || 'https://evm-t3.cronos.org/';

// We use the WORKER key to simulate an "External Agent" paying the Master
// In a real scenario, this would be a third-party wallet.
const EXTERNAL_AGENT_PK = process.env.MASTER_PRIVATE_KEY!;

async function main() {
    console.log("🤖 EXTERNAL AGENT: Starting Job Negotiation...");

    // 1. Define the Task
    const payload = {
        taskType: "researcher",
        params: {
            query: "The Future of Autonomous Payments",
            depth: "standard"
        }
        // Notice: NO BUDGET provided. We ask the server.
    };

    try {
        // ---------------------------------------------------------
        // STEP 1: ATTEMPT TO HIRE (Expect 402 Rejection)
        // ---------------------------------------------------------
        console.log(`\n[Step 1] Asking Master Agent to work...`);
        await axios.post(GATEWAY_URL, payload);

    } catch (error: any) {
        if (error.response && error.response.status === 402) {
            console.log(`   ⚠️  PAYMENT REQUIRED (402)`);

            const paymentDetails = error.response.data.paymentDetails;
            console.log(`   💰 Price Quoted: ${paymentDetails.amount} ${paymentDetails.currency}`);
            console.log(`   fighting Recipient: ${paymentDetails.recipient}`);

            // ---------------------------------------------------------
            // STEP 2: PAY THE INVOICE
            // ---------------------------------------------------------
            console.log(`\n[Step 2] Paying the invoice...`);

            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const wallet = new ethers.Wallet(EXTERNAL_AGENT_PK, provider);

            const tx = await wallet.sendTransaction({
                to: paymentDetails.recipient,
                value: ethers.parseEther(paymentDetails.amount)
            });

            console.log(`   ⏳ Transaction Sent: ${tx.hash}`);
            await tx.wait(); // Wait for confirmation so Master can verify
            console.log(`   ✅ Payment Confirmed!`);

            // ---------------------------------------------------------
            // STEP 3: RETRY WITH L402 HEADER
            // ---------------------------------------------------------
            console.log(`\n[Step 3] Retrying with Proof of Payment...`);

            try {
                const response = await axios.post(GATEWAY_URL, payload, {
                    headers: {
                        // Standard L402 Header Format
                        'Authorization': `L402 ${tx.hash}`
                    }
                });

                console.log(`\n🎉 SUCCESS! Result Received:`);
                console.log("==================================================");
                console.log(JSON.stringify(response.data.output, null, 2));
                console.log("==================================================");

            } catch (retryError: any) {
                console.error("❌ Second Attempt Failed:", retryError.response?.data || retryError.message);
            }

        } else {
            // Real Error (Not 402)
            console.error("❌ Unexpected Error:", error.response?.data || error.message);
        }
    }
}

main().catch(console.error);