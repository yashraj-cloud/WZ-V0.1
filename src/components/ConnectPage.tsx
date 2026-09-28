import React, { useState } from 'react';
import { ArrowRight, Check, Copy, Download, Play, Loader2 } from 'lucide-react';

interface ConnectPageProps {
  onNavigate: (path: string) => void;
}

interface TestResult {
  decision: string;
  reason: string;
  severity: string;
  message: string;
  traceHash: string;
  approvalId?: string;
}

const TOOL_OPTIONS = [
  'search_documents',
  'send_email',
  'delete_database',
  'export_data',
  'transfer_funds',
];

export default function ConnectPage({ onNavigate }: ConnectPageProps) {
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'http://localhost:3000';

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'python' | 'javascript' | 'nodejs'>('python');
  const [copiedSdk, setCopiedSdk] = useState(false);

  // Live connection tester state
  const [agentId, setAgentId] = useState('my-agent');
  const [toolName, setToolName] = useState('search_documents');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const pythonCode = `import requests, time

WORKERZERO = "${origin}"

def workerzero_check(tool_name, tool_args, agent_id="my-agent"):
    r = requests.post(f"{WORKERZERO}/intercept", json={
        "agentId": agent_id,
        "toolName": tool_name,
        "toolArgs": tool_args,
        "tokenDelta": 150,
        "usdDelta": 0.0015
    }, timeout=10)
    result = r.json()
    decision = result.get("decision")
    
    if decision == "BLOCK":
        raise PermissionError(f"WorkerZero blocked: {result.get('message')}")
    
    if decision == "REDACT":
        return result.get("sanitizedArgs", tool_args)
    
    if decision == "PENDING":
        approval_id = result.get("approvalId")
        print(f"Waiting for human approval... (check your WorkerZero dashboard)")
        for _ in range(30):
            time.sleep(2)
            status = requests.get(f"{WORKERZERO}/approvals/{approval_id}/status").json().get("status")
            if status == "approved":
                return tool_args
            elif status == "denied":
                raise PermissionError("WorkerZero: Human denied this action")
        raise TimeoutError("WorkerZero: No human response in 60 seconds")
    
    return tool_args

# Usage — call before every tool execution:
# safe_args = workerzero_check("send_email", {"to": "ceo@company.com"})`;

  const javascriptCode = `const WORKERZERO = "${origin}";

async function workerzeroCheck(toolName, toolArgs, agentId = "my-agent") {
  const res = await fetch(\`\${WORKERZERO}/intercept\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, toolName, toolArgs, tokenDelta: 150, usdDelta: 0.0015 })
  });
  const result = await res.json();

  if (result.decision === "BLOCK")
    throw new Error(\`WorkerZero blocked: \${result.message}\`);

  if (result.decision === "REDACT")
    return result.sanitizedArgs || toolArgs;

  if (result.decision === "PENDING") {
    const approvalId = result.approvalId;
    console.log("Waiting for human approval on WorkerZero dashboard...");
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const { status } = await fetch(\`\${WORKERZERO}/approvals/\${approvalId}/status\`).then(r => r.json());
      if (status === "approved") return toolArgs;
      if (status === "denied") throw new Error("WorkerZero: Human denied this action");
    }
    throw new Error("WorkerZero: Timeout waiting for human approval");
  }

  return toolArgs;
}

// Usage — call before every tool execution:
// const safeArgs = await workerzeroCheck("send_email", { to: "ceo@company.com" });`;

  const nodejsCode = `const fetch = require("node-fetch"); // npm install node-fetch

${javascriptCode}`;

  const getCurrentSdkCode = () => {
    switch (activeTab) {
      case 'python':
        return pythonCode;
      case 'javascript':
        return javascriptCode;
      case 'nodejs':
        return nodejsCode;
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(origin);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopySdk = () => {
    navigator.clipboard.writeText(getCurrentSdkCode());
    setCopiedSdk(true);
    setTimeout(() => setCopiedSdk(false), 2000);
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestError(null);

    try {
      const res = await fetch('/intercept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentId.trim() || 'my-agent',
          toolName,
          toolArgs: { source: 'live_connection_test', timestamp: new Date().toISOString() },
          tokenDelta: 150,
          usdDelta: 0.0015,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setTestError(data.error);
        setTestResult(null);
      } else {
        setTestResult({
          decision: data.decision || 'UNKNOWN',
          reason: data.reason || '—',
          severity: data.severity || 'INFO',
          message: data.message || '—',
          traceHash: data.traceHash || '—',
          approvalId: data.approvalId,
        });
      }
    } catch (err: any) {
      setTestError(err.message || 'Failed to reach /intercept endpoint.');
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  };

  const renderDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'ALLOW':
        return (
          <span className="px-3 py-1 rounded-[6px] text-xs font-bold font-mono tracking-wider bg-[#00e5a0]/15 text-[#00e5a0] border border-[#00e5a0]/35">
            ALLOW
          </span>
        );
      case 'BLOCK':
        return (
          <span className="px-3 py-1 rounded-[6px] text-xs font-bold font-mono tracking-wider bg-[#ff4d6a]/15 text-[#ff4d6a] border border-[#ff4d6a]/35">
            BLOCK
          </span>
        );
      case 'REDACT':
        return (
          <span className="px-3 py-1 rounded-[6px] text-xs font-bold font-mono tracking-wider bg-[#ffb547]/15 text-[#ffb547] border border-[#ffb547]/35">
            REDACT
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-[6px] text-xs font-bold font-mono tracking-wider bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/35">
            PENDING
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-[6px] text-xs font-bold font-mono tracking-wider bg-[#212435] text-[#f0f2f8] border border-[#2a2d3e]">
            {decision}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#f0f2f8] font-sans antialiased flex flex-col justify-between selection:bg-[#00d4ff]/20 selection:text-[#00d4ff]">
      {/* 56px Header matching App.tsx */}
      <header className="h-[56px] sticky top-0 z-40 bg-[#1a1d27] border-b border-[#2a2d3e] px-6 flex items-center justify-between">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between h-full">
          {/* Left: Logo 32px gradient square, WorkerZero 15px bold white, divider, Runtime Gateway 12px muted */}
          <div
            onClick={() => onNavigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
            title="WorkerZero Home"
          >
            <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-[#00d4ff] to-[#7c6af7] flex items-center justify-center text-white font-bold font-mono text-sm tracking-wide shadow-sm group-hover:opacity-90 transition-opacity">
              W
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-[15px] text-white tracking-tight font-sans">
                WorkerZero
              </span>
              <div className="h-4 w-[1px] bg-[#2a2d3e]" />
              <span className="text-[12px] text-[#4a5070] font-sans hidden sm:inline">
                Runtime Gateway
              </span>
            </div>
          </div>

          {/* Center: Navigation Links */}
          <nav className="flex items-center gap-6 h-full">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#8b92a8] hover:text-[#f0f2f8] transition-colors cursor-pointer border-b-2 border-transparent"
            >
              DASHBOARD
            </button>
            <button
              onClick={() => onNavigate('/integrate')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#8b92a8] hover:text-[#f0f2f8] transition-colors cursor-pointer border-b-2 border-transparent"
            >
              INTEGRATE
            </button>
            <button
              onClick={() => onNavigate('/connect')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#00d4ff] border-b-2 border-[#00d4ff] cursor-pointer"
            >
              CONNECT AGENT
            </button>
          </nav>

          {/* Right: Download zip & Return to dashboard button */}
          <div className="flex items-center gap-3">
            <a
              href="/download-project.zip"
              download="workerzero-project.zip"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[#2a2d3e] hover:border-[#00d4ff] text-[#8b92a8] hover:text-[#00d4ff] text-xs font-medium font-sans transition-colors cursor-pointer bg-transparent"
              title="Download complete WorkerZero project as ZIP (workerzero-project.zip)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD ZIP</span>
            </a>
            <button
              onClick={() => onNavigate('/dashboard')}
              className="px-3.5 py-1.5 rounded-[6px] bg-[#212435] hover:bg-[#282b3d] text-[#00d4ff] border border-[#2a2d3e] hover:border-[#00d4ff]/40 text-xs font-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>OPEN CONSOLE</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-12">
        {/* Page Title & Subtitle */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold font-sans text-white tracking-tight">
            Connect Your Agent
          </h1>
          <p className="text-base text-[#8b92a8] font-sans">
            One function. Any agent. Full protection.
          </p>
        </div>

        {/* Section 1 — Your WorkerZero URL */}
        <section className="space-y-3">
          <label className="block text-sm font-medium text-[#8b92a8] font-sans">
            Your WorkerZero Endpoint — paste this into your agent.
          </label>
          <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 wz-card-shadow">
            <div className="flex-1 bg-[#0a0c14] border border-[#2a2d3e] rounded-[8px] px-4 py-3.5 font-mono text-sm sm:text-base text-[#00d4ff] select-all overflow-x-auto whitespace-nowrap">
              {origin}
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-5 py-3.5 rounded-[8px] bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0f1117] font-sans font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>COPY</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Section 2 — One-click copy SDK */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white font-sans">
              One-Click Copy SDK
            </h2>
            <span className="text-xs text-[#8b92a8] font-sans">
              Handles ALLOW, BLOCK, REDACT &amp; PENDING
            </span>
          </div>

          <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] overflow-hidden wz-card-shadow">
            {/* Tabs & Copy Header */}
            <div className="bg-[#151822] border-b border-[#2a2d3e] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('python')}
                  className={`px-4 py-3 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'python'
                      ? 'border-[#00d4ff] text-[#00d4ff]'
                      : 'border-transparent text-[#8b92a8] hover:text-white'
                  }`}
                >
                  Python
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('javascript')}
                  className={`px-4 py-3 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'javascript'
                      ? 'border-[#00d4ff] text-[#00d4ff]'
                      : 'border-transparent text-[#8b92a8] hover:text-white'
                  }`}
                >
                  JavaScript
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('nodejs')}
                  className={`px-4 py-3 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'nodejs'
                      ? 'border-[#00d4ff] text-[#00d4ff]'
                      : 'border-transparent text-[#8b92a8] hover:text-white'
                  }`}
                >
                  Node.js
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopySdk}
                className="px-3.5 py-1.5 rounded-[6px] bg-[#212435] hover:bg-[#282b3d] border border-[#2a2d3e] hover:border-[#00d4ff]/40 text-xs font-mono font-semibold text-[#f0f2f8] hover:text-[#00d4ff] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {copiedSdk ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00e5a0]" />
                    <span className="text-[#00e5a0]">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Display */}
            <div className="p-5 bg-[#0a0c14]">
              <pre className="text-xs sm:text-[13px] font-mono leading-relaxed text-[#f0f2f8] overflow-x-auto">
                <code>{getCurrentSdkCode()}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Section 3 — Test your connection */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white font-sans">
              Test Your Connection
            </h2>
            <span className="text-xs text-[#8b92a8] font-sans">
              Live POST /intercept verification
            </span>
          </div>

          <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-6 space-y-6 wz-card-shadow">
            <form
              onSubmit={handleTestConnection}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
            >
              {/* Agent ID Input */}
              <div className="md:col-span-5 space-y-2">
                <label
                  htmlFor="connect-agent-id"
                  className="block text-xs font-medium text-[#8b92a8] font-sans"
                >
                  Agent ID
                </label>
                <input
                  id="connect-agent-id"
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="my-agent"
                  className="w-full bg-[#0a0c14] border border-[#2a2d3e] focus:border-[#00d4ff] rounded-[8px] px-3.5 py-2.5 text-sm font-mono text-white placeholder-[#4a5070] outline-none transition-colors"
                />
              </div>

              {/* Tool Name Dropdown */}
              <div className="md:col-span-4 space-y-2">
                <label
                  htmlFor="connect-tool-name"
                  className="block text-xs font-medium text-[#8b92a8] font-sans"
                >
                  Tool Name
                </label>
                <select
                  id="connect-tool-name"
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                  className="w-full bg-[#0a0c14] border border-[#2a2d3e] focus:border-[#00d4ff] rounded-[8px] px-3.5 py-2.5 text-sm font-mono text-white outline-none transition-colors cursor-pointer"
                >
                  {TOOL_OPTIONS.map((tool) => (
                    <option key={tool} value={tool} className="bg-[#0a0c14] text-white">
                      {tool}
                    </option>
                  ))}
                </select>
              </div>

              {/* Big TEST NOW Button */}
              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={testing}
                  className="w-full py-2.5 px-5 rounded-[8px] bg-[#00d4ff] hover:bg-[#00d4ff]/90 disabled:opacity-50 text-[#0f1117] font-sans font-bold text-sm tracking-wide uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 h-[42px]"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>TESTING...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>TEST NOW</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Instant Result Display */}
            {testError && (
              <div className="bg-[#ff4d6a]/10 border border-[#ff4d6a]/30 rounded-[8px] p-4 text-xs font-mono text-[#ff4d6a]">
                Error: {testError}
              </div>
            )}

            {testResult && (
              <div className="bg-[#0a0c14] border border-[#2a2d3e] rounded-[8px] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#2a2d3e]">
                  <div className="flex items-center gap-3">
                    {renderDecisionBadge(testResult.decision)}
                    <span className="text-xs font-mono font-semibold text-white">
                      {testResult.reason}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#8b92a8]">
                    Trace Hash:{' '}
                    <span className="text-[#00d4ff]">{testResult.traceHash}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[#4a5070] font-sans block">Message</span>
                    <p className="font-mono text-[#f0f2f8]">{testResult.message}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#4a5070] font-sans block">Reason Code</span>
                    <p className="font-mono text-[#8b92a8]">
                      {testResult.reason} ({testResult.severity})
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 4 — What happens to each decision */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white font-sans">
            What Happens to Each Decision
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* ALLOW card green */}
            <div className="relative bg-[#1a1d27] border border-[#00e5a0]/30 rounded-[10px] p-5 space-y-3 wz-card-shadow overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#00e5a0]" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-[#00e5a0]">
                  ALLOW
                </span>
                <span className="h-2 w-2 rounded-full bg-[#00e5a0]" />
              </div>
              <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                Tool executes normally. Event logged to audit trail.
              </p>
            </div>

            {/* BLOCK card red */}
            <div className="relative bg-[#1a1d27] border border-[#ff4d6a]/30 rounded-[10px] p-5 space-y-3 wz-card-shadow overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#ff4d6a]" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-[#ff4d6a]">
                  BLOCK
                </span>
                <span className="h-2 w-2 rounded-full bg-[#ff4d6a]" />
              </div>
              <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                Tool is stopped. Agent receives PermissionError. Event logged as CRITICAL or HIGH.
              </p>
            </div>

            {/* REDACT card amber */}
            <div className="relative bg-[#1a1d27] border border-[#ffb547]/30 rounded-[10px] p-5 space-y-3 wz-card-shadow overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#ffb547]" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-[#ffb547]">
                  REDACT
                </span>
                <span className="h-2 w-2 rounded-full bg-[#ffb547]" />
              </div>
              <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                PII stripped from args. Tool executes with clean data. Original args never leave your system.
              </p>
            </div>

            {/* PENDING card cyan */}
            <div className="relative bg-[#1a1d27] border border-[#00d4ff]/30 rounded-[10px] p-5 space-y-3 wz-card-shadow overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#00d4ff]" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wider text-[#00d4ff]">
                  PENDING
                </span>
                <span className="h-2 w-2 rounded-full bg-[#00d4ff]" />
              </div>
              <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                Human review required. Agent waits up to 60 seconds. You approve or deny from the dashboard.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-[#2a2d3e] bg-[#1a1d27]/50 py-6 px-6 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#4a5070] font-sans">
          <span>WorkerZero Runtime Security Gateway</span>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="text-[#00d4ff] hover:underline cursor-pointer font-medium"
          >
            Return to Live Dashboard →
          </button>
        </div>
      </footer>
    </div>
  );
}
