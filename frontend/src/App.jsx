import { useEffect, useMemo, useRef, useState } from "react";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState(() => {
    const raw = localStorage.getItem("dsa.conversations");
    return raw ? JSON.parse(raw) : [];
  });
  const [activeId, setActiveId] = useState(() => {
    const raw = localStorage.getItem("dsa.activeId");
    return raw || null;
  });
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem("dsa.apiUrl") || "http://localhost:5000");
  const [model, setModel] = useState(() => localStorage.getItem("dsa.model") || "gemini-1.5-flash");
  const [showSettings, setShowSettings] = useState(false);

  const scrollRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("dsa.conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (activeId) localStorage.setItem("dsa.activeId", activeId);
  }, [activeId]);

  useEffect(() => {
    localStorage.setItem("dsa.apiUrl", apiUrl);
  }, [apiUrl]);

  useEffect(() => {
    localStorage.setItem("dsa.model", model);
  }, [model]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeId) || null;
  }, [conversations, activeId]);

  useEffect(() => {
    // Initialize a new conversation if none exists
    if (!activeId) {
      const id = crypto.randomUUID();
      const newConv = { id, title: "New Chat", messages: [] };
      setConversations([newConv, ...conversations]);
      setActiveId(id);
      setMessages([]);
    } else if (activeConversation) {
      setMessages(activeConversation.messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const outbound = input;
    const newMessages = [...messages, { sender: "user", text: outbound }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Persist optimistic update to conversation
    if (activeConversation) {
      setConversations(prev => prev.map(c => {
        if (c.id !== activeConversation.id) return c;
        const nextTitle = c.title === "New Chat" ? deriveTitleFromText(outbound) : c.title;
        return { ...c, messages: newMessages, title: nextTitle };
      }));
    }

    try {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: outbound, model }),
      });

      const data = await response.json();
      const botText = data?.answer || data?.error || "No response.";
      const finalMessages = [...newMessages, { sender: "bot", text: botText }];
      setMessages(finalMessages);

      if (activeConversation) {
        setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, messages: finalMessages } : c));
      }
    } catch (error) {
      console.error(error);
      const finalMessages = [...newMessages, { sender: "bot", text: "⚠️ Could not connect to server." }];
      setMessages(finalMessages);
      if (activeConversation) {
        setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, messages: finalMessages } : c));
      }
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const newChat = () => {
    const id = crypto.randomUUID();
    const chat = { id, title: "New Chat", messages: [] };
    setConversations(prev => [chat, ...prev]);
    setActiveId(id);
    setMessages([]);
  };

  const formatTime = (d) => {
    try {
      const date = typeof d === "string" ? new Date(d) : new Date();
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const deriveTitleFromText = (text) => {
    if (!text) return "New Chat";
    const firstLine = text.split("\n")[0].trim();
    const cleaned = firstLine.replace(/[`*_#>\-]/g, "").replace(/\s+/g, " ").trim();
    return cleaned.length > 48 ? cleaned.slice(0, 48).trim() + "…" : cleaned || "New Chat";
  };

  return (
    <div className="flex h-screen text-white bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-800/50 backdrop-blur p-4 flex flex-col gap-3 border-r border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-purple-300 tracking-tight">DSA Instructor</h1>
        </div>
        <button
          onClick={newChat}
          aria-label="Start a new chat"
          className="w-full bg-purple-600/80 hover:bg-purple-500 rounded px-3 py-2 text-left"
        >
          ＋ New Chat
        </button>
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full text-left px-3 py-2 rounded border border-transparent hover:border-gray-600 hover:bg-gray-700/60 ${c.id === activeId ? "bg-gray-700/70 border-gray-600" : ""}`}
              title={c.title}
            >
              <div className="truncate">{c.title || "Untitled"}</div>
            </button>
          ))}
        </div>
        <button onClick={() => setShowSettings(true)} className="bg-gray-700 hover:bg-gray-600 rounded px-3 py-2">⚙ Settings</button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ask a Coding Question</h2>
          <div className="text-xs text-gray-400">Press Enter to send • Shift+Enter for new line</div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-800/60 backdrop-blur p-4 rounded-lg mb-4 border border-gray-700">
          <p className="text-gray-300">
            <span className="mr-1">💡</span>
            <strong>How to use:</strong> Ask any coding-related or DSA question. The AI explains step-by-step.
          </p>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-gray-800/50 backdrop-blur rounded-lg p-4 overflow-y-auto mb-4 border border-gray-700 space-y-3">
          {messages.length === 0 && (
            <div className="text-gray-400 text-sm">Start a conversation by asking a question above. Try: "Explain Dijkstra's algorithm with example."</div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex items-start gap-3 max-w-[85%] ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${msg.sender === "user" ? "bg-purple-600/80" : "bg-gray-600"}`}>
                  {msg.sender === "user" ? "🧑" : "🤖"}
                </div>
                <div className={`rounded-lg px-3 py-2 whitespace-pre-wrap shadow ${msg.sender === "user" ? "bg-purple-600/80" : "bg-gray-700"}`}>
                  <div className="text-sm leading-relaxed">{msg.text}</div>
                  <div className="mt-1 text-[10px] text-gray-300/70 flex items-center gap-2">
                    <span>{formatTime(msg.time)}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(msg.text)}
                      className="hover:underline"
                      title="Copy message"
                    >Copy</button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="bg-gray-700 p-3 rounded-lg italic">⌛ Typing...</div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Box */}
        <div className="flex">
          <textarea
            rows="2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your coding question here..."
            className="flex-1 p-3 rounded-l-lg bg-gray-700 text-white outline-none resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className={`px-6 py-2 rounded-r-lg ${loading ? "bg-purple-600/50 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-500"}`}
          >
            {loading ? "Sending..." : "Ask Coding Instructor"}
          </button>
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-[480px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-300 hover:text-white">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">API URL</label>
                <input
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="http://localhost:5000"
                  className="w-full bg-gray-700 rounded px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-gray-700 rounded px-3 py-2 outline-none"
                >
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowSettings(false)} className="bg-purple-600 hover:bg-purple-500 rounded px-4 py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
