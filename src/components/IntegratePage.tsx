import { useState } from 'react';
import { ArrowRight, Check, Copy, Shield, Lock, EyeOff, Zap, KeyRound } from 'lucide-react';

interface IntegratePageProps {
  onNavigate: (path: string) => void;
  apiBase: string;
}

export default function IntegratePage({
  onNavigate,
  apiBase,
}: IntegratePageProps) {
  const [activeTab, setActiveTab] = useState<'python' | 'javascript' | 'curl'>('python');
  const [copied, setCopied] = useState(false);
  // Gateway endpoint URL using current origin
  const base = apiBase || (typeof window !== 'undefined' ? window.location.origin : '');
  const endpointUrl = `${base}/intercept`;

  const pythonCode = `import requests

def safe_execute_tool(agent_id: str, tool_name: str, tool_args: dict):
    """
    Intercepts an AI agent tool call with WorkerZero before execution.
    Evaluates in <5ms and handles ALLOW, BLOCK, and REDACT decisions.
    """
    gateway_url = "${endpointUrl}"
    
    payload = {
        "agentId": agent_id,
        "toolName": tool_name,
        "toolArgs": tool_args,
        "tokenDelta": 150,
        "usdDelta": 0.0015
    }
    
    response = requests.post(gateway_url, json=payload, timeout=2.0)
    verdict = response.json()
    
    decision = verdict.get("decision")
    trace_hash = verdict.get("traceHash")
    print(f"[WorkerZero] {decision} | Trace: {trace_hash}")
    
    # 1. BLOCK - Abort tool execution immediately
    if decision == "BLOCK":
        raise PermissionError(
            f"[WorkerZero Blocked] {verdict.get('message')} ({verdict.get('reason')})"
        )
    
    # 2. REDACT - Use sanitized arguments stripped of sensitive PII/secrets
    if decision == "REDACT":
        sanitized_args = verdict.get("sanitizedArgs")
        print(f"[WorkerZero] PII redacted. Executing with sanitized arguments.")
        return execute_tool(tool_name, sanitized_args)
    
    # 3. ALLOW - Proceed with original tool call execution
    return execute_tool(tool_name, tool_args)

def execute_tool(name: str, args: dict):
    # Dispatch tool to your external API, database, or agent runner
    return {"status": "success", "tool": name, "executed": True}`;

  const javascriptCode = `// Intercept an AI agent tool call with WorkerZero before execution
async function safeExecuteTool(agentId, toolName, toolArgs) {
  const gatewayUrl = '${endpointUrl}';

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      toolName,
      toolArgs,
      tokenDelta: 150,
      usdDelta: 0.0015,
    }),
  });

  const verdict = await response.json();
  const { decision, reason, message, traceHash, sanitizedArgs } = verdict;

  console.log(\`[WorkerZero] \${decision} | Trace: \${traceHash}\`);

  // 1. BLOCK - Abort tool execution immediately
  if (decision === 'BLOCK') {
    throw new Error(\`[WorkerZero Blocked] \${message} (\${reason})\`);
  }

  // 2. REDACT - Use sanitized arguments stripped of sensitive PII
  if (decision === 'REDACT') {
    console.warn('[WorkerZero] PII redacted. Executing with sanitized args.');
    return await executeAgentTool(toolName, sanitizedArgs);
  }

  // 3. ALLOW - Proceed with normal tool execution
  return await executeAgentTool(toolName, toolArgs);
}

async function executeAgentTool(toolName, args) {
  // Dispatch tool to database, external API, or agent runtime
  return { status: 'success', tool: toolName, executed: true };
}`;

  const curlCode = `# 1. Intercept a tool call before execution
curl -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-finance",
    "toolName": "export_report",
    "toolArgs": {
      "recipient": "cfo@corp.com",
      "customer_ssn": "123-45-6789",
      "api_key": "sk_live_abc123xyz"
    },
    "tokenDelta": 150,
    "usdDelta": 0.0015
  }'

# 2. Example ALLOW Response
# { "decision": "ALLOW", "reason": "PASSED_ALL_POLICIES", "severity": "INFO", "message": "Policy evaluation passed", "traceHash": "3f8b91a0c4d2e5f6" }

# 3. Example REDACT Response
# { "decision": "REDACT", "reason": "PII_DETECTED", "severity": "MEDIUM", "message": "Sensitive PII redacted", "traceHash": "b2c4e6a8d0f12345", "sanitizedArgs": { "recipient": "cfo@corp.com", "customer_ssn": "[REDACTED_SSN]", "api_key": "[REDACTED_API_KEY]" } }

# 4. Example BLOCK Response
# { "decision": "BLOCK", "reason": "TOOL_BLOCKED", "severity": "HIGH", "message": "Tool export_report blocked by policy", "traceHash": "7d9e1f3a5b8c0246" }`;

  const getCode = () => {
    switch (activeTab) {
      case 'python':
        return pythonCode;
      case 'javascript':
        return javascriptCode;
      case 'curl':
        return curlCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const frameworks = [
    'OpenAI Agents',
    'Google Gemini',
    'Anthropic Claude',
    'LangChain',
    'CrewAI',
    'AutoGen',
    'Custom HTTP Agent',
  ];

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#f0f2f8] font-sans antialiased flex flex-col justify-between selection:bg-[#00d4ff]/20 selection:text-[#00d4ff]">
      {/* 56px Header matching App.tsx */}
      <header className="h-[56px] sticky top-0 z-40 bg-[#1a1d27] border-b border-[#2a2d3e] px-6 flex items-center justify-between">
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
        <div className="flex items-center gap-6 h-full">
          <button
            onClick={() => onNavigate('/dashboard')}
            className="h-full flex items-center text-[13px] font-medium font-sans text-[#8b92a8] hover:text-[#f0f2f8] transition-colors cursor-pointer border-b-2 border-transparent"
          >
            DASHBOARD
          </button>
          <button
            onClick={() => onNavigate('/integrate')}
            className="h-full flex items-center text-[13px] font-medium font-sans text-[#00d4ff] border-b-2 border-[#00d4ff] cursor-pointer"
          >
            INTEGRATE
          </button>
        </div>

        {/* Right: Return to dashboard button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/dashboard')}
            className="px-3.5 py-1.5 rounded-[6px] bg-[#212435] hover:bg-[#282b3d] text-[#00d4ff] border border-[#2a2d3e] hover:border-[#00d4ff]/40 text-xs font-sans font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>OPEN CONSOLE</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-12">
        {/* Page Title & Subtitle */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold font-sans text-white tracking-tight">
            Connect Your AI Agent
          </h1>
          <p className="text-base text-[#8b92a8] font-sans">
            Any agent. Any framework. One sub-5ms interception endpoint.
          </p>
        </div>

        {/* Section 1 — Three horizontal cards with gradient top borders */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Step 1 — cyan gradient top border */}
            <div className="relative bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-6 wz-card-shadow flex flex-col justify-between overflow-hidden group hover:border-[#383d54] transition-colors">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00d4ff] to-transparent" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-[#00d4ff]">
                    01
                  </span>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-[#4a5070] uppercase bg-[#0f1117] px-2 py-0.5 rounded-[4px] border border-[#2a2d3e]">
                    DISPATCH
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-sans">
                  Agent makes a tool call
                </h3>
                <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                  Your autonomous agent runtime plans to invoke a tool, such as querying a
                  database, calling a payment API, or running a terminal command.
                </p>
              </div>
            </div>

            {/* Step 2 — purple gradient top border */}
            <div className="relative bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-6 wz-card-shadow flex flex-col justify-between overflow-hidden group hover:border-[#383d54] transition-colors">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7c6af7] to-transparent" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-[#7c6af7]">
                    02
                  </span>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-[#7c6af7] uppercase bg-[#7c6af7]/10 px-2 py-0.5 rounded-[4px] border border-[#7c6af7]/30">
                    &lt; 5MS
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-sans">
                  WorkerZero intercepts
                </h3>
                <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                  Before execution, your code sends the arguments to <code className="text-[#00d4ff] font-mono">/intercept</code>. WorkerZero validates
                  security rules and quotas in memory in under 5ms.
                </p>
              </div>
            </div>

            {/* Step 3 — green gradient top border */}
            <div className="relative bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-6 wz-card-shadow flex flex-col justify-between overflow-hidden group hover:border-[#383d54] transition-colors">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00e5a0] to-transparent" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-[#00e5a0]">
                    03
                  </span>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-[#00e5a0] uppercase bg-[#00e5a0]/10 px-2 py-0.5 rounded-[4px] border border-[#00e5a0]/30">
                    VERDICT
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-sans">
                  Decision returned
                </h3>
                <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                  ALLOW proceeds normally, BLOCK stops execution with a clear audit reason,
                  and REDACT sanitizes arguments with full cryptographic trace hashes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2 — Endpoint Specification */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
              ENDPOINT SPECIFICATION
            </h2>
            <span className="text-[11px] font-mono text-[#4a5070]">
              REST Protocol
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Request Block */}
            <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-5 flex flex-col justify-between space-y-3 wz-card-shadow">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#2a2d3e]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">
                    POST
                  </span>
                  <span className="text-xs text-white font-mono font-medium break-all">
                    {endpointUrl}
                  </span>
                </div>
                <span className="text-[10px] text-[#4a5070] uppercase font-bold font-sans">
                  Request Payload
                </span>
              </div>

              {/* Code pre block with #0a0c14 background, border #2a2d3e, rounded 8px */}
              <pre className="bg-[#0a0c14] border border-[#2a2d3e] p-4 rounded-[8px] text-xs font-mono leading-relaxed overflow-x-auto text-[#f0f2f8]">
                <span className="text-[#4a5070]">{`{\n`}</span>
                <span className="text-[#00d4ff]">  "agentId"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00e5a0]">"agent-finance"</span>
                <span className="text-[#4a5070]">,\n</span>

                <span className="text-[#00d4ff]">  "toolName"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00e5a0]">"export_report"</span>
                <span className="text-[#4a5070]">,\n</span>

                <span className="text-[#00d4ff]">  "toolArgs"</span>
                <span className="text-[#4a5070]">: {`{\n`}</span>
                <span className="text-[#8b92a8]">    "query"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00e5a0]">"active_records"</span>
                <span className="text-[#4a5070]">,\n</span>
                <span className="text-[#8b92a8]">    "customer_ssn"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00e5a0]">"123-45-6789"</span>
                <span className="text-[#4a5070]">{"\n  },\n"}</span>

                <span className="text-[#00d4ff]">  "tokenDelta"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#ffb547]">150</span>
                <span className="text-[#4a5070]">,\n</span>

                <span className="text-[#00d4ff]">  "usdDelta"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#ffb547]">0.0015</span>
                <span className="text-[#4a5070]">{"\n}"}</span>
              </pre>

              <div className="text-[11px] text-[#4a5070] font-sans">
                Pass <code className="text-[#00d4ff] font-mono">tokenDelta</code> and <code className="text-[#00d4ff] font-mono">usdDelta</code> to enforce hourly budgets and sliding-window rate ceilings.
              </div>
            </div>

            {/* Response Block */}
            <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-5 flex flex-col justify-between space-y-3 wz-card-shadow">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#2a2d3e]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold bg-[#00e5a0]/10 text-[#00e5a0] border border-[#00e5a0]/30">
                    200 OK
                  </span>
                  <span className="text-xs text-white font-mono font-medium">
                    Policy Evaluation Verdict
                  </span>
                </div>
                <span className="text-[10px] text-[#4a5070] uppercase font-bold font-sans">
                  Response Payload
                </span>
              </div>

              {/* Code pre block with #0a0c14 background, border #2a2d3e, rounded 8px */}
              <pre className="bg-[#0a0c14] border border-[#2a2d3e] p-4 rounded-[8px] text-xs font-mono leading-relaxed overflow-x-auto text-[#f0f2f8]">
                <span className="text-[#4a5070]">{`{\n`}</span>
                <span className="text-[#00d4ff]">  "decision"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00e5a0]">"ALLOW"</span>
                <span className="text-[#4a5070]"> | </span>
                <span className="text-[#ff4d6a]">"BLOCK"</span>
                <span className="text-[#4a5070]"> | </span>
                <span className="text-[#ffb547]">"REDACT"</span>
                <span className="text-[#4a5070]">,\n</span>

                <span className="text-[#00d4ff]">  "reason"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00e5a0]">"PASSED_ALL_POLICIES"</span>
                <span className="text-[#4a5070]">,\n</span>

                <span className="text-[#00d4ff]">  "severity"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00e5a0]">"INFO"</span>
                <span className="text-[#4a5070]"> | </span>
                <span className="text-[#ffb547]">"MEDIUM"</span>
                <span className="text-[#4a5070]"> | </span>
                <span className="text-[#ff4d6a]">"HIGH"</span>
                <span className="text-[#4a5070]"> | </span>
                <span className="text-[#ff4d6a]">"CRITICAL"</span>
                <span className="text-[#4a5070]">,\n</span>

                <span className="text-[#00d4ff]">  "message"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00e5a0]">"Policy evaluation passed"</span>
                <span className="text-[#4a5070]">,\n</span>

                <span className="text-[#00d4ff]">  "traceHash"</span>
                <span className="text-[#4a5070]">: </span>
                <span className="text-[#00d4ff]">"3f8b91a0c4d2e5f6"</span>
                <span className="text-[#4a5070]">, </span>
                <span className="text-[#4a5070]">// 16-char hex audit proof\n</span>

                <span className="text-[#00d4ff]">  "sanitizedArgs"</span>
                <span className="text-[#4a5070]">: {`{ ... } `}</span>
                <span className="text-[#ffb547]">// returned on REDACT</span>
                <span className="text-[#4a5070]">{"\n}"}</span>
              </pre>

              <div className="text-[11px] text-[#4a5070] font-sans">
                The <code className="text-[#00d4ff] font-mono">traceHash</code> connects client decisions to the live cryptographic audit log on your dashboard.
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Tabbed code examples with COPY button */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
              WORKING CODE EXAMPLES
            </h2>
            <span className="text-[11px] font-mono text-[#4a5070]">
              Copy &amp; Paste Ready
            </span>
          </div>

          <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-5 wz-card-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a2d3e] pb-3 flex-wrap gap-2">
              {/* Tab buttons as pill tabs */}
              <div className="flex items-center gap-2">
                {(['python', 'javascript', 'curl'] as const).map((tab) => {
                  const label =
                    tab === 'python'
                      ? 'Python'
                      : tab === 'javascript'
                      ? 'JavaScript'
                      : 'cURL';
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`text-xs px-4 py-1.5 rounded-full border transition-all cursor-pointer font-mono font-medium ${
                        isActive
                          ? 'bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/40 shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                          : 'bg-[#212435] text-[#8b92a8] border-[#2a2d3e] hover:text-[#f0f2f8]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* COPY button top right of code block */}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[6px] bg-[#212435] hover:bg-[#282b3d] text-[#8b92a8] hover:text-[#f0f2f8] border border-[#2a2d3e] hover:border-[#383d54] transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00e5a0]" />
                    <span className="text-[#00e5a0] font-bold font-mono">COPIED!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8b92a8]" />
                    <span className="font-sans">COPY CODE</span>
                  </>
                )}
              </button>
            </div>

            {/* Code block: background #0a0c14, border #2a2d3e, rounded 8px, padding 20px */}
            <pre className="p-5 bg-[#0a0c14] border border-[#2a2d3e] rounded-[8px] text-xs text-[#f0f2f8] overflow-x-auto leading-relaxed whitespace-pre font-mono">
              {getCode()}
            </pre>
          </div>
        </section>

        {/* Section 4 — Four security capabilities in 2x2 grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
              CORE SECURITY CAPABILITIES
            </h2>
            <span className="text-[11px] font-mono text-[#4a5070]">
              Enforced Simultaneously
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Blocklist Protection - red */}
            <div className="bg-[#1a1d27] border border-[#2a2d3e] hover:border-[#ff4d6a]/40 rounded-[10px] p-5 wz-card-shadow space-y-2.5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#ff4d6a] font-sans uppercase">
                  Blocklist Protection
                </span>
                <div className="w-8 h-8 rounded-full bg-[#ff4d6a]/10 border border-[#ff4d6a]/30 flex items-center justify-center text-[#ff4d6a]">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                Immediately blocks destructive actions—such as raw database deletions,
                unauthorized financial transfers, or bash shell execution—before the agent
                can dispatch them.
              </p>
            </div>

            {/* 2. PII Redaction - amber */}
            <div className="bg-[#1a1d27] border border-[#2a2d3e] hover:border-[#ffb547]/40 rounded-[10px] p-5 wz-card-shadow space-y-2.5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#ffb547] font-sans uppercase">
                  PII Redaction
                </span>
                <div className="w-8 h-8 rounded-full bg-[#ffb547]/10 border border-[#ffb547]/30 flex items-center justify-center text-[#ffb547]">
                  <EyeOff className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                Scans tool arguments in memory to detect and mask sensitive credentials,
                including SSNs, credit cards, emails, and live API keys, returning sanitized
                data to callers.
              </p>
            </div>

            {/* 3. Runaway Loop Detection - red */}
            <div className="bg-[#1a1d27] border border-[#2a2d3e] hover:border-[#ff4d6a]/40 rounded-[10px] p-5 wz-card-shadow space-y-2.5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#ff4d6a] font-sans uppercase">
                  Runaway Loop Detection
                </span>
                <div className="w-8 h-8 rounded-full bg-[#ff4d6a]/10 border border-[#ff4d6a]/30 flex items-center justify-center text-[#ff4d6a]">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                Dynamic sliding-window rate tracking trips a circuit breaker whenever an
                agent loops out of control, locking the agent and halting compounding API token bills.
              </p>
            </div>

            {/* 4. Cryptographic Audit Trail - cyan */}
            <div className="bg-[#1a1d27] border border-[#2a2d3e] hover:border-[#00d4ff]/40 rounded-[10px] p-5 wz-card-shadow space-y-2.5 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#00d4ff] font-sans uppercase">
                  Cryptographic Audit Trail
                </span>
                <div className="w-8 h-8 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center text-[#00d4ff]">
                  <KeyRound className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-[#8b92a8] leading-relaxed font-sans">
                Computes an immutable 16-character SHA-256 hash for every decision,
                timestamp, and payload, generating verifiable compliance logs for enterprise audits.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 — Compatible frameworks with subtle gradient border on hover */}
        <section className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-6 wz-card-shadow space-y-4">
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans mb-1">
              COMPATIBLE FRAMEWORKS
            </h3>
            <p className="text-xs text-[#8b92a8] font-sans">
              If your agent can dispatch an HTTP POST request, it works seamlessly with WorkerZero.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {frameworks.map((fw, i) => (
              <div
                key={i}
                className="px-4 py-1.5 rounded-full bg-[#212435] border border-[#2a2d3e] hover:border-[#00d4ff]/50 hover:shadow-[0_0_12px_rgba(0,212,255,0.15)] text-xs font-mono text-[#f0f2f8] transition-all cursor-default"
              >
                <span className="text-[#00d4ff] mr-2">•</span>
                {fw}
              </div>
            ))}
          </div>
        </section>

        {/* Launch Live Dashboard Banner */}
        <div className="bg-gradient-to-r from-[#1a1d27] via-[#212435] to-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 wz-card-shadow">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-white font-sans">
              Ready to test policies live?
            </h4>
            <p className="text-xs text-[#8b92a8] font-sans">
              Experience real-time interception, PII redaction, and runaway circuit breakers.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="px-5 py-2.5 rounded-[6px] bg-gradient-to-r from-[#00d4ff] to-[#7c6af7] hover:from-[#00d4ff] hover:to-[#6d5af0] text-white font-bold text-xs tracking-wide transition-all shadow-[0_0_16px_rgba(0,212,255,0.2)] cursor-pointer flex items-center gap-2 shrink-0"
          >
            <span>Launch Live Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Footer workerzero.ai very muted at bottom */}
      <footer className="text-center py-6 border-t border-[#2a2d3e]/50 mt-12">
        <span className="text-xs font-mono text-[#4a5070] hover:text-[#8b92a8] transition-colors tracking-widest uppercase">
          workerzero.ai
        </span>
      </footer>
    </div>
  );
}
