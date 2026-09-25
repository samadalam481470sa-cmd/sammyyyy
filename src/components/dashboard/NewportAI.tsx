import React, { useState } from 'react'
import { Sparkles, Send, Bot, CornerDownLeft, Shield } from 'lucide-react'
import { AI_SUGGESTED_PROMPTS, AI_MOCK_RESPONSES } from '../../data/mockData'

interface NewportAIProps {
  onExecutePrompt?: (prompt: string) => void
}

export const NewportAI: React.FC<NewportAIProps> = ({ onExecutePrompt }) => {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Welcome to **Newport AI**. I can analyze your acquisition pipeline, surface stalled deals, summarize confidential MGA dossiers, and highlight upcoming milestones.'
    }
  ])
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = (textToSend?: string) => {
    const promptText = textToSend || query
    if (!promptText.trim() || isLoading) return

    // Add user message
    const newMessages = [...messages, { role: 'user' as const, content: promptText }]
    setMessages(newMessages)
    setQuery('')
    setIsLoading(true)

    if (onExecutePrompt) {
      onExecutePrompt(promptText)
    }

    // Simulate fast local PE response
    setTimeout(() => {
      let response = AI_MOCK_RESPONSES[promptText]
      if (!response) {
        // Fallback generic intelligent response
        response = `Analyzing Newport pipeline records for "${promptText}"...\n\nFound matching acquisition data across active platform deals. All financial calculations and diligence milestones remain confidential and updated.`
      }

      setMessages([...newMessages, { role: 'assistant', content: response }])
      setIsLoading(false)
    }, 450)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-xl border border-slate-800 p-5 shadow-lg relative overflow-hidden">
      {/* Background glow accent */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Newport AI
              </h3>
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded">
                Pipeline Intelligence
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Natural language deal insights & confidential portfolio synthesis
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-blue-400 mr-1" />
          <span>Confidential Deal Guard Active</span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="mt-4">
        <div className="text-[11px] font-medium text-slate-400 mb-2">
          Suggested queries:
        </div>
        <div className="flex flex-wrap gap-2">
          {AI_SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="text-xs text-slate-200 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-700/80 px-3 py-1 rounded-full transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat conversation area (Compact) */}
      <div className="mt-4 max-h-48 overflow-y-auto space-y-2.5 pr-1 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg leading-relaxed ${
              m.role === 'user'
                ? 'bg-blue-600/30 border border-blue-500/40 text-blue-100 ml-8'
                : 'bg-slate-800/90 border border-slate-700/70 text-slate-200 mr-8 whitespace-pre-line'
            }`}
          >
            <div className="flex items-center space-x-1.5 mb-1 text-[10px] font-bold text-slate-400">
              {m.role === 'user' ? (
                <span>You</span>
              ) : (
                <span className="flex items-center text-blue-400">
                  <Bot className="w-3 h-3 mr-1" />
                  Newport AI Assistant
                </span>
              )}
            </div>
            <div>{m.content}</div>
          </div>
        ))}

        {isLoading && (
          <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/70 text-slate-400 flex items-center space-x-2 text-xs">
            <Bot className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>Analyzing pipeline metrics and diligence notes...</span>
          </div>
        )}
      </div>

      {/* Input query field */}
      <div className="mt-4 relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your acquisition pipeline..."
          className="w-full pl-4 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-inner"
        />
        <button
          onClick={() => handleSend()}
          disabled={!query.trim() || isLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white transition-all"
        >
          {query.trim() ? (
            <Send className="w-3.5 h-3.5" />
          ) : (
            <CornerDownLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}
