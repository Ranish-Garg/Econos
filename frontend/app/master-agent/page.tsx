"use client"

import { useState, useRef, useEffect } from "react"
import { Navbar } from "@/components/ui/navbar"
import { Send, Bot, User, Sparkles } from "lucide-react"

interface Message {
    id: string
    role: "user" | "assistant"
    content: string
    timestamp: Date
}

// Mock responses for demo
const mockResponses = [
    "I've analyzed the current market conditions on Cronos zkEVM. Based on the worker agents I've consulted, the sentiment is moderately bullish with a 67% confidence score.",
    "I found 3 active worker agents that can help with your request:\n\n• **Risk Scoring Oracle** - 0.05 zkCRO/call\n• **Sentiment Analyzer** - 0.03 zkCRO/call\n• **Market Research Agent** - 0.08 zkCRO/call\n\nWould you like me to query any of these for detailed analysis?",
    "Transaction complete! I've successfully orchestrated the following workflow:\n\n1. ✅ Discovered Risk Scoring Oracle via Registry\n2. ✅ Paid 0.05 zkCRO (tx: 0x7a3f...)\n3. ✅ Received signed response\n4. ✅ Verified signature on-chain\n\nThe risk score for your portfolio is **73/100** (Moderate Risk).",
    "I can help you with various DeFi operations on Cronos zkEVM. Here's what I can do:\n\n• **Market Analysis** - Get real-time sentiment and price predictions\n• **Risk Assessment** - Score portfolios and token risks\n• **Agent Discovery** - Find and compare worker agents\n• **Automated Payments** - Handle x402 payment flows\n\nWhat would you like to explore?",
]

export default function MasterAgentPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSend = async () => {
        if (!input.trim() || isTyping) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsTyping(true)

        // Simulate typing delay
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000))

        const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, assistantMessage])
        setIsTyping(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const isEmpty = messages.length === 0

    return (
        <main className="min-h-screen bg-zinc-950 flex flex-col">
            <Navbar />

            {/* Chat Container */}
            <div className="flex-1 flex flex-col pt-20">
                {/* Empty State */}
                {isEmpty && (
                    <div className="flex-1 flex flex-col items-center justify-center px-6">
                        <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
                            <Sparkles className="w-10 h-10 text-zinc-400" />
                        </div>
                        <h1 className="font-display text-3xl md:text-4xl font-bold text-zinc-100 mb-3 text-center">
                            Master Agent
                        </h1>
                        <p className="text-zinc-500 text-center max-w-md mb-8">
                            Your autonomous orchestrator for AI services on Cronos zkEVM.
                            Ask me to discover agents, analyze markets, or execute DeFi strategies.
                        </p>

                        {/* Suggestion Pills */}
                        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mb-8">
                            {[
                                "What agents are available?",
                                "Analyze my portfolio risk",
                                "Get market sentiment for CRO",
                                "How does x402 payment work?",
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => setInput(suggestion)}
                                    className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Messages */}
                {!isEmpty && (
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {message.role === "assistant" && (
                                        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                                            <Bot className="w-4 h-4 text-zinc-400" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === "user"
                                            ? "bg-zinc-100 text-zinc-900"
                                            : "bg-zinc-900 border border-zinc-800 text-zinc-200"
                                            }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                            {message.content}
                                        </p>
                                    </div>
                                    {message.role === "user" && (
                                        <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center shrink-0">
                                            <User className="w-4 h-4 text-zinc-300" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Typing Indicator */}
                            {isTyping && (
                                <div className="flex gap-4 justify-start">
                                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-zinc-400" />
                                    </div>
                                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                )}

                {/* Composer */}
                <div className="sticky bottom-0 bg-linear-to-t from-zinc-950 via-zinc-950 to-transparent pt-6 pb-6 px-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative flex items-center rounded-full bg-zinc-900 border border-zinc-800 ring-1 ring-zinc-800/50 focus-within:ring-zinc-700 focus-within:border-zinc-700 transition-all h-12 px-5 pr-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask the Master Agent anything..."
                                className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 outline-none text-sm"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isTyping}
                                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ml-2 shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-center text-xs text-zinc-600 mt-3">
                            Master Agent orchestrates x402 payments and worker agent interactions on Cronos zkEVM
                        </p>
                    </div>
                </div>
            </div>
        </main>
    )
}
