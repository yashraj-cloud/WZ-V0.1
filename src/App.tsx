/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Activity,
  Server,
  Lock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCcw,
  Zap,
  Sliders,
  Database,
  Terminal,
  Download,
  Plus,
  Check,
  Search,
  Filter,
  Cpu,
  Layers,
  ChevronRight,
  Radio,
  Power,
  Clock,
  Copy,
  Code,
  ArrowRight,
  ShieldCheck,
  Eye,
  CheckSquare,
  LockKeyhole
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface GatewayStats {
  total: number;
  blocked: number;
  redacted: number;
  allowed: number;
  critical: number;
  pending: number;
}

interface Agent {
  agentId: string;
  locked: boolean;
  tokenCount: number;
  usdSpent: number;
  callsThisMinute: number;
  toolCallsThisMinute: Record<string, number>;
  lastMinuteReset: number;
  lastHourReset: number;
  name: string;
  framework: string;
  owner: string;
  riskScore: number;
  lastAction: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  agentId: string;
  toolName: string;
  toolArgs: any;
  decision: 'ALLOW' | 'REDACT' | 'BLOCK' | 'PENDING';
  reason: string;
  severity: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  traceHash: string;
  findings: string[];
}

interface Approval {
  id: string;
  agentId: string;
  toolName: string;
  toolArgs: any;
  tokenDelta: number;
  usdDelta: number;
  status: 'waiting' | 'approved' | 'denied';
  createdAt: string;
  resolvedAt?: string;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [stats, setStats] = useState<GatewayStats>({ total: 0, blocked: 0, redacted: 0, allowed: 0, critical: 0, pending: 0 });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [flashingEventId, setFlashingEventId] = useState<string | null>(null);

  // Connect Agent tab state
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [codeLang, setCodeLang] = useState<'python' | 'javascript'>('python');

  // Router listener
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // WebSocket with onMessageRef pattern
  const onMessageRef = useRef<(data: any) => void>(() => {});

  onMessageRef.current = (data: any) => {
    if (data.type === 'CONNECTED') {
      setStats(data.stats);
      setAgents(data.agents || []);
      setApprovals(data.approvals || []);
    } else if (data.type === 'EVENT') {
      const newEvent = data.event;
      setAuditLogs(prev => [newEvent, ...prev].slice(0, 100));
      setFlashingEventId(newEvent.id);
      setTimeout(() => setFlashingEventId(null), 2000);
      fetch('/audit/stats').then(r => r.json()).then(setStats);
      fetch('/agents').then(r => r.json()).then(setAgents);
    } else if (data.type === 'PENDING_APPROVAL') {
      setApprovals(prev => [data.approval, ...prev]);
      fetch('/audit/stats').then(r => r.json()).then(setStats);
    } else if (data.type === 'APPROVAL_RESOLVED') {
      setApprovals(prev => prev.filter(a => a.id !== data.approval.id));
      fetch('/audit/stats').then(r => r.json()).then(setStats);
    } else if (data.type === 'AGENT_RESET') {
      setAgents(prev => prev.filter(a => a.agentId !== data.agentId));
    } else if (data.type === 'AGENT_LOCKED') {
      setAgents(prev => prev.map(a => a.agentId === data.agent.agentId ? data.agent : a));
    } else if (data.type === 'AUDIT_CLEARED') {
      setAuditLogs([]);
      setApprovals([]);
      setStats({ total: 0, blocked: 0, redacted: 0, allowed: 0, critical: 0, pending: 0 });
    }
  };

