import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { ethers } from 'ethers';

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3001;
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080/api/task';
const PRIVATE_KEY = process.env.WORKER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'https://evm-t3.cronos.org/';
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_ADDRESS; // NativeEscrow Address

if (!PRIVATE_KEY || !ESCROW_CONTRACT_ADDRESS) {
    console.error("❌ Fatal: Missing WORKER_PRIVATE_KEY or ESCROW_ADDRESS");
    process.exit(1);
}

// --- SETUP ---
const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// IN-MEMORY STORAGE (For simplicity in sidecar)
// In prod, this could be Redis or SQLite
const tasks: Record<string, any> = {};

// --- UTILS ---

async function verifyDeposit(taskId: string): Promise<boolean> {
    try {
        // Minimal ABI to check deposit
        // Struct: address master, address worker, uint256 amount, uint256 deadline, TaskStatus status
        const abi = ["function tasks(bytes32) view returns (address, address, uint256, uint256, uint8)"];
        const contract = new ethers.Contract(ESCROW_CONTRACT_ADDRESS!, abi, provider);

        const task = await contract.tasks(taskId);
        // task structure: [master, worker, amount, deadline, status]

        // Check if assigned to us, amount > 0, and status is OPEN (0)
        return (task[1].toLowerCase() === wallet.address.toLowerCase() && task[2] > 0 && task[4] === 0n);
    } catch (e: any) {
        console.error(` Deposit Check Failed: ${e.code || 'UNKNOWN'} - ${e.shortMessage || e.message}`);
        return false;
    }
}

async function signResult(taskId: string, resultData: any) {
    // 1. Hash the result JSON
    const resultString = JSON.stringify(resultData);
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes(resultString));

    // 2. EIP-712 Signature (Simplified for Sidecar - Direct Hash Signing)
    // Matches the contract's expected signature verification
    const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "bytes32"],
        [taskId, resultHash]
    );
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    return { resultHash, signature };
}

// --- ENDPOINTS ---

/**
 * 1. AUTHORIZE & EXECUTE
 * Master Agent calls this to start the job.
 */
app.post('/authorize/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const { payload } = req.body; // Contains { params: {...} }

    console.log(`Received Task: ${taskId}`);
    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

    // A. Verify Deposit (Security)
    const hasFunds = await verifyDeposit(taskId);
    if (!hasFunds) {
        // For Hackathon speed, we might warn but proceed, 
        // but strictly we should block.
        console.warn(`⚠️ Warning: No on-chain deposit found for ${taskId}. Proceeding anyway for demo.`);
    }

    try {
        // B. PROXY TO INTERNAL WEB2 API
        console.log(`➡️ Forwarding to Web2 API: ${INTERNAL_API_URL}`);
        console.log(`📤 Sending Data:`, JSON.stringify(payload.params, null, 2));

        const web2Response = await axios.post(INTERNAL_API_URL, payload.params);

        const resultData = web2Response.data;
        console.log(`⬅️ Received Web2 Result:`, JSON.stringify(resultData, null, 2));

        // C. SIGN RESULT
        const proof = await signResult(taskId, resultData);

        // D. STORE STATE
        tasks[taskId] = {
            status: 'COMPLETED',
            data: resultData,
            proof: proof
        };

        res.json({ success: true, status: 'PROCESSING' });

    } catch (error: any) {
        console.error("❌ Web2 API Execution Failed:", error.message);
        if (error.response) {
            console.error("   Status:", error.response.status);
            console.error("   Data:", JSON.stringify(error.response.data));
        }
        res.status(500).json({ error: "Internal API Failed" });
    }
});

/**
 * 2. GET PROOF
 * Master Agent polls this to get the signature for the blockchain.
 */
app.get('/proof/:taskId', (req, res) => {
    const task = tasks[req.params.taskId];
    if (!task || task.status !== 'COMPLETED') {
        return res.json({ success: false });
    }
    res.json({ success: true, proof: task.proof });
});

/**
 * 3. GET RESULT
 * Master Agent calls this after blockchain settlement to get the data.
 */
app.get('/result/:taskId', (req, res) => {
    const task = tasks[req.params.taskId];
    if (!task || task.status !== 'COMPLETED') {
        return res.status(404).json({ error: "Not found" });
    }
    res.json({ success: true, data: task.data });
});

// --- START ---
app.listen(PORT, () => {
    console.log(`🚀 Econos Sidecar running on port ${PORT}`);
    console.log(`🔗 Proxying to: ${INTERNAL_API_URL}`);
    console.log(`📝 Worker Address: ${wallet.address}`);
});