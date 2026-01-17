"use client"

import { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { Navbar } from "@/components/ui/navbar"
import { FooterSection } from "@/components/sections/footer-section"
import { ConnectWalletButton } from "@/components/ui/connect-wallet-button"
import { Check, ChevronRight, Code, DollarSign, Info, Wallet, Loader2, ExternalLink } from "lucide-react"
import { WORKER_REGISTRY_ABI, WORKER_REGISTRY_ADDRESS, type WorkerMetadata } from "@/lib/contracts/worker-registry"
import { uploadMetadata } from "@/lib/metadata"

const steps = [
    { id: 1, name: "Basic Info", icon: Info },
    { id: 2, name: "Service Config", icon: Code },
    { id: 3, name: "Pricing", icon: DollarSign },
    { id: 4, name: "Register", icon: Wallet },
]

type TransactionStatus = "idle" | "uploading" | "signing" | "pending" | "success" | "error"

export default function RegisterPage() {
    const [currentStep, setCurrentStep] = useState(1)
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        category: "",
        endpoint: "",
        price: "",
        capabilities: "",
    })
    const [txStatus, setTxStatus] = useState<TransactionStatus>("idle")
    const [errorMessage, setErrorMessage] = useState<string>("")

    const { address, isConnected } = useAccount()
    const { data: hash, writeContract, isPending: isWritePending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

    const updateForm = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }))
    }

    const handleRegister = async () => {
        if (!isConnected || !address) {
            setErrorMessage("Please connect your wallet first")
            setTxStatus("error")
            return
        }

        try {
            setTxStatus("uploading")
            setErrorMessage("")

            // Prepare metadata
            const metadata: WorkerMetadata = {
                name: formData.name,
                description: formData.description,
                category: formData.category,
                endpoint: formData.endpoint,
                capabilities: formData.capabilities,
                price: formData.price,
            }

            // Save to Supabase
            const metadataPointer = await uploadMetadata(metadata, address)

            setTxStatus("signing")

            // Call contract
            writeContract({
                address: WORKER_REGISTRY_ADDRESS,
                abi: WORKER_REGISTRY_ABI,
                functionName: "register",
                args: [metadataPointer],
            })

            setTxStatus("pending")
        } catch (error) {
            console.error("Registration error:", error)
            setErrorMessage(error instanceof Error ? error.message : "Registration failed")
            setTxStatus("error")
        }
    }

    // Update status based on transaction state
    if (isSuccess && txStatus !== "success") {
        setTxStatus("success")
    }

    return (
        <main className="min-h-screen bg-zinc-950">
            <Navbar />

            <section className="pt-32 pb-24 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* Header with Wallet Button */}
                    <div className="mb-8">
                        <div className="text-center mb-6">
                            <h1 className="font-display text-4xl md:text-5xl font-bold text-zinc-100 mb-4">
                                Register Your Agent
                            </h1>
                            <p className="text-lg text-zinc-500">
                                Start earning zkCRO by providing AI services to the Econos ecosystem
                            </p>
                        </div>
                        <div className="flex justify-end">
                            <ConnectWalletButton />
                        </div>
                    </div>

                    {/* Progress Steps */}
                    <div className="mb-12">
                        <div className="flex items-center justify-between max-w-2xl mx-auto">
                            {steps.map((step, idx) => {
                                const Icon = step.icon
                                const isComplete = currentStep > step.id
                                const isCurrent = currentStep === step.id
                                return (
                                    <div key={step.id} className="flex items-center flex-1">
                                        <div className={`flex flex-col items-center ${idx < steps.length - 1 ? "flex-1" : ""}`}>
                                            <div
                                                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${isComplete
                                                    ? "bg-zinc-100 border-zinc-100"
                                                    : isCurrent
                                                        ? "bg-zinc-800 border-zinc-600"
                                                        : "bg-zinc-900 border-zinc-800"
                                                    }`}
                                            >
                                                {isComplete ? (
                                                    <Check className="w-6 h-6 text-zinc-900" />
                                                ) : (
                                                    <Icon className={`w-5 h-5 ${isCurrent ? "text-zinc-300" : "text-zinc-600"}`} />
                                                )}
                                            </div>
                                            <span className={`text-xs mt-2 ${isCurrent ? "text-zinc-300" : "text-zinc-600"}`}>
                                                {step.name}
                                            </span>
                                        </div>
                                        {idx < steps.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-2 ${isComplete ? "bg-zinc-100" : "bg-zinc-800"}`} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Form Content */}
                    <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 mb-8">
                        {/* Step 1: Basic Info */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Agent Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => updateForm("name", e.target.value)}
                                        placeholder="e.g., Risk Scoring Oracle"
                                        className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => updateForm("description", e.target.value)}
                                        placeholder="Describe what your agent does..."
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => updateForm("category", e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-zinc-700"
                                    >
                                        <option value="">Select a category</option>
                                        <option value="risk">Risk Analysis</option>
                                        <option value="market">Market Intelligence</option>
                                        <option value="defi">DeFi Strategy</option>
                                        <option value="infrastructure">Infrastructure</option>
                                        <option value="security">Security</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Service Config */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        API Endpoint URL
                                        <span className="block text-xs text-zinc-500 font-normal mt-1">
                                            Master agents will call this URL to use your service
                                        </span>
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.endpoint}
                                        onChange={(e) => updateForm("endpoint", e.target.value)}
                                        placeholder="https://your-api.com/inference"
                                        className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Capabilities (JSON Schema)</label>
                                    <textarea
                                        value={formData.capabilities}
                                        onChange={(e) => updateForm("capabilities", e.target.value)}
                                        placeholder={'{"methods": ["analyze", "predict"], "inputs": ["tokenAddress", "timeframe"]}'}
                                        rows={6}
                                        className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 font-mono text-sm focus:outline-none focus:border-zinc-700"
                                    />
                                </div>
                                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/30">
                                    <p className="text-xs text-zinc-500">
                                        Define your agent's capabilities as a JSON manifest that describes available methods and input schemas
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Pricing */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Price per Call (zkCRO)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => updateForm("price", e.target.value)}
                                        placeholder="0.05"
                                        className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                                    />
                                </div>
                                <div className="p-6 rounded-xl bg-zinc-950/50 border border-zinc-800/30">
                                    <h4 className="text-sm font-semibold text-zinc-300 mb-3">Code Example: Wrap Your API</h4>
                                    <pre className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 overflow-x-auto text-xs">
                                        <code className="text-zinc-400">{`import { EconosMiddleware } from '@econos/sdk'

app.post('/v1/inference',
  EconosMiddleware({
    price: ${formData.price || '0.05'},
    asset: 'zkCRO',
    recipient: '0xYourWallet...'
  }),
  async (req, res) => {
    const result = await runAIModel(req.body)
    res.json(result)
  }
)`}</code>
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Register */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                {!isConnected ? (
                                    <div className="p-6 rounded-xl bg-zinc-950/50 border border-zinc-800/30 text-center">
                                        <Wallet className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
                                        <h4 className="text-sm font-semibold text-zinc-300 mb-2">Connect Your Wallet</h4>
                                        <p className="text-xs text-zinc-500 mb-4">
                                            Please connect your wallet to register your agent
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-300 mb-2">Wallet Address</label>
                                            <input
                                                type="text"
                                                value={address}
                                                disabled
                                                className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-500 cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="p-6 rounded-xl bg-zinc-950/50 border border-zinc-800/30">
                                            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Review Your Registration</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Agent Name:</span>
                                                    <span className="text-zinc-300">{formData.name || "—"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Category:</span>
                                                    <span className="text-zinc-300">{formData.category || "—"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Price:</span>
                                                    <span className="text-zinc-300">{formData.price ? `${formData.price} zkCRO` : "—"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-zinc-500">Endpoint:</span>
                                                    <span className="text-zinc-300 truncate ml-4 max-w-xs">{formData.endpoint || "—"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Transaction Status */}
                                        {txStatus !== "idle" && (
                                            <div className={`p-4 rounded-xl border ${txStatus === "success"
                                                ? "bg-green-950/50 border-green-800/30"
                                                : txStatus === "error"
                                                    ? "bg-red-950/50 border-red-800/30"
                                                    : "bg-blue-950/50 border-blue-800/30"
                                                }`}>
                                                <div className="flex items-center gap-3">
                                                    {(txStatus === "uploading" || txStatus === "signing" || txStatus === "pending") && (
                                                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                                    )}
                                                    {txStatus === "success" && (
                                                        <Check className="w-5 h-5 text-green-400" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-zinc-200">
                                                            {txStatus === "uploading" && "Saving metadata..."}
                                                            {txStatus === "signing" && "Please sign the transaction..."}
                                                            {txStatus === "pending" && "Transaction pending..."}
                                                            {txStatus === "success" && "Agent registered successfully!"}
                                                            {txStatus === "error" && "Registration failed"}
                                                        </p>
                                                        {errorMessage && (
                                                            <p className="text-xs text-red-400 mt-1">{errorMessage}</p>
                                                        )}
                                                        {hash && (
                                                            <a
                                                                href={`https://explorer.zkevm.cronos.org/testnet/tx/${hash}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                                                            >
                                                                View on Explorer <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleRegister}
                                            disabled={isWritePending || isConfirming || txStatus === "success"}
                                            className="w-full py-4 rounded-xl bg-zinc-100 text-zinc-900 font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {(isWritePending || isConfirming) && <Loader2 className="w-5 h-5 animate-spin" />}
                                            {txStatus === "success" ? "Registered!" : "Submit to Registry"}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between">
                        <button
                            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                            disabled={currentStep === 1}
                            className="px-6 py-3 rounded-xl bg-zinc-900 text-zinc-400 border border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:border-zinc-700 transition-colors"
                        >
                            Previous
                        </button>
                        {currentStep < 4 && (
                            <button
                                onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
                                className="px-6 py-3 rounded-xl bg-zinc-100 text-zinc-900 font-medium hover:bg-zinc-200 transition-colors flex items-center gap-2"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </section>

            <FooterSection />
        </main>
    )
}
