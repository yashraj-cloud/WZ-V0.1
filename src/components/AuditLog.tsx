import React, { useState } from 'react';
import { AuditEvent } from '../types';

interface AuditLogProps {
  events: AuditEvent[];
  newestEventIds: Set<string>;
  onClear: () => void;
}

export default function AuditLog({
  events,
  newestEventIds,
  onClear,
}: AuditLogProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toTimeString().slice(0, 8); // HH:MM:SS
    } catch {
      return iso;
    }
  };

  const getSeverityDot = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff4d6a] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff4d6a] shadow-[0_0_8px_#ff4d6a]" />
          </span>
        );
      case 'HIGH':
        return <span className="inline-block h-2 w-2 rounded-full bg-[#ff4d6a]" />;
      case 'MEDIUM':
        return <span className="inline-block h-2 w-2 rounded-full bg-[#ffb547]" />;
      case 'INFO':
      default:
        return <span className="inline-block h-2 w-2 rounded-full bg-[#00e5a0]" />;
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'ALLOW':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-[#00e5a0]/10 text-[#00e5a0] border border-[#00e5a0]/25">
            ALLOW
          </span>
        );
      case 'REDACT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-[#ffb547]/10 text-[#ffb547] border border-[#ffb547]/25">
            REDACT
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-[#7c6af7]/15 text-[#7c6af7] border border-[#7c6af7]/30">
            PENDING
          </span>
        );
      case 'BLOCK':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-[#ff4d6a]/10 text-[#ff4d6a] border border-[#ff4d6a]/25">
            BLOCK
          </span>
        );
    }
  };

  const formatJson = (val: any) => {
    if (!val) return '{}';
    if (typeof val === 'string') {
      try {
        return JSON.stringify(JSON.parse(val), null, 2);
      } catch {
        return val;
      }
    }
    return JSON.stringify(val, null, 2);
  };

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-6 wz-card-shadow flex flex-col">
      {/* Header with Title and Clear ghost button */}
      <div className="flex items-center justify-between pb-3 border-b border-[#2a2d3e] mb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
            AUDIT LOG
          </h2>
          <span className="text-[10px] font-mono text-[#4a5070] bg-[#0f1117] px-2 py-0.5 rounded-[4px] border border-[#2a2d3e]">
            {events.length} records
          </span>
        </div>

        {/* Small ghost button */}
        <button
          onClick={onClear}
          className="text-[11px] font-sans font-medium text-[#8b92a8] hover:text-[#f0f2f8] px-2.5 py-1 rounded-[6px] hover:bg-[#212435] transition-colors cursor-pointer"
        >
          CLEAR
        </button>
      </div>

      {/* Scrollable event list */}
      <div className="max-h-[460px] overflow-y-auto space-y-1.5 pr-1">
        {events.length === 0 ? (
          <div className="text-center py-14 text-[#4a5070] font-sans text-xs">
            No audit records captured yet. Execute demo scenarios to evaluate policies.
          </div>
        ) : (
          events.map((ev) => {
            const isExpanded = expandedRowId === ev.id;
            const isCritical = ev.severity === 'CRITICAL';
            const isFlashingCyan = newestEventIds.has(ev.id);

            return (
              <div
                key={ev.id}
                onClick={() => toggleRow(ev.id)}
                className={`group rounded-[6px] transition-all duration-200 cursor-pointer p-[10px_16px] ${
                  isFlashingCyan
                    ? 'bg-[#00d4ff]/10 border border-[#00d4ff]/50 shadow-[0_0_16px_rgba(0,212,255,0.2)]'
                    : isCritical
                    ? 'border-l-[3px] border-l-[#ff4d6a] border-t border-r border-b border-[#2a2d3e] bg-[#ff4d6a]/5 hover:bg-[#ff4d6a]/10'
                    : 'bg-[#1a1d27] border border-[#2a2d3e]/70 hover:bg-[#212435] hover:border-[#2a2d3e]'
                }`}
              >
                {/* Main Row Summary */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Severity dot 8px with glow on CRITICAL */}
                    <div className="shrink-0 flex items-center justify-center w-2">
                      {getSeverityDot(ev.severity)}
                    </div>

                    {/* Timestamp in JetBrains Mono 11px muted */}
                    <span className="text-[11px] font-mono text-[#4a5070] whitespace-nowrap">
                      {formatTimestamp(ev.timestamp)}
                    </span>

                    {/* Decision badge as pill */}
                    <div className="shrink-0">{getDecisionBadge(ev.decision)}</div>

                    {/* Tool Name in JetBrains Mono 13px primary text */}
                    <span className="text-[13px] font-mono font-medium text-[#f0f2f8] truncate max-w-[150px] md:max-w-[220px]">
                      {ev.toolName}
                    </span>

                    {/* Agent ID in JetBrains Mono 12px secondary */}
                    <span className="text-[12px] font-mono text-[#8b92a8] truncate max-w-[110px] md:max-w-[160px]">
                      @{ev.agentId}
                    </span>
                  </div>

                  {/* Trace hash in JetBrains Mono 10px very muted, pushed to the right */}
                  <div className="shrink-0 text-[10px] font-mono text-[#4a5070] group-hover:text-[#8b92a8] transition-colors ml-auto">
                    {ev.traceHash ? ev.traceHash.slice(0, 10) + '…' : '—'}
                  </div>
                </div>

                {/* Expanded details with smooth expansion */}
                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 pt-3 border-t border-[#2a2d3e] space-y-2.5 text-xs font-mono"
                  >
                    {/* Policy Message */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold text-[#4a5070] font-sans">
                        Policy Evaluation Message
                      </span>
                      <p className="text-[#8b92a8] bg-[#0f1117] p-2.5 rounded-[6px] border border-[#2a2d3e] font-mono text-xs">
                        {ev.message || ev.reason}
                      </p>
                    </div>

                    {/* Findings as small amber pill badges */}
                    {ev.findings && ev.findings.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-[#ffb547] font-sans">
                          Detected Findings
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ev.findings.map((f, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full bg-[#ffb547]/10 text-[#ffb547] border border-[#ffb547]/25 text-[10px] font-mono"
                            >
                              {f.type}: <span className="text-[#f0f2f8]">{f.value || f.match}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tool Arguments in a proper code block with #0f1117 background */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold text-[#4a5070] font-sans">
                        Tool Arguments (JSON)
                      </span>
                      <pre className="p-3 bg-[#0f1117] border border-[#2a2d3e] rounded-[4px] text-[11px] text-[#f0f2f8] overflow-x-auto whitespace-pre-wrap font-mono">
                        {formatJson(ev.toolArgs)}
                      </pre>
                    </div>

                    {/* Sanitized arguments if redacted */}
                    {ev.sanitizedArgs && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-[#ffb547] font-sans">
                          Sanitized Tool Arguments
                        </span>
                        <pre className="p-3 bg-[#ffb547]/5 border border-[#ffb547]/25 rounded-[4px] text-[11px] text-[#ffb547] overflow-x-auto whitespace-pre-wrap font-mono">
                          {formatJson(ev.sanitizedArgs)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
