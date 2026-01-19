import "dotenv/config";
import { ethers } from "ethers";
import axios from "axios";
import {
  WorkerSelector,
  AuthorizationSigner,
  getNativeEscrowContractWithSigner,
  getNativeEscrowContract,
  contractAddresses,
} from "../src"; // Assumes your index.ts exports these
import { getMasterWallet } from "../src/config/cronos";

// Configuration
const TARGET_TASK_TYPE = "summary-generation";
const DUMMY_PARAMS = {
  text: "Blockchain is a distributed ledger technology that enables secure, transparent transactions.",
  maxLength: 100,
};
const TASK_DURATION = 3600; // 1 hour
const PAYMENT_AMOUNT = ethers.parseEther("0.02"); // 0.001 zkTCRO

async function main() {
  console.log(`\n🤖 ECONOS MASTER AGENT - DEMO CLI`);
  console.log(`==================================================`);

  const masterWallet = getMasterWallet();
  console.log(`🔑 Master Wallet: ${masterWallet.address}`);
  console.log(`📜 Escrow Contract: ${contractAddresses.nativeEscrow}`);
  console.log(`📜 Registry Contract: ${contractAddresses.workerRegistry}`);

  // ---------------------------------------------------------
  // STEP 1: WORKER DISCOVERY
  // ---------------------------------------------------------
  console.log(`\n[Step 1] 📡 Scanning for Workers...`);

  // Initialize Selector
  // We add your specific worker to "known workers" to ensure discovery if the registry indexing is slow
  const workerSelector = new WorkerSelector({
    knownWorkerAddresses: [
      // If you know your worker address, add it here for faster discovery,
      // otherwise it queries the registry.
      "0xB0BeC85Fd4B334048f6B1C4733ea51BfAe6c3Dd0",
    ],
    workerEndpoints: {
      // Map the address to the HTTP URL (use http://localhost:3001 if running locally)
      "0xB0BeC85Fd4B334048f6B1C4733ea51BfAe6c3Dd0": "http://localhost:3001",
    },
  });

  // We need to wait a moment for the indexer to fetch metadata
  console.log(
    `   ... Querying Registry & Fetching Manifests (this may take 2-3s) ...`,
  );
  const workers = await workerSelector.getAvailableWorkers();

  console.log(`\n   ✅ Discovered ${workers.length} Active Workers:`);
  workers.forEach((w) => {
    console.log(`   ------------------------------------------------`);
    console.log(`   👷 Address:  ${w.address}`);
    console.log(`   ⭐ Reputation: ${w.reputation}`);
    console.log(`   🌐 Endpoint: ${w.endpoint}`);
    console.log(`   🛠  Services: ${w.capabilities?.join(", ") || "None"}`);
    if (w.pricing) {
      console.log(`   💰 Pricing: ${JSON.stringify(w.pricing)}`);
    }
  });

  if (workers.length === 0) {
    console.error(
      `\n❌ ERROR: No workers found. Check if your Worker Node is running and registered.`,
    );
    process.exit(1);
  }

  // ---------------------------------------------------------
  // STEP 2: SELECTION STRATEGY
  // ---------------------------------------------------------
  console.log(
    `\n[Step 2] 🧠 Selecting Best Worker for '${TARGET_TASK_TYPE}'...`,
  );

  // Create a dummy Task object for selection
  const taskDef = {
    taskId: "", // generated later
    taskType: TARGET_TASK_TYPE,
    inputParameters: DUMMY_PARAMS,
    deadline: 0,
    budget: PAYMENT_AMOUNT.toString(),
    status: 0, // PENDING
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // We require the worker to have the specific capability
    requiredCapabilities: [TARGET_TASK_TYPE],
  };

  // Use the selector logic
  // We cast to 'any' here just because our dummy object might miss some internal fields
  const selectedWorker = await workerSelector.selectWorker(
    taskDef as any,
    "reputation",
  );

  if (!selectedWorker) {
    console.error(
      `\n❌ ERROR: No worker found matching capability '${TARGET_TASK_TYPE}' within budget.`,
    );
    process.exit(1);
  }

  console.log(`   ✅ SELECTED WORKER: ${selectedWorker.address}`);
  console.log(`      Strategy: Highest Reputation`);
  console.log(`      Endpoint: ${selectedWorker.endpoint}`);

  // ---------------------------------------------------------
  // STEP 3: TASK & AUTHORIZATION
  // ---------------------------------------------------------
  console.log(`\n[Step 3] 🔐 Generating Authorization...`);

  const taskId = ethers.hexlify(ethers.randomBytes(32));
  const nonce = Math.floor(Date.now() / 1000); // Simple nonce
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  console.log(`   🆔 Generated Task ID: ${taskId}`);

  const authSigner = new AuthorizationSigner();

  // Create the EIP-712 Signature
  const signedAuth = await authSigner.createAuthorization(
    taskId,
    selectedWorker.address,
    expiresAt,
    nonce,
    {
      serviceName: TARGET_TASK_TYPE,
      params: DUMMY_PARAMS,
    },
  );

  console.log(`   ✍️  Signed EIP-712 Authorization.`);
  console.log(`   Signature: ${signedAuth.signature.slice(0, 20)}...`);

  // ---------------------------------------------------------
  // STEP 4: REGISTER INTENT (HTTP CALL)
  // ---------------------------------------------------------
  console.log(`\n[Step 4] 📨 Sending Intent to Worker API...`);

  if (!selectedWorker.endpoint) {
    console.error(`❌ Selected worker has no endpoint URL.`);
    process.exit(1);
  }

  try {
    const authUrl = `${selectedWorker.endpoint}/authorize/${taskId}`;
    console.log(`   POST ${authUrl}`);

    // Construct the body expected by Worker Node's POST /authorize/:id
    const body = {
      message: {
        taskId: taskId,
        worker: selectedWorker.address,
        expiresAt: expiresAt,
        nonce: nonce,
      },
      signature: signedAuth.signature,
      payload: {
        serviceName: TARGET_TASK_TYPE,
        params: DUMMY_PARAMS,
      },
    };

    const response = await axios.post(authUrl, body);
    console.log(
      `   ✅ Worker Responded: ${response.status} ${response.statusText}`,
    );
    console.log(`   Worker Message: "${response.data.message}"`);
  } catch (error: any) {
    console.error(`❌ Failed to contact worker: ${error.message}`);
    if (error.response)
      console.error(`   Response: ${JSON.stringify(error.response.data)}`);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // STEP 5: ON-CHAIN DEPOSIT
  // ---------------------------------------------------------
  console.log(`\n[Step 5] 💰 Depositing Funds to Escrow...`);

  const escrow = getNativeEscrowContractWithSigner();

  try {
    const tx = await escrow.depositTask(
      taskId,
      selectedWorker.address,
      TASK_DURATION,
      { value: PAYMENT_AMOUNT },
    );
    console.log(`   ⏳ Transaction Sent: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);
    await tx.wait();
    console.log(`   ✅ Deposit Confirmed.`);
  } catch (error: any) {
    console.error(`❌ Deposit Failed: ${error.message}`);
    process.exit(1);
  }

  // ---------------------------------------------------------
  // STEP 6: WAIT FOR COMPLETION (POLLING MODE)
  // ---------------------------------------------------------
  console.log(`\n[Step 6] 👂 Polling for Result (Timeout: 60s)...`);

  const escrowReader = getNativeEscrowContract();
  const startTime = Date.now();
  const TIMEOUT_MS = 60000; // 60 seconds
  let resultBytes: string | null = null;

  while (Date.now() - startTime < TIMEOUT_MS) {
    // 1. Check Task Status directly from contract state
    const taskState = await escrowReader.tasks(taskId);
    const status = Number(taskState.status); // 0=Open, 1=Completed

    if (status === 1) {
      console.log(`   ✅ Task Status is COMPLETED! Fetching result data...`);

      // 2. Fetch the log history to get the actual result data
      // (We query the past logs instead of waiting for a new live event)
      const filter = escrowReader.filters.TaskCompleted(taskId);
      const logs = await escrowReader.queryFilter(filter);

      if (logs.length > 0) {
        // Ethers v6 event typing extraction
        const event = logs[0] as ethers.EventLog;
        resultBytes = event.args[1]; // arg[0]=taskId, arg[1]=result
        break;
      } else {
        console.log(
          `   ⚠️ Status is Completed but logs are indexing... retrying...`,
        );
      }
    } else {
      process.stdout.write("."); // Loading indicator
    }

    // Wait 2 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (resultBytes) {
    console.log(`\n   ✅ EVENT RECEIVED: TaskCompleted`);
    console.log(`      On-Chain Proof (Hash): ${resultBytes}`);

    // ---------------------------------------------------------
    // STEP 7: FETCH READABLE DATA (The Missing Link)
    // ---------------------------------------------------------
    console.log(`\n[Step 7] 📥 Fetching Readable Result from Worker...`);

    try {
      // 1. Construct the URL to your Worker's new endpoint
      // We use the endpoint stored in the registry (e.g., http://localhost:3001)
      const workerUrl = selectedWorker.endpoint;
      const fetchUrl = `${workerUrl}/result/${taskId}`;

      // 2. Ask the Worker for the data
      console.log(`      GET ${fetchUrl}`);
      const response = await axios.get(fetchUrl);

      if (response.data.success) {
        console.log(`\n📦 HUMAN READABLE OUTPUT:`);
        console.log(`==================================================`);

        const data = response.data.data;

        // Pretty print if it's JSON, otherwise just print the text
        if (typeof data === "object") {
          console.log(JSON.stringify(data, null, 2));
        } else {
          // This is your SUMMARY text!
          console.log(data);
        }

        console.log(`==================================================`);
      }
    } catch (err: any) {
      console.error(`❌ Failed to fetch result: ${err.message}`);
      console.log(
        `   (Did you restart the Worker Node with the new /result endpoint?)`,
      );
    }

    console.log(`\n🎉 DEMO COMPLETE: Full Lifecycle Successful!`);
  } else {
    console.error(`\n❌ Timeout: Task was not completed within 60s.`);
    const taskStatus = await escrowReader.tasks(taskId);
    console.log(`   Debug Status: ${taskStatus.status}`);
  }
}

main().catch(console.error);
