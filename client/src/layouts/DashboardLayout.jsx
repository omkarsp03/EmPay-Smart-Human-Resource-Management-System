import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import CommandPalette from '../components/CommandPalette';
import AIAssistant from '../components/AIAssistant';
import Chatbot from '../components/Chatbot';
import { Bot, MessageSquare } from 'lucide-react';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="dashboard-layout">
      <div className="liquid-blob liquid-blob-1" aria-hidden="true" />
      <div className="liquid-blob liquid-blob-2" aria-hidden="true" />
      <div className="liquid-blob liquid-blob-3" aria-hidden="true" />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`main-wrapper ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Topbar onOpenCommandPalette={() => setCmdOpen(true)} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
      <AIAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />
      <Chatbot isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      <div className="fab-group">
        <button className="fab-ai fab-chat" onClick={() => setChatOpen(true)} title="HR Chatbot">
          <MessageSquare size={20} />
        </button>
        <button className="fab-ai" onClick={() => setAiOpen(true)} title="AI Insights">
          <Bot size={22} />
        </button>
      </div>
    </div>
  );
}
