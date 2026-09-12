import { useState } from 'react';

interface DemoScenariosProps {
  apiBase: string;
}

export default function DemoScenarios({ apiBase }: DemoScenariosProps) {
  const [runningScenario, setRunningScenario] = useState<string | null>(null);

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const postIntercept = async (payload: any) => {
    try {
      await fetch(`${apiBase}/intercept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Scenario intercept request error:', err);
    }
  };

  // Button 1: PII EXFILTRATION
  const handlePiiExfiltration = async () => {
    if (runningScenario) return;
    setRunningScenario('pii');
    try {
      await postIntercept({
        agentId: 'agent-finance',
        toolName: 'export_report',
        toolArgs: {
          recipient: 'cfo@corp.com',
          customer_ssn: '123-45-6789',
          phone: '5558675309',
          api_key: 'sk_live_abc123xyz',
        },
        tokenDelta: 200,
        usdDelta: 0.002,
      });
    } finally {
      setRunningScenario(null);
    }
  };

  // Button 2: BLOCKED TOOL CALL
  const handleBlockedToolCall = async () => {
    if (runningScenario) return;
    setRunningScenario('blocked');
    try {
      // 1. delete_database
      await postIntercept({
        agentId: 'agent-ops',
        toolName: 'delete_database',
        toolArgs: { target: 'production_cluster' },
        tokenDelta: 50,
        usdDelta: 0.0005,
      });
      await delay(250);
      // 2. transfer_funds
      await postIntercept({
        agentId: 'agent-ops',
        toolName: 'transfer_funds',
        toolArgs: { destination: 'external_wallet', amount: 50000 },
        tokenDelta: 50,
        usdDelta: 0.0005,
      });
    } finally {
      setRunningScenario(null);
    }
  };

  // Button 3: RUNAWAY LOOP
  const handleRunawayLoop = async () => {
    if (runningScenario) return;
    setRunningScenario('runaway');
    try {
      // Reset agent-loop first
      await fetch(`${apiBase}/agent/agent-loop/reset`, { method: 'POST' });
      await delay(100);

      // Fire 22 sequential POSTs of process_queue with 80ms delay
      for (let i = 1; i <= 22; i++) {
        await postIntercept({
          agentId: 'agent-loop',
          toolName: 'process_queue',
          toolArgs: { batchId: `batch-${i}`, retries: i },
          tokenDelta: 30,
          usdDelta: 0.0002,
        });
        await delay(80);
      }
    } finally {
      setRunningScenario(null);
    }
  };

  // Button 4: NORMAL OPERATION
  const handleNormalOperation = async () => {
    if (runningScenario) return;
    setRunningScenario('normal');
    const tools = [
      'search_knowledge_base',
      'summarize_document',
      'create_task',
      'send_notification',
      'read_file',
    ];
    try {
      for (const toolName of tools) {
        await postIntercept({
          agentId: 'agent-worker',
          toolName,
          toolArgs: { query: 'system operational metrics', format: 'json' },
          tokenDelta: 120,
          usdDelta: 0.001,
        });
        await delay(200);
      }
    } finally {
      setRunningScenario(null);
    }
  };

  // Button 5: HUMAN APPROVAL REQUIRED (Check 2b)
  const handleHumanApproval = async () => {
    if (runningScenario) return;
    setRunningScenario('approval');
    try {
      await postIntercept({
        agentId: 'agent-comms',
        toolName: 'send_email',
        toolArgs: {
          recipient: 'external_auditor@security.org',
          subject: 'Confidential Client Data Export',
          attachments: ['customer_records_2026.csv'],
        },
        tokenDelta: 120,
        usdDelta: 0.0012,
      });
    } finally {
      setRunningScenario(null);
    }
  };

  const scenarios = [
    {
      id: 'approval',
      initial: 'H',
      name: 'HUMAN APPROVAL',
      description: 'Sensitive send_email pauses for manual authorization',
      accent: '#7c6af7',
      circleBg: 'bg-[#7c6af7]/20 text-[#7c6af7] border-[#7c6af7]/35',
      hoverBorder: 'hover:border-[#7c6af7]',
      handler: handleHumanApproval,
    },
    {
      id: 'pii',
      initial: 'P',
      name: 'PII EXFILTRATION',
      description: 'SSN, API keys, & phone sanitized in-memory',
      accent: '#ffb547',
      circleBg: 'bg-[#ffb547]/15 text-[#ffb547] border-[#ffb547]/30',
      hoverBorder: 'hover:border-[#ffb547]',
      handler: handlePiiExfiltration,
    },
    {
      id: 'blocked',
      initial: 'B',
      name: 'BLOCKED TOOL CALL',
      description: 'Terminates unauthorized delete_db & transfers',
      accent: '#ff4d6a',
      circleBg: 'bg-[#ff4d6a]/15 text-[#ff4d6a] border-[#ff4d6a]/30',
      hoverBorder: 'hover:border-[#ff4d6a]',
      handler: handleBlockedToolCall,
    },
    {
      id: 'runaway',
      initial: 'R',
      name: 'RUNAWAY LOOP',
      description: 'Trips circuit breaker quota & locks agent',
      accent: '#ff4d6a',
      circleBg: 'bg-[#ff4d6a]/20 text-[#ff4d6a] border-[#ff4d6a]/40',
      hoverBorder: 'hover:border-[#ff4d6a]',
      handler: handleRunawayLoop,
    },
    {
      id: 'normal',
      initial: 'N',
      name: 'NORMAL OPERATION',
      description: 'Compliant benign tool calls evaluated & approved',
      accent: '#00e5a0',
      circleBg: 'bg-[#00e5a0]/15 text-[#00e5a0] border-[#00e5a0]/30',
      hoverBorder: 'hover:border-[#00e5a0]',
      handler: handleNormalOperation,
    },
  ];

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-5 wz-card-shadow">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-[#2a2d3e]">
        <h3 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
          DEMO SCENARIOS
        </h3>
        <span className="text-[10px] text-[#4a5070] font-sans font-medium">
          Simulate Policy
        </span>
      </div>

      {/* Four scenario buttons as full card buttons */}
      <div className="space-y-2.5">
        {scenarios.map((sc) => {
          const isRunning = runningScenario === sc.id;
          const isOtherRunning = Boolean(runningScenario && !isRunning);

          return (
            <button
              key={sc.id}
              onClick={sc.handler}
              disabled={Boolean(runningScenario)}
              className={`relative w-full text-left p-[14px_16px] rounded-[8px] border transition-all duration-200 cursor-pointer overflow-hidden ${
                isRunning
                  ? 'border-[#00d4ff] animate-shimmer shadow-[0_0_16px_rgba(0,212,255,0.15)]'
                  : isOtherRunning
                  ? 'opacity-40 bg-[#212435] border-[#2a2d3e] cursor-not-allowed'
                  : `bg-[#212435] border-[#2a2d3e] hover:bg-[#282b3d] ${sc.hoverBorder} shadow-sm`
              }`}
            >
              <div className="flex items-center gap-3.5">
                {/* Left side: colored icon circle 32px with scenario initial */}
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs font-mono shrink-0 transition-transform ${sc.circleBg}`}
                >
                  {sc.initial}
                </div>

                {/* Right side: scenario name in 13px bold primary text, description in 11px secondary */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#f0f2f8] font-sans">
                      {sc.name}
                    </span>
                    {isRunning && (
                      <span className="text-[10px] font-bold text-[#00d4ff] font-mono animate-pulse">
                        RUNNING…
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8b92a8] font-sans truncate mt-0.5">
                    {sc.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
