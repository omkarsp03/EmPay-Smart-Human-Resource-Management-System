import { useState, useRef, useEffect } from 'react';
import { chatbotAPI } from '../api';
import { Send, X, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import './Chatbot.css';

const SUGGESTIONS = [
  'How many leaves do I have left?',
  'Show my latest payslip',
  'What\'s my attendance rate?',
  'When are the upcoming holidays?',
  'Who is in my department?',
  'What are the company policies?',
];

export default function Chatbot({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hello! 👋 I\'m EmBot, your HR assistant. Ask me anything about your leaves, salary, attendance, policies, and more!', time: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg, time: new Date() }]);
    setLoading(true);

    try {
      const res = await chatbotAPI.ask(msg);
      setMessages(prev => [...prev, { role: 'bot', text: res.data.answer, data: res.data.data, time: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I encountered an error. Please try again.', time: new Date() }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  if (!isOpen) return null;

  return (
    <div className="chatbot-overlay" onClick={onClose}>
      <div className="chatbot-panel animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <div className="chatbot-avatar"><Bot size={20} /></div>
            <div>
              <h3>EmBot</h3>
              <span className="chatbot-status"><span className="status-dot online" /> Online</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="chatbot-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role}`}>
              <div className="chat-msg-avatar">
                {msg.role === 'bot' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className="chat-msg-content">
                <pre className="chat-msg-text">{msg.text}</pre>
                <span className="chat-msg-time">{msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-msg bot">
              <div className="chat-msg-avatar"><Bot size={16} /></div>
              <div className="chat-msg-content"><div className="chat-typing"><span /><span /><span /></div></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 2 && (
          <div className="chatbot-suggestions">
            <p className="text-xs text-tertiary"><Sparkles size={12} /> Quick questions:</p>
            <div className="suggestion-chips">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="chatbot-input">
          <input ref={inputRef} className="input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask me anything..." disabled={loading} />
          <button className="btn btn-primary btn-icon" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
            {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
