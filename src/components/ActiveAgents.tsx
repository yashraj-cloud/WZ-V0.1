import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Lock } from 'lucide-react';
import { AgentState } from '../types';

interface ActiveAgentsProps {
  agents: Record<string, AgentState>;
  flashRed: boolean;
  apiBase: string;
  onRefreshAgents: () => void;
}

export default function ActiveAgents({
  agents,
  flashRed,
  apiBase,
  onRefreshAgents,
}: ActiveAgentsProps) {
  // Track recently locked agents to apply 2-second red border glow animation
  const prevLockedRef = useRef<Record<string, boolean>>({});
  const [justLockedIds, setJustLockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newlyLocked = new Set<string>();
    for (const [id, state] of Object.entries(agents)) {
      if (state.locked && !prevLockedRef.current[id]) {
        newlyLocked.add(id);
      }
      prevLockedRef.current[id] = Boolean(state.locked);
    }

    if (newlyLocked.size > 0) {
      setJustLockedIds((prev) => new Set([...prev, ...newlyLocked]));
      const timer = setTimeout(() => {
        setJustLockedIds((prev) => {
          const next = new Set(prev);
          newlyLocked.forEach((id) => next.delete(id));
          return next;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [agents]);

  const handleLock = async (agentId: string) => {
    try {
      await fetch(`${apiBase}/agent/${agentId}/lock`, { method: 'POST' });
      onRefreshAgents();
    } catch (err) {
      console.error('Failed to lock agent:', err);
    }
  };

  const handleReset = async (agentId: string) => {
    try {
      await fetch(`${apiBase}/agent/${agentId}/reset`, { method: 'POST' });
      onRefreshAgents();
    } catch (err) {
      console.error('Failed to reset agent:', err);
    }
  };

  const agentEntries = Object.entries(agents);

  return (
    <div
      className={`bg-[#1a1d27] border rounded-[10px] p-5 wz-card-shadow transition-all duration-300 ${
        flashRed
          ? 'border-[#ff4d6a] bg-[#ff4d6a]/5 shadow-[0_0_20px_rgba(255,77,106,0.3)]'
          : 'border-[#2a2d3e]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-[#2a2d3e]">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
            ACTIVE AGENTS
          </h3>
          <span className="text-[10px] text-[#4a5070] font-mono">
            ({agentEntries.length})
          </span>
        </div>
        <button
          onClick={onRefreshAgents}
          className="text-[10px] font-sans font-medium text-[#8b92a8] hover:text-[#00d4ff] transition-colors cursor-pointer"
        >
          SYNC
        </button>
      </div>

      {/* Agents List */}
      <div>
        {agentEntries.length === 0 ? (
          <div className="text-center py-6 text-[#4a5070] text-xs font-sans">
            No agents registered. Run a demo scenario to register active agents.
          </div>
        ) : (
          agentEntries.map(([agentId, state]) => {
            const isLocked = state.locked;
            const isJustLocked = justLockedIds.has(agentId);
            const spentFormatted = (state.usdSpent || 0).toFixed(4);

            return (
              <div
                key={agentId}
                className={`p-[12px_14px] rounded-[8px] border mb-2 transition-all duration-300 flex items-center justify-between gap-3 ${
                  isJustLocked
                    ? 'animate-lock-glow bg-[#ff4d6a]/10'
                    : isLocked
                    ? 'bg-[#ff4d6a]/5 border-[#ff4d6a]/30'
                    : 'bg-[#212435] border-[#2a2d3e] hover:border-[#383d54]'
                }`}
              >
                {/* Left: Status Pill Badge */}
                <div className="shrink-0">
                  {isLocked ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold bg-[#ff4d6a]/15 text-[#ff4d6a] border border-[#ff4d6a]/30">
                      LOCKED
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold bg-[#00e5a0]/15 text-[#00e5a0] border border-[#00e5a0]/30">
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Middle: Agent ID in JetBrains Mono 12px bold + metrics below in 11px muted */}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-mono font-bold text-[#f0f2f8] truncate">
                    {agentId}
                  </div>
                  <div className="text-[11px] font-mono text-[#4a5070] truncate mt-0.5">
                    Calls: <span className="text-[#8b92a8]">{state.callsThisMinute || 0}/min</span>
                    {'  •  '}
                    USD: <span className="text-[#8b92a8]">${spentFormatted}</span>
                  </div>
                </div>

                {/* Right: RESET and LOCK as small icon buttons with tooltips */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleReset(agentId)}
                    title="Reset agent counters and unlock"
                    className="p-1.5 rounded-[6px] bg-[#1a1d27] hover:bg-[#282b3d] text-[#8b92a8] hover:text-[#00d4ff] border border-[#2a2d3e] hover:border-[#00d4ff]/40 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleLock(agentId)}
                    title={isLocked ? 'Agent is already locked' : 'Manually lock agent'}
                    disabled={isLocked}
                    className={`p-1.5 rounded-[6px] border transition-colors cursor-pointer ${
                      isLocked
                        ? 'opacity-30 bg-[#1a1d27] border-[#2a2d3e] text-[#4a5070] cursor-not-allowed'
                        : 'bg-[#1a1d27] hover:bg-[#ff4d6a]/15 text-[#8b92a8] hover:text-[#ff4d6a] border-[#2a2d3e] hover:border-[#ff4d6a]/40'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
