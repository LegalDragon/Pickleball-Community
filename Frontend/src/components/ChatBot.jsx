import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Minimize2, Maximize2 } from 'lucide-react'
import api from '../services/api'

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm Ace, your pickleball assistant! 🏓 I can help you with:\n\n• Using Pickleball Community features\n• Pickleball rules and scoring\n• Tips and strategies\n• Collecting your feedback\n\nHow can I help you today?"
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom()
      inputRef.current?.focus()
      setUnreadCount(0)
    }
  }, [messages, isOpen, isMinimized])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      // Build history from previous messages (excluding initial greeting)
      const history = messages.slice(1).map(m => ({
        role: m.role,
        content: m.content
      }))

      const response = await api.post('/chatbot/chat', {
        message: userMessage,
        history: history
      })

      if (response.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.message }])
        if (!isOpen || isMinimized) {
          setUnreadCount(prev => prev + 1)
        }
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "Sorry, I'm having trouble responding right now. Please try again!" 
        }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Oops! Something went wrong. Please try again in a moment." 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const toggleChat = () => {
    if (!isOpen) {
      setIsOpen(true)
      setIsMinimized(false)
      setUnreadCount(0)
    } else {
      setIsOpen(false)
    }
  }

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
    if (isMinimized) {
      setUnreadCount(0)
    }
  }

  const suggestedQuestions = [
    "How do I create a tournament?",
    "What are pickleball scoring rules?",
    "How does check-in work?",
    "I have feedback about the site"
  ]

  const handleSuggestion = (question) => {
    setInput(question)
    inputRef.current?.focus()
  }

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isOpen ? 'bg-gray-600 hover:bg-gray-700' : 'bg-emerald-600 hover:bg-emerald-700'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`fixed bottom-24 right-6 z-50 bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isMinimized ? 'w-80 h-14' : 'w-96 h-[500px] max-h-[70vh]'
          }`}
          style={{ maxWidth: 'calc(100vw - 48px)' }}
        >
          {/* Header */}
          <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏓</span>
              <div>
                <h3 className="font-semibold text-sm">Ace - Pickleball Assistant</h3>
                {!isMinimized && (
                  <p className="text-xs text-emerald-100">Ask me anything about pickleball!</p>
                )}
              </div>
            </div>
            <button
              onClick={toggleMinimize}
              className="p-1 hover:bg-emerald-700 rounded transition-colors"
              aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100%-140px)]">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-md">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions (show when no user messages yet) */}
              {messages.length === 1 && !isLoading && (
                <div className="px-4 pb-2">
                  <p className="text-xs text-gray-500 mb-2">Try asking:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestion(q)}
                        className="text-xs bg-gray-100 hover:bg-emerald-100 text-gray-700 px-2 py-1 rounded-full transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSubmit} className="p-3 border-t bg-gray-50">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default ChatBot