  useEffect(() => {
    // Initial fetch
    fetch('/audit/stats').then(r => r.json()).then(setStats).catch(() => {});
    fetch('/agents').then(r => r.json()).then(setAgents).catch(() => {});
    fetch('/audit?limit=100').then(r => r.json()).then(setAuditLogs).catch(() => {});
    fetch('/approvals').then(r => r.json()).then(setApprovals).catch(() => {});

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => setWsConnected(true);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current(data);
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };
    ws.onclose = () => setWsConnected(false);

    return () => ws.close();
  }, []);

  const handleApprove = async (id: string) => {
    await fetch(`/approvals/${id}/approve`, { method: 'POST' });
    const [appRes, statsRes] = await Promise.all([
      fetch('/approvals').then(r => r.json()),
      fetch('/audit/stats').then(r => r.json()),
    ]);
    setApprovals(appRes);
    setStats(statsRes);
  };

  const handleDeny = async (id: string) => {
    await fetch(`/approvals/${id}/deny`, { method: 'POST' });
    const [appRes, statsRes] = await Promise.all([
      fetch('/approvals').then(r => r.json()),
      fetch('/audit/stats').then(r => r.json()),
    ]);
    setApprovals(appRes);
    setStats(statsRes);
  };

  const handleLockAgent = async (agentId: string) => {
    await fetch(`/agent/${agentId}/lock`, { method: 'POST' });
    const agentsRes = await fetch('/agents').then(r => r.json());
    setAgents(agentsRes);
  };

  const handleResetAgent = async (agentId: string) => {
    await fetch(`/agent/${agentId}/reset`, { method: 'POST' });
    const agentsRes = await fetch('/agents').then(r => r.json());
    setAgents(agentsRes);
  };

  const clearAudit = async () => {
    if (!confirm("Clear all audit events?")) return;
    await fetch('/audit', { method: 'DELETE' });
    setAuditLogs([]);
    setApprovals([]);
    setStats({ total: 0, blocked: 0, redacted: 0, allowed: 0, critical: 0, pending: 0 });
  };

  const exportReport = () => {
    const reportText = `WORKERZERO COMPLIANCE AUDIT REPORT
Generated: ${new Date().toISOString()}
--------------------------------------------------
TOTAL INTERCEPTED: ${stats.total}
ALLOWED: ${stats.allowed}
BLOCKED: ${stats.blocked}
REDACTED: ${stats.redacted}
CRITICAL INCIDENTS: ${stats.critical}
PENDING APPROVALS: ${stats.pending}
--------------------------------------------------
RECENT AUDIT EVENTS:
${auditLogs.map(l => `[${l.timestamp}] [${l.decision}] Agent: ${l.agentId} | Tool: ${l.toolName} | Reason: ${l.reason} | Hash: ${l.traceHash}`).join('\n')}
`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workerzero-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gateway.workerzero.ai';

  const pythonSnippet = `import requests, time

def wz(tool_name, tool_args):
    r = requests.post("${origin}/intercept", json={
        "agentId": "my-agent",
        "toolName": tool_name,
        "toolArgs": tool_args,
        "tokenDelta": 150,
        "usdDelta": 0.0015
    }, timeout=10).json()
    if r["decision"] == "BLOCK":
        raise PermissionError(r["message"])
    if r["decision"] == "REDACT":
        return r["sanitizedArgs"]
    if r["decision"] == "PENDING":
        print("Waiting for human approval on your dashboard...")
        for _ in range(30):
            time.sleep(2)
            s = requests.get(f"${origin}/approvals/{r['approvalId']}/status").json()["status"]
            if s == "approved": return tool_args
            if s == "denied": raise PermissionError("Denied by human")
    return tool_args`;

  const jsSnippet = `async function wz(toolName, toolArgs) {
  const r = await fetch("${origin}/intercept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "my-agent", toolName, toolArgs, tokenDelta: 150, usdDelta: 0.0015 })
  }).then(r => r.json());
  if (r.decision === "BLOCK") throw new Error(r.message);
  if (r.decision === "REDACT") return r.sanitizedArgs;
  if (r.decision === "PENDING") {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const s = await fetch(\`${origin}/approvals/\${r.approvalId}/status\`).then(r => r.json());
      if (s.status === "approved") return toolArgs;
      if (s.status === "denied") throw new Error("Denied by human");
    }
  }
  return toolArgs;
}`;

  // Feature 1: Cost Saved calculation
  let costSavedTotal = 0;
  auditLogs.forEach(log => {
    if (log.decision === 'BLOCK') {
      if (log.reason === 'RUNAWAY_LOOP_DETECTED' || log.reason === 'BUDGET_EXCEEDED') {
        costSavedTotal += 0.60;
      } else {
        costSavedTotal += 0.10;
      }
    } else if (log.decision === 'REDACT') {
      costSavedTotal += 0.05;
    }
  });

  // Feature 2: Agent Risk Score calculation helper
  const calculateRiskScore = (agent: Agent) => {
    let score = 0;
    if (agent.locked) score += 40;
    if (agent.callsThisMinute > 15) score += 20;
    if (agent.usdSpent > 3.00) score += 20;
    if (agent.tokenCount > 3000) score += 20;
    return Math.min(100, score);
  };

  const getRiskBadge = (score: number) => {
    if (score <= 30) {
      return { bg: 'bg-[#1A7F37]/10 text-[#1A7F37]', label: 'LOW' };
    } else if (score <= 60) {
      return { bg: 'bg-[#9A6700]/10 text-[#9A6700]', label: 'MEDIUM' };
    } else {
      return { bg: 'bg-[#CF222E]/10 text-[#CF222E]', label: 'HIGH' };
    }
  };

  // Feature 3: Today's violations filter & formatter
  const todayStr = new Date().toDateString();
  const todayViolations = auditLogs.filter(log => {
    const isToday = new Date(log.timestamp).toDateString() === todayStr;
    return isToday && (log.decision === 'BLOCK' || log.decision === 'REDACT');
  });

  const formatViolationDescription = (log: AuditLog) => {
    const reason = log.reason;
    const tool = log.toolName;
    if (reason === 'BLOCKED_TOOL') return `tried to ${tool} → blocked automatically`;
    if (reason === 'RUNAWAY_LOOP_DETECTED') return `hit loop limit on ${tool} → circuit breaker tripped`;
    if (reason === 'BUDGET_EXCEEDED') return `exceeded spend limit → locked`;
    if (reason === 'PII_DETECTED') return `sent sensitive data in ${tool} → redacted`;
    if (reason === 'CIRCUIT_BREAKER_TRIPPED') return `attempted action while locked → denied`;
    return `${reason.toLowerCase().replace(/_/g, ' ')} on ${tool}`;
  };

  // Prepare data for Recharts area chart (grouped by minute)
  const chartDataMap = new Map<string, { minute: string; allow: number; redact: number; block: number }>();
  const sortedLogsForChart = [...auditLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  sortedLogsForChart.forEach(log => {
    const d = new Date(log.timestamp);
    const minute = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    if (!chartDataMap.has(minute)) {
      chartDataMap.set(minute, { minute, allow: 0, redact: 0, block: 0 });
    }
    const item = chartDataMap.get(minute)!;
    if (log.decision === 'ALLOW') item.allow++;
    else if (log.decision === 'REDACT') item.redact++;
    else if (log.decision === 'BLOCK' || log.decision === 'PENDING') item.block++;
  });
  const chartData = Array.from(chartDataMap.values());

  const blockRate = stats.total > 0 ? (stats.blocked / stats.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#1F2328] font-sans flex flex-col selection:bg-[#0969DA]/15">
      {/* ROUTE 1 — Landing Page / */}
      {currentPath === '/' && (
        <div className="flex-1 flex flex-col">
          <header className="border-b border-[#D0D7DE] py-4 px-6 sm:px-12 flex items-center justify-between bg-[#FFFFFF]">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-8 h-8 rounded-lg bg-[#0969DA] text-white flex items-center justify-center font-bold text-base shadow-xs">
                W
              </div>
              <span className="font-bold text-lg text-[#1F2328] tracking-tight">WorkerZero</span>
            </div>
            <nav className="flex items-center space-x-8 text-sm font-medium">
              <button onClick={() => navigate('/dashboard')} className="text-[#656D76] hover:text-[#1F2328] transition">DASHBOARD</button>
              <button onClick={() => navigate('/connect')} className="text-[#656D76] hover:text-[#1F2328] transition">CONNECT AGENT</button>
              <button onClick={() => navigate('/integrate')} className="text-[#656D76] hover:text-[#1F2328] transition">INTEGRATE</button>
            </nav>
          </header>

          <main className="flex-1 max-w-6xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center">
            <div className="inline-flex items-center space-x-2 bg-[#F6F8FA] border border-[#D0D7DE] px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#656D76] mb-8">
              <span className="w-2 h-2 rounded-full bg-[#1A7F37] animate-pulse"></span>
              <span>Enterprise Runtime Policy Gateway</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold text-[#1F2328] tracking-tight max-w-3xl leading-[1.15]">
              Your AI Agents. <br className="hidden sm:inline" />Under Control.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-[#656D76] max-w-2xl leading-relaxed">
              WorkerZero stops dangerous AI agent actions before they happen — automatically, in real time.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-8 py-3.5 bg-[#0969DA] hover:bg-[#0860c4] text-white rounded-xl font-semibold text-sm transition shadow-sm flex items-center space-x-2"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/connect')}
                className="px-8 py-3.5 bg-[#F6F8FA] hover:bg-[#eaeef2] text-[#1F2328] border border-[#D0D7DE] rounded-xl font-semibold text-sm transition"
              >
                Connect an Agent
              </button>
            </div>

            {/* Stat pills */}
            <div className="mt-12 flex flex-wrap justify-center gap-3">
              <div className="bg-[#F6F8FA] border border-[#D0D7DE] px-4 py-2 rounded-full text-xs font-medium text-[#656D76]">
                &lt; 5ms decision time
              </div>
              <div className="bg-[#F6F8FA] border border-[#D0D7DE] px-4 py-2 rounded-full text-xs font-medium text-[#656D76]">
                100% tool calls intercepted
              </div>
              <div className="bg-[#F6F8FA] border border-[#D0D7DE] px-4 py-2 rounded-full text-xs font-medium text-[#656D76]">
                Zero agent bypasses
              </div>
            </div>

            {/* Three feature cards */}
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
              <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-6 border-l-[3px] border-l-[#0969DA] shadow-xs">
                <h3 className="font-bold text-base text-[#1F2328]">Dangerous actions stopped automatically</h3>
                <p className="mt-2 text-sm text-[#656D76] leading-relaxed">WorkerZero blocks destructive commands before they execute. No human intervention needed.</p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-6 border-l-[3px] border-l-[#9A6700] shadow-xs">
                <h3 className="font-bold text-base text-[#1F2328]">Sensitive data never leaves your system</h3>
                <p className="mt-2 text-sm text-[#656D76] leading-relaxed">Customer names, SSNs, phone numbers and API keys are automatically stripped from agent payloads.</p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-6 border-l-[3px] border-l-[#1A7F37] shadow-xs">
                <h3 className="font-bold text-base text-[#1F2328]">You approve what matters</h3>
                <p className="mt-2 text-sm text-[#656D76] leading-relaxed">Actions that need human judgment pause and wait for your approval before proceeding.</p>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ROUTE 2 — Dashboard /dashboard */}
      {currentPath === '/dashboard' && (
        <div className="flex-1 flex flex-col bg-[#F6F8FA]">
          {/* Fixed header 56px */}
          <header className="h-14 bg-[#FFFFFF] border-b border-[#D0D7DE] px-6 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-7 h-7 rounded-lg bg-[#0969DA] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                W
              </div>
              <span className="font-bold text-base text-[#1F2328] tracking-tight">WorkerZero</span>
            </div>

            <nav className="flex items-center space-x-6 text-sm font-medium h-full">
              <button
                onClick={() => navigate('/dashboard')}
                className="h-full flex items-center text-[#1F2328] border-b-2 border-[#0969DA] px-2 font-semibold"
              >
                DASHBOARD
              </button>
              <button
                onClick={() => navigate('/connect')}
                className="h-full flex items-center text-[#656D76] hover:text-[#1F2328] px-2 transition"
              >
                CONNECT AGENT
              </button>
              <button
                onClick={() => navigate('/integrate')}
                className="h-full flex items-center text-[#656D76] hover:text-[#1F2328] px-2 transition"
              >
                INTEGRATE
              </button>
            </nav>

            <div className="flex items-center space-x-3">
              {stats.critical > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-[#CF222E]/10 text-[#CF222E] text-xs font-bold border border-[#CF222E]/30 animate-pulse">
                  {stats.critical} CRITICAL
                </span>
              )}
              <div className="flex items-center space-x-1.5 bg-[#F6F8FA] px-2.5 py-1 rounded-md border border-[#D0D7DE] text-xs text-[#656D76]">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#1A7F37]' : 'bg-[#CF222E]'}`}></span>
                <span>{wsConnected ? 'Connected' : 'Offline'}</span>
              </div>
              <button
                onClick={exportReport}
                className="px-3 py-1.5 bg-[#FFFFFF] border border-[#D0D7DE] hover:bg-[#F6F8FA] text-[#1F2328] rounded-lg text-xs font-medium transition shadow-xs"
              >
                EXPORT REPORT
              </button>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full space-y-6">
            {/* Stats row — 6 cards in a row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-4 border-l-[3px] border-l-[#0969DA] shadow-xs">
                <span className="text-[11px] font-semibold text-[#656D76] uppercase tracking-wider block">Total Intercepted</span>
                <span className="text-2xl font-extrabold text-[#0969DA] font-mono mt-1 block">{(stats.total || 0).toLocaleString()}</span>
                <span className="text-[11px] text-[#9198A1] mt-1 block">All agent tool requests</span>
              </div>

              <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-4 border-l-[3px] border-l-[#1A7F37] shadow-xs">
                <span className="text-[11px] font-semibold text-[#656D76] uppercase tracking-wider block">Allowed</span>
                <span className="text-2xl font-extrabold text-[#1A7F37] font-mono mt-1 block">{(stats.allowed || 0).toLocaleString()}</span>
                <span className="text-[11px] text-[#9198A1] mt-1 block">Passed policy checks</span>
              </div>

              <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-4 border-l-[3px] border-l-[#CF222E] shadow-xs">
                <span className="text-[11px] font-semibold text-[#656D76] uppercase tracking-wider block">Blocked</span>
                <span className="text-2xl font-extrabold text-[#CF222E] font-mono mt-1 block">{(stats.blocked || 0).toLocaleString()}</span>
                <span className="text-[11px] text-[#9198A1] mt-1 block">Destructive actions stopped</span>
              </div>

              <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-4 border-l-[3px] border-l-[#9A6700] shadow-xs">
                <span className="text-[11px] font-semibold text-[#656D76] uppercase tracking-wider block">Redacted</span>
                <span className="text-2xl font-extrabold text-[#9A6700] font-mono mt-1 block">{(stats.redacted || 0).toLocaleString()}</span>
                <span className="text-[11px] text-[#9198A1] mt-1 block">PII & secrets scrubbed</span>
              </div>

              <div className={`bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-4 border-l-[3px] ${blockRate > 20 ? 'border-l-[#CF222E]' : 'border-l-[#656D76]'} shadow-xs`}>
                <span className="text-[11px] font-semibold text-[#656D76] uppercase tracking-wider block">Block Rate</span>
                <span className={`text-2xl font-extrabold font-mono mt-1 block ${blockRate > 20 ? 'text-[#CF222E]' : 'text-[#1F2328]'}`}>
                  {blockRate.toFixed(1)}%
                </span>
                <span className="text-[11px] text-[#9198A1] mt-1 block">Overall threat ratio</span>
              </div>

              {/* Feature 1: COST SAVED card */}
              <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-4 border-l-[3px] border-l-[#1A7F37] shadow-xs">
                <span className="text-[11px] font-semibold text-[#1A7F37] uppercase tracking-wider block">COST SAVED</span>
                <span className="text-2xl font-extrabold text-[#1A7F37] font-mono mt-1 block">${costSavedTotal.toFixed(2)}</span>
                <span className="text-[11px] text-[#9198A1] mt-1 block">blocked costs & compliance risk</span>
              </div>
            </div>

            {/* Two column layout. Left 65%. Right 35%. Gap 16px. */}
            <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4 items-start">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Area chart INTERCEPTION ACTIVITY */}
                <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-[#D0D7DE]">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-[#1F2328]">INTERCEPTION ACTIVITY</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#CF222E]/10 text-[#CF222E] border border-[#CF222E]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#CF222E] animate-ping mr-1"></span>
                        LIVE
                      </span>
                    </div>
                    <span className="text-xs text-[#656D76]">Real-time telemetry</span>
                  </div>

                  <div className="h-64 pt-4">
                    {chartData.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-[#9198A1] text-xs">
                        <Activity className="w-8 h-8 mb-2 opacity-30" />
                        <span>No data yet — connect an agent to see live activity</span>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F6F8FA" />
                          <XAxis dataKey="minute" stroke="#9198A1" fontSize={11} fontFamily="JetBrains Mono" />
                          <YAxis stroke="#9198A1" fontSize={11} fontFamily="JetBrains Mono" />
                          <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #D0D7DE', borderRadius: '6px', fontSize: '12px' }} />
                          <Area type="monotone" dataKey="allow" stackId="1" stroke="#1A7F37" fill="#1A7F37" fillOpacity={0.2} name="Allowed" />
                          <Area type="monotone" dataKey="redact" stackId="1" stroke="#9A6700" fill="#9A6700" fillOpacity={0.2} name="Redacted" />
                          <Area type="monotone" dataKey="block" stackId="1" stroke="#CF222E" fill="#CF222E" fillOpacity={0.2} name="Blocked" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Feature 3: Policy Violation Timeline ("TODAY'S VIOLATIONS") */}
                <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#D0D7DE] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-[#1F2328]">TODAY’S VIOLATIONS</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${todayViolations.length > 0 ? 'bg-[#CF222E] text-white' : 'bg-[#F6F8FA] text-[#656D76] border border-[#D0D7DE]'}`}>
                        {todayViolations.length}
                      </span>
                    </div>
                    <AlertTriangle className="w-4 h-4 text-[#656D76]" />
                  </div>

                  {todayViolations.length === 0 ? (
                    <div className="p-8 text-center text-[#1A7F37] text-xs flex items-center justify-center space-x-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">No violations today</span>
                    </div>
                  ) : (
                    <div className="p-5 max-h-[280px] overflow-y-auto space-y-4">
                      {todayViolations.map((log, idx) => {
                        const isBlock = log.decision === 'BLOCK' || log.decision === 'PENDING';
                        const dotColor = isBlock ? 'bg-[#CF222E]' : 'bg-[#9A6700]';
                        const d = new Date(log.timestamp);
                        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        const description = formatViolationDescription(log);
                        const isLast = idx === todayViolations.length - 1;

                        return (
                          <div key={log.id} className="flex items-start space-x-3 relative">
                            {/* Vertical line connecting dots */}
                            {!isLast && (
                              <div className="absolute left-[7px] top-4 bottom-[-16px] w-[2px] bg-[#D0D7DE]"></div>
                            )}
                            <div className={`w-3.5 h-3.5 rounded-full ${dotColor} shrink-0 mt-0.5 ring-4 ring-white`}></div>
                            <div className="text-xs space-y-0.5 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-[#656D76]">{timeStr}</span>
                                <span className="font-bold font-mono text-[#1F2328]">{log.agentId}</span>
                              </div>
                              <p className="text-[#656D76] leading-relaxed">{description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Audit Log AUDIT LOG */}
                <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#D0D7DE] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-[#1F2328]">AUDIT LOG</span>
                      <span className="text-xs bg-[#F6F8FA] border border-[#D0D7DE] px-2 py-0.5 rounded text-[#656D76] font-mono font-medium">
                        {auditLogs.length} events
                      </span>
                    </div>
                    <button
                      onClick={clearAudit}
                      className="px-3 py-1 bg-[#FFFFFF] border border-[#D0D7DE] hover:bg-[#F6F8FA] text-[#CF222E] rounded-md text-xs font-semibold transition"
                    >
                      CLEAR
                    </button>
                  </div>

                  {auditLogs.length === 0 ? (
                    <div className="p-12 text-center text-[#9198A1] text-xs">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <span>No events yet</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#D0D7DE] max-h-[420px] overflow-y-auto">
                      {auditLogs.map(log => {
                        const isFlashing = flashingEventId === log.id;
                        const isExpanded = expandedLogId === log.id;
                        const isCritical = log.severity === 'CRITICAL';

                        return (
                          <div
                            key={log.id}
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className={`p-4 hover:bg-[#F6F8FA] cursor-pointer transition ${isFlashing ? 'bg-[#DBEAFE]' : ''} ${isCritical ? 'border-l-[3px] border-l-[#CF222E]' : ''}`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-3">
                                <span className={`w-2 h-2 rounded-full ${
                                  log.severity === 'INFO' ? 'bg-[#9198A1]' :
                                  log.severity === 'MEDIUM' ? 'bg-[#9A6700]' :
                                  log.severity === 'HIGH' ? 'bg-[#CF222E]' : 'bg-[#CF222E] animate-ping'
                                }`}></span>
                                <span className="font-mono text-[#656D76]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  log.decision === 'ALLOW' ? 'bg-[#1A7F37]/10 text-[#1A7F37]' :
                                  log.decision === 'REDACT' ? 'bg-[#9A6700]/10 text-[#9A6700]' :
                                  log.decision === 'PENDING' ? 'bg-[#0969DA]/10 text-[#0969DA]' : 'bg-[#CF222E]/10 text-[#CF222E]'
                                }`}>
                                  {log.decision}
                                </span>
                                <span className="font-mono font-bold text-[#1F2328]">{log.toolName}</span>
                                <span className="font-mono text-[#9198A1]">({log.agentId})</span>
                              </div>
                              <span className="font-mono text-[11px] text-[#9198A1]">{log.traceHash}</span>
                            </div>

                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-[#D0D7DE] space-y-2 text-xs">
                                <p className="text-[#656D76]"><strong className="text-[#1F2328]">Message:</strong> {log.message}</p>
                                {log.findings && log.findings.length > 0 && (
                                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                    <span className="text-[#656D76] font-semibold">Findings:</span>
                                    {log.findings.map((f, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-[#F6F8FA] border border-[#D0D7DE] rounded text-[10px] font-mono font-bold text-[#9A6700]">
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div>
                                  <span className="text-[#656D76] font-semibold block mb-1">Tool Arguments:</span>
                                  <pre className="p-2.5 bg-[#F6F8FA] border border-[#D0D7DE] rounded font-mono text-[11px] text-[#1F2328] overflow-x-auto">
                                    {JSON.stringify(log.toolArgs, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Panel 1 — PENDING APPROVALS */}
                <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#D0D7DE]">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-[#1F2328]">PENDING APPROVALS</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${approvals.length > 0 ? 'bg-[#CF222E] text-white' : 'bg-[#F6F8FA] text-[#656D76] border border-[#D0D7DE]'}`}>
                        {approvals.length}
                      </span>
                    </div>
                    <Clock className="w-4 h-4 text-[#656D76]" />
                  </div>

                  {approvals.length === 0 ? (
                    <div className="py-8 text-center text-[#9198A1] text-xs">
                      <span>No pending approvals</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {approvals.map(appr => (
                        <div key={appr.id} className="p-3.5 bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold font-mono text-[#1F2328]">{appr.agentId}</span>
                            <span className="text-[11px] text-[#9198A1] font-mono">{new Date(appr.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-xs font-mono font-bold text-[#0969DA]">{appr.toolName}</div>
                          <pre className="p-2 bg-[#FFFFFF] border border-[#D0D7DE] rounded font-mono text-[10px] text-[#656D76] overflow-x-auto max-h-20">
                            {JSON.stringify(appr.toolArgs, null, 2)}
                          </pre>
                          <div className="flex items-center justify-end space-x-2 pt-1">
                            <button
                              onClick={() => handleApprove(appr.id)}
                              className="px-3 py-1 bg-[#1A7F37] hover:bg-[#166d30] text-white rounded-md text-xs font-semibold transition"
                            >
                              APPROVE
                            </button>
                            <button
                              onClick={() => handleDeny(appr.id)}
                              className="px-3 py-1 bg-[#CF222E] hover:bg-[#b81e28] text-white rounded-md text-xs font-semibold transition"
                            >
                              DENY
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Panel 2 — ACTIVE AGENTS (with Feature 2: Risk Score) */}
                <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#D0D7DE]">
                    <span className="font-bold text-sm text-[#1F2328]">ACTIVE AGENTS</span>
                    <Cpu className="w-4 h-4 text-[#656D76]" />
                  </div>

                  {agents.length === 0 ? (
                    <div className="py-8 text-center text-[#9198A1] text-xs">
                      <span>No agents connected yet</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {agents.map(agent => {
                        const riskScore = calculateRiskScore(agent);
                        const riskBadge = getRiskBadge(riskScore);

                        return (
                          <div key={agent.agentId} className="p-3.5 bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg flex items-center justify-between text-xs">
                            <div className="space-y-1.5">
                              <div className="flex items-center space-x-2">
                                <span className={`w-2 h-2 rounded-full ${agent.locked ? 'bg-[#CF222E]' : 'bg-[#1A7F37] animate-pulse'}`}></span>
                                <span className="font-bold font-mono text-[#1F2328]">{agent.agentId}</span>
                              </div>
                              <div className="text-[11px] text-[#656D76] font-mono">
                                Calls/min: {agent.callsThisMinute} · USD: ${agent.usdSpent.toFixed(4)}
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${agent.locked ? 'bg-[#CF222E]/10 text-[#CF222E]' : 'bg-[#1A7F37]/10 text-[#1A7F37]'}`}>
                                  {agent.locked ? 'LOCKED' : 'ACTIVE'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${riskBadge.bg}`}>
                                  {riskScore} {riskBadge.label}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                title="Unlock and reset"
                                onClick={() => handleResetAgent(agent.agentId)}
                                className="px-2.5 py-1 bg-[#FFFFFF] border border-[#D0D7DE] hover:bg-[#F6F8FA] text-[#656D76] rounded text-xs font-medium transition"
                              >
                                RESET
                              </button>
                              <button
                                title="Manually lock"
                                onClick={() => handleLockAgent(agent.agentId)}
                                className="px-2.5 py-1 bg-[#CF222E]/10 border border-[#CF222E]/30 hover:bg-[#CF222E]/20 text-[#CF222E] rounded text-xs font-semibold transition"
                              >
                                LOCK
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Panel 3 — ACTIVE POLICIES */}
                <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#D0D7DE]">
                    <span className="font-bold text-sm text-[#1F2328]">ACTIVE POLICIES</span>
                    <Shield className="w-4 h-4 text-[#656D76]" />
                  </div>

                  <div className="divide-y divide-[#D0D7DE] text-xs">
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-[#656D76]">Budget/hour</span>
                      <span className="font-mono font-bold text-[#0969DA]">$5.00</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-[#656D76]">Tokens/minute</span>
                      <span className="font-mono font-bold text-[#0969DA]">5,000</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-[#656D76]">Calls/minute</span>
                      <span className="font-mono font-bold text-[#0969DA]">60</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-[#656D76]">Tool calls/minute</span>
                      <span className="font-mono font-bold text-[#0969DA]">20</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-[#656D76]">Blocklisted tools</span>
                      <span className="font-mono font-bold text-[#CF222E]">8</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-[#656D76]">PII patterns</span>
                      <span className="font-mono font-bold text-[#9A6700]">5</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-[#656D76]">Approval-required</span>
                      <span className="font-mono font-bold text-[#8250DF]">5</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ROUTE 3 — Connect Agent /connect */}
      {currentPath === '/connect' && (
        <div className="flex-1 flex flex-col bg-[#FFFFFF]">
          <header className="h-14 bg-[#FFFFFF] border-b border-[#D0D7DE] px-6 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-7 h-7 rounded-lg bg-[#0969DA] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                W
              </div>
              <span className="font-bold text-base text-[#1F2328] tracking-tight">WorkerZero</span>
            </div>

            <nav className="flex items-center space-x-6 text-sm font-medium h-full">
              <button onClick={() => navigate('/dashboard')} className="h-full flex items-center text-[#656D76] hover:text-[#1F2328] px-2 transition">
                DASHBOARD
              </button>
              <button onClick={() => navigate('/connect')} className="h-full flex items-center text-[#1F2328] border-b-2 border-[#0969DA] px-2 font-semibold">
                CONNECT AGENT
              </button>
              <button onClick={() => navigate('/integrate')} className="h-full flex items-center text-[#656D76] hover:text-[#1F2328] px-2 transition">
                INTEGRATE
              </button>
            </nav>

            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-1.5 bg-[#0969DA] text-white rounded-lg text-xs font-semibold hover:bg-[#0860c4] transition"
            >
              Open Dashboard →
            </button>
          </header>

          <main className="max-w-[720px] mx-auto px-6 py-12 flex-1 w-full space-y-8">
            <div>
              <h1 className="text-3xl font-extrabold text-[#1F2328] tracking-tight">Connect Your Agent in 60 Seconds</h1>
              <p className="mt-2 text-sm text-[#656D76]">One function. Any agent. Full protection.</p>
            </div>

            {/* Step 1 */}
            <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-[#0969DA] text-white font-bold text-xs flex items-center justify-center">1</div>
                <h3 className="font-bold text-base text-[#1F2328]">Copy your endpoint</h3>
              </div>
              <div className="flex items-center space-x-2 bg-[#F6F8FA] p-3 rounded-md border border-[#D0D7DE]">
                <code className="text-xs font-mono text-[#1F2328] flex-1 break-all">{origin}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(origin);
                    setCopiedEndpoint(true);
                    setTimeout(() => setCopiedEndpoint(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-[#FFFFFF] border border-[#D0D7DE] rounded text-xs font-semibold text-[#1F2328] hover:bg-[#F6F8FA] transition flex items-center space-x-1 shrink-0"
                >
                  {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-[#1A7F37]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEndpoint ? 'Copied!' : 'COPY'}</span>
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-[#0969DA] text-white font-bold text-xs flex items-center justify-center">2</div>
                <h3 className="font-bold text-base text-[#1F2328]">Copy this one function</h3>
              </div>
              <p className="text-xs font-bold text-[#1F2328]">Copy this into your agent file. That’s the entire integration.</p>

              <div className="flex items-center space-x-2 border-b border-[#D0D7DE] pb-3">
                <button
                  onClick={() => setCodeLang('python')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${codeLang === 'python' ? 'bg-[#1F2328] text-white' : 'bg-[#F6F8FA] text-[#656D76]'}`}
                >
                  Python
                </button>
                <button
                  onClick={() => setCodeLang('javascript')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${codeLang === 'javascript' ? 'bg-[#1F2328] text-white' : 'bg-[#F6F8FA] text-[#656D76]'}`}
                >
                  JavaScript
                </button>
              </div>

              <div className="relative">
                <pre className="text-xs font-mono bg-[#0D1117] text-[#E6EDF3] p-4 rounded-lg overflow-x-auto leading-relaxed">
                  {codeLang === 'python' ? pythonSnippet : jsSnippet}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(codeLang === 'python' ? pythonSnippet : jsSnippet);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-[#21262D] border border-[#30363D] rounded text-xs font-semibold text-[#C9D1D9] hover:bg-[#30363D] transition flex items-center space-x-1"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'COPY'}</span>
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-[#D0D7DE] rounded-lg p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-[#0969DA] text-white font-bold text-xs flex items-center justify-center">3</div>
                <h3 className="font-bold text-base text-[#1F2328]">Call it before every tool</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#CF222E]/5 border border-[#CF222E]/20 rounded-lg p-4 space-y-2">
                  <span className="text-xs font-bold text-[#CF222E] uppercase">Before WorkerZero</span>
                  <pre className="text-xs font-mono bg-[#FFFFFF] p-3 rounded border border-[#CF222E]/20 text-[#1F2328] overflow-x-auto">
{`# Direct unmonitored call
result = drop_table("customers_prod")`}
                  </pre>
                </div>

                <div className="bg-[#1A7F37]/5 border border-[#1A7F37]/20 rounded-lg p-4 space-y-2">
                  <span className="text-xs font-bold text-[#1A7F37] uppercase">With WorkerZero</span>
                  <pre className="text-xs font-mono bg-[#FFFFFF] p-3 rounded border border-[#1A7F37]/20 text-[#1F2328] overflow-x-auto">
{`# Intercepted & secured by WorkerZero
safe_args = wz("drop_table", {"table": "customers_prod"})
result = drop_table(safe_args)`}
                  </pre>
                </div>
              </div>

              <p className="text-xs font-medium text-[#656D76] text-center pt-2">
                One line added. Every tool call is now intercepted, evaluated, and logged.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white border border-[#D0D7DE] rounded-lg p-6 shadow-xs flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-[#0969DA] text-white font-bold text-xs flex items-center justify-center">4</div>
                <div>
                  <h3 className="font-bold text-base text-[#1F2328]">Watch it live</h3>
                  <p className="text-xs text-[#656D76]">Open your dashboard to see every agent action in real time.</p>
                </div>
              </div>

              <button
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 bg-[#0969DA] text-white rounded-lg text-xs font-semibold hover:bg-[#0860c4] transition"
              >
                Open Dashboard →
              </button>
            </div>
          </main>
        </div>
      )}

      {/* ROUTE 4 — Integrate /integrate */}
      {currentPath === '/integrate' && (
        <div className="flex-1 flex flex-col bg-[#FFFFFF]">
          <header className="h-14 bg-[#FFFFFF] border-b border-[#D0D7DE] px-6 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-7 h-7 rounded-lg bg-[#0969DA] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                W
              </div>
              <span className="font-bold text-base text-[#1F2328] tracking-tight">WorkerZero</span>
            </div>

            <nav className="flex items-center space-x-6 text-sm font-medium h-full">
              <button onClick={() => navigate('/dashboard')} className="h-full flex items-center text-[#656D76] hover:text-[#1F2328] px-2 transition">
                DASHBOARD
              </button>
              <button onClick={() => navigate('/connect')} className="h-full flex items-center text-[#656D76] hover:text-[#1F2328] px-2 transition">
                CONNECT AGENT
              </button>
              <button onClick={() => navigate('/integrate')} className="h-full flex items-center text-[#1F2328] border-b-2 border-[#0969DA] px-2 font-semibold">
                INTEGRATE
              </button>
            </nav>

            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-1.5 bg-[#0969DA] text-white rounded-lg text-xs font-semibold hover:bg-[#0860c4] transition"
            >
              Open Dashboard →
            </button>
          </header>

          <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full space-y-12">
            <div>
              <h1 className="text-3xl font-extrabold text-[#1F2328] tracking-tight">How WorkerZero Works</h1>
              <p className="mt-2 text-sm text-[#656D76]">If your agent can make an HTTP POST request, it works with WorkerZero.</p>
            </div>

            {/* Three steps flow */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#0969DA]/10 text-[#0969DA] font-bold flex items-center justify-center mx-auto">1</div>
                <h3 className="font-bold text-sm text-[#1F2328]">Agent tries a tool</h3>
                <p className="text-xs text-[#656D76]">Agent invokes a database query, API call, or transaction execution.</p>
              </div>
              <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#9A6700]/10 text-[#9A6700] font-bold flex items-center justify-center mx-auto">2</div>
                <h3 className="font-bold text-sm text-[#1F2328]">WorkerZero evaluates in &lt; 5ms</h3>
                <p className="text-xs text-[#656D76]">Runs deterministic rules, PII pattern scanners, and rate limiters.</p>
              </div>
              <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#1A7F37]/10 text-[#1A7F37] font-bold flex items-center justify-center mx-auto">3</div>
                <h3 className="font-bold text-sm text-[#1F2328]">Decision returned</h3>
                <p className="text-xs text-[#656D76]">Instantly allows, redacts PII, pauses for human approval, or blocks.</p>
              </div>
            </div>

            {/* Four decision cards */}
            <div className="space-y-4">
              <h3 className="font-bold text-base text-[#1F2328]">Gateway Decision States</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#1A7F37]/5 border border-[#1A7F37]/20 rounded-lg p-5 space-y-2">
                  <span className="px-2 py-0.5 bg-[#1A7F37] text-white rounded text-xs font-bold font-mono">ALLOW</span>
                  <p className="text-xs text-[#656D76] leading-relaxed">Agent action passed all security policies successfully and executes without modification.</p>
                </div>
                <div className="bg-[#CF222E]/5 border border-[#CF222E]/20 rounded-lg p-5 space-y-2">
                  <span className="px-2 py-0.5 bg-[#CF222E] text-white rounded text-xs font-bold font-mono">BLOCK</span>
                  <p className="text-xs text-[#656D76] leading-relaxed">Destructive tool calls, runaway loops, or budget overruns are immediately stopped with HTTP 403.</p>
                </div>
                <div className="bg-[#9A6700]/5 border border-[#9A6700]/20 rounded-lg p-5 space-y-2">
                  <span className="px-2 py-0.5 bg-[#9A6700] text-white rounded text-xs font-bold font-mono">REDACT</span>
                  <p className="text-xs text-[#656D76] leading-relaxed">Sensitive PII, SSNs, phone numbers, and API keys are automatically scrubbed inline.</p>
                </div>
                <div className="bg-[#0969DA]/5 border border-[#0969DA]/20 rounded-lg p-5 space-y-2">
                  <span className="px-2 py-0.5 bg-[#0969DA] text-white rounded text-xs font-bold font-mono">PENDING</span>
                  <p className="text-xs text-[#656D76] leading-relaxed">High-risk actions pause and wait for human operator sign-off before executing.</p>
                </div>
              </div>
            </div>

            {/* Framework badges row */}
            <div className="space-y-4">
              <h3 className="font-bold text-base text-[#1F2328]">Compatible Agent Frameworks</h3>
              <div className="flex flex-wrap gap-3">
                {['OpenAI Agents', 'Google Gemini', 'Anthropic Claude', 'LangChain', 'CrewAI', 'AutoGen', 'Custom HTTP Agent'].map((fw, idx) => (
                  <span key={idx} className="px-3.5 py-2 bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg text-xs font-semibold text-[#1F2328] shadow-xs">
                    {fw}
                  </span>
                ))}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
