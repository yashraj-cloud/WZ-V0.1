import React, { useState } from 'react';
import { ArrowRight, Check, Copy, Download } from 'lucide-react';

interface ConnectPageProps {
  onNavigate: (path: string) => void;
}

export default function ConnectPage({ onNavigate }: ConnectPageProps) {
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'http://localhost:3000';

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'python' | 'javascript'>('python');
  const [copiedSdk, setCopiedSdk] = useState(false);

  const pythonCode = `import requests, time

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
        print(f"Waiting for human approval on your dashboard...")
        for _ in range(30):
            time.sleep(2)
            s = requests.get(f"${origin}/approvals/{r['approvalId']}/status").json()["status"]
            if s == "approved": return tool_args
            if s == "denied": raise PermissionError("Denied by human")

    return tool_args`;

  const javascriptCode = `async function wz(toolName, toolArgs) {
  const r = await fetch("${origin}/intercept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "my-agent", toolName, toolArgs, tokenDelta: 150, usdDelta: 0.0015 })
  }).then(r => r.json());

  if (r.decision === "BLOCK") throw new Error(r.message);
  if (r.decision === "REDACT") return r.sanitizedArgs;
  if (r.decision === "PENDING") {
    console.log("Waiting for human approval...");
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const s = await fetch(\`${origin}/approvals/\${r.approvalId}/status\`).then(r => r.json());
      if (s.status === "approved") return toolArgs;
      if (s.status === "denied") throw new Error("Denied by human");
    }
  }
  return toolArgs;
}`;

  const getCurrentSdkCode = () => {
    switch (activeTab) {
      case 'python':
        return pythonCode;
      case 'javascript':
        return javascriptCode;
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

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3] font-sans antialiased flex flex-col justify-between">
      {/* Header */}
      <header className="h-[56px] sticky top-0 z-40 bg-[#161B22] border-b border-[#30363D] px-6 flex items-center justify-between">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between h-full">
          <div
            onClick={() => onNavigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
            title="WorkerZero Home"
          >
            <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-[#2F81F7] to-[#BC8CFF] flex items-center justify-center text-white font-bold font-mono text-sm tracking-wide shadow-sm">
              W
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-[15px] text-[#E6EDF3] tracking-tight font-sans">
                WorkerZero
              </span>
              <div className="h-4 w-[1px] bg-[#30363D]" />
              <span className="text-[12px] text-[#484F58] font-sans hidden sm:inline">
                Runtime Gateway
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-6 h-full">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#8B949E] hover:text-[#E6EDF3] transition-colors cursor-pointer border-b-2 border-transparent"
            >
              DASHBOARD
            </button>
            <button
              onClick={() => onNavigate('/integrate')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#8B949E] hover:text-[#E6EDF3] transition-colors cursor-pointer border-b-2 border-transparent"
            >
              INTEGRATE
            </button>
            <button
              onClick={() => onNavigate('/connect')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#2F81F7] border-b-2 border-[#2F81F7] cursor-pointer"
            >
              CONNECT AGENT
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="/download-project.zip"
              download="workerzero-project.zip"
              className="wz-btn-secondary px-3 py-1.5 text-xs font-medium font-sans transition-colors cursor-pointer flex items-center gap-1.5"
              title="Download ZIP"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD ZIP</span>
            </a>
            <button
              onClick={() => onNavigate('/dashboard')}
              className="wz-btn-primary px-3.5 py-1.5 text-xs font-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>OPEN DASHBOARD</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 space-y-12">
        {/* Page Title */}
        <div className="space-y-2 text-center max-w-xl mx-auto">
          <h1 className="text-3xl font-bold font-sans text-[#E6EDF3] tracking-tight">
            Connect Your Agent in Under 60 Seconds
          </h1>
          <p className="text-sm text-[#8B949E] font-sans">
            Follow these four simple steps to put your AI agent under complete runtime control.
          </p>
        </div>

        {/* Step 1 */}
        <section className="bg-[#161B22] border border-[#30363D] rounded-[6px] p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#2F81F7]/15 border border-[#2F81F7]/30 text-[#2F81F7] font-mono text-xs font-bold flex items-center justify-center">
              1
            </div>
            <h2 className="text-base font-bold text-[#E6EDF3] font-sans">
              Copy your endpoint
            </h2>
          </div>
          <p className="text-xs text-[#8B949E] font-sans">
            Your WorkerZero runtime gateway URL:
          </p>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-[6px] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1 font-mono text-xs sm:text-sm text-[#2F81F7] select-all overflow-x-auto whitespace-nowrap">
              {origin}
            </div>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="wz-btn-secondary px-4 py-2 text-xs font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#3FB950]" />
                  <span className="text-[#3FB950]">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Step 2 */}
        <section className="bg-[#161B22] border border-[#30363D] rounded-[6px] p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#2F81F7]/15 border border-[#2F81F7]/30 text-[#2F81F7] font-mono text-xs font-bold flex items-center justify-center">
              2
            </div>
            <h2 className="text-base font-bold text-[#E6EDF3] font-sans">
              Copy this one function
            </h2>
          </div>

          <p className="text-xs font-sans text-[#E6EDF3] font-bold">
            Copy this function into your agent file. That’s the entire integration.
          </p>

          <div className="border border-[#30363D] rounded-[6px] overflow-hidden">
            <div className="bg-[#21262D] border-b border-[#30363D] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('python')}
                  className={`px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'python'
                      ? 'border-[#2F81F7] text-[#2F81F7]'
                      : 'border-transparent text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}
                >
                  Python
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('javascript')}
                  className={`px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'javascript'
                      ? 'border-[#2F81F7] text-[#2F81F7]'
                      : 'border-transparent text-[#8B949E] hover:text-[#E6EDF3]'
                  }`}
                >
                  JavaScript
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopySdk}
                className="wz-btn-secondary px-3 py-1 text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedSdk ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#3FB950]" />
                    <span className="text-[#3FB950]">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 bg-[#0D1117]">
              <pre className="text-xs font-mono leading-relaxed text-[#E6EDF3] overflow-x-auto">
                <code>{getCurrentSdkCode()}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section className="bg-[#161B22] border border-[#30363D] rounded-[6px] p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#2F81F7]/15 border border-[#2F81F7]/30 text-[#2F81F7] font-mono text-xs font-bold flex items-center justify-center">
              3
            </div>
            <h2 className="text-base font-bold text-[#E6EDF3] font-sans">
              Call it before every tool
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Before */}
            <div className="bg-[#4A0D0D]/40 border border-[#8B1A1A] rounded-[6px] p-4 space-y-2">
              <div className="text-xs font-bold font-sans text-[#F85149]">
                Before WorkerZero
              </div>
              <pre className="text-xs font-mono text-[#E6EDF3] bg-[#0D1117] p-3 rounded-[4px] border border-[#30363D] overflow-x-auto">
                <code>{`# Agent calls tool directly — no protection
delete_database("production")`}</code>
              </pre>
            </div>

            {/* Right Column: With */}
            <div className="bg-[#0D4A1A]/40 border border-[#238636] rounded-[6px] p-4 space-y-2">
              <div className="text-xs font-bold font-sans text-[#3FB950]">
                With WorkerZero
              </div>
              <pre className="text-xs font-mono text-[#E6EDF3] bg-[#0D1117] p-3 rounded-[4px] border border-[#30363D] overflow-x-auto">
                <code>{`# Check first, then execute
args = wz("delete_database", {"db": "production"})
delete_database(args["db"])`}</code>
              </pre>
            </div>
          </div>

          <p className="text-xs text-[#8B949E] font-sans pt-1">
            One line added. Every tool call is now intercepted, evaluated, and logged.
          </p>
        </section>

        {/* Step 4 */}
        <section className="bg-[#161B22] border border-[#30363D] rounded-[6px] p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#2F81F7]/15 border border-[#2F81F7]/30 text-[#2F81F7] font-mono text-xs font-bold flex items-center justify-center">
              4
            </div>
            <h2 className="text-base font-bold text-[#E6EDF3] font-sans">
              Watch it on your dashboard
            </h2>
          </div>

          <p className="text-xs text-[#8B949E] font-sans">
            Open your dashboard to see every agent action in real time.
          </p>

          <div>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="wz-btn-primary px-6 py-3 text-xs font-bold font-sans tracking-wide transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#30363D] bg-[#161B22] py-6 px-6 text-center text-xs text-[#8B949E] font-sans">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>WorkerZero Runtime Gateway © 2026</div>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="text-[#2F81F7] hover:underline cursor-pointer font-medium"
          >
            Return to Dashboard →
          </button>
        </div>
      </footer>
    </div>
  );
}
