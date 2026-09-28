import { useState } from 'react';

interface IntegrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBase: string;
}

export default function IntegrateModal({
  isOpen,
  onClose,
  apiBase,
}: IntegrateModalProps) {
  const [activeTab, setActiveTab] = useState<'node' | 'python' | 'curl'>('node');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const base = 'http://localhost:3001';

  const nodeCode = `// 1. Intercept AI agent tool calls before execution
async function safeExecuteTool(agentId, toolName, toolArgs) {
  const gatewayUrl = '${base}/intercept';
  
  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      toolName,
      toolArgs,
      tokenDelta: 150,
      usdDelta: 0.001
    })
  });

  const verdict = await response.json();

  if (verdict.decision === 'BLOCK') {
    throw new Error(\`[WorkerZero Blocked] \${verdict.message}\`);
  }

  // If REDACT, use sanitizedArgs instead of raw toolArgs
  const finalArgs = verdict.decision === 'REDACT' 
    ? verdict.sanitizedArgs 
    : toolArgs;

  return await executeAgentTool(toolName, finalArgs);
}`;

  const pythonCode = `# 1. Intercept AI agent tool calls with Python / LangChain / AutoGen
import requests

def safe_execute_tool(agent_id: str, tool_name: str, tool_args: dict):
    gateway_url = "${base}/intercept"
    payload = {
        "agentId": agent_id,
        "toolName": tool_name,
        "toolArgs": tool_args,
        "tokenDelta": 120,
        "usdDelta": 0.001
    }
    
    resp = requests.post(gateway_url, json=payload)
    verdict = resp.json()
    
    if verdict.get("decision") == "BLOCK":
        raise PermissionError(f"[WorkerZero Blocked] {verdict.get('message')}")
        
    final_args = verdict.get("sanitizedArgs") if verdict.get("decision") == "REDACT" else tool_args
    return execute_agent_tool(tool_name, final_args)`;

  const curlCode = `# Intercept sample tool call
curl -X POST ${base}/intercept \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-finance",
    "toolName": "export_report",
    "toolArgs": {
      "recipient": "cfo@corp.com",
      "customer_ssn": "123-45-6789",
      "phone": "5558675309",
      "api_key": "sk_live_abc123xyz"
    },
    "tokenDelta": 200,
    "usdDelta": 0.002
  }'`;

  const getCode = () => {
    switch (activeTab) {
      case 'node':
        return nodeCode;
      case 'python':
        return pythonCode;
      case 'curl':
        return curlCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0f1a] border border-[#1e293b] rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl font-mono">
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#cbd5e1] uppercase">
              WorkerZero Gateway Integration
            </h3>
            <p className="text-xs text-[#475569] font-sans">
              Wrap any agent execution loop or LLM function calling pipeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#475569] hover:text-[#cbd5e1] text-xs px-2.5 py-1 rounded bg-[#060a14] border border-[#1e293b] cursor-pointer"
          >
            ESC / CLOSE
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['node', 'python', 'curl'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs px-3 py-1 rounded border transition-colors cursor-pointer uppercase ${
                  activeTab === tab
                    ? 'bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/40'
                    : 'bg-[#060a14] text-[#475569] border-[#1e293b] hover:text-[#cbd5e1]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1 rounded bg-[#060a14] text-[#cbd5e1] border border-[#1e293b] hover:border-[#475569] cursor-pointer"
          >
            {copied ? 'COPIED!' : 'COPY CODE'}
          </button>
        </div>

        <pre className="p-3.5 bg-[#060a14] border border-[#1e293b] rounded text-xs text-[#cbd5e1] overflow-x-auto leading-relaxed">
          {getCode()}
        </pre>

        <div className="grid grid-cols-2 gap-3 text-xs text-[#cbd5e1] pt-2 border-t border-[#1e293b]">
          <div className="bg-[#060a14] p-2.5 rounded border border-[#1e293b]">
            <span className="text-[#22d3ee] font-bold block mb-1">
              Runtime Port
            </span>
            <span className="text-[#475569]">REST:</span> http://localhost:3001
            <br />
            <span className="text-[#475569]">WS:</span> ws://localhost:3001/ws
          </div>
          <div className="bg-[#060a14] p-2.5 rounded border border-[#1e293b]">
            <span className="text-[#10b981] font-bold block mb-1">
              Policy Checks
            </span>
            <span>Circuit Breaker, Blocklist, PII Redaction, Rate &amp; Budget Limits</span>
          </div>
        </div>
      </div>
    </div>
  );
}
