import React, { useState, useEffect } from 'react';
import { Check, X, Clock, ShieldAlert } from 'lucide-react';
import { PendingApproval } from '../types';

interface PendingApprovalsProps {
  approvals: PendingApproval[];
  newestApprovalIds?: Set<string>;
  apiBase: string;
  onApprove: (id: string) => Promise<void> | void;
  onDeny: (id: string) => Promise<void> | void;
}

export default function PendingApprovals({
  approvals,
  newestApprovalIds = new Set(),
  apiBase,
  onApprove,
  onDeny,
}: PendingApprovalsProps) {
  // Live ticker to update "waiting for X seconds/minutes" every second
  const [, setTick] = useState(0);
  const [actionInProgress, setActionInProgress] = useState<Record<string, 'approve' | 'deny'>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatWaitTime = (createdAtStr: string) => {
    const created = new Date(createdAtStr).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - created) / 1000));

    if (diffSec < 60) {
      return `${diffSec}s ago`;
    }
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins < 60) {
      return `${mins}m ${secs}s ago`;
    }
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  const handleApproveClick = async (id: string) => {
    try {
      setActionInProgress((prev) => ({ ...prev, [id]: 'approve' }));
      const res = await fetch(`${apiBase}/approvals/${id}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        onApprove(id);
      }
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setActionInProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDenyClick = async (id: string) => {
    try {
      setActionInProgress((prev) => ({ ...prev, [id]: 'deny' }));
      const res = await fetch(`${apiBase}/approvals/${id}/deny`, {
        method: 'POST',
      });
      if (res.ok) {
        onDeny(id);
      }
    } catch (err) {
      console.error('Failed to deny:', err);
    } finally {
      setActionInProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const count = approvals.length;

  return (
    <section className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8b92a8] font-sans">
            PENDING APPROVALS
          </span>
          {/* Count badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-colors ${
              count > 0
                ? 'bg-[#ff4d6a]/15 text-[#ff4d6a] border-[#ff4d6a]/40'
                : 'bg-[#212435] text-[#4a5070] border-[#2a2d3e]'
            }`}
          >
            {count}
          </span>
        </div>
        {count > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-[#ffb547] font-mono font-medium">
            <ShieldAlert className="w-3 h-3 text-[#ffb547]" />
            <span>ACTION REQUIRED</span>
          </div>
        )}
      </div>

      {/* Approvals List */}
      {count === 0 ? (
        <div className="py-6 text-center border border-dashed border-[#2a2d3e] rounded-[8px] bg-[#0f1117]/40">
          <p className="text-xs text-[#4a5070] font-sans">No pending approvals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => {
            const isNew = newestApprovalIds.has(approval.id);
            const inProgress = actionInProgress[approval.id];

            // Render formatted args string
            let argsPreview = '';
            try {
              if (typeof approval.toolArgs === 'string') {
                argsPreview = approval.toolArgs;
              } else {
                argsPreview = JSON.stringify(approval.toolArgs);
              }
            } catch {
              argsPreview = String(approval.toolArgs);
            }

            return (
              <div
                key={approval.id}
                className={`p-3.5 rounded-[10px] border transition-all duration-300 ${
                  isNew
                    ? 'bg-[#282338] border-[#ffb547] shadow-[0_0_15px_rgba(255,181,71,0.15)] animate-pulse'
                    : 'bg-[#23202e] border-[#38334a] hover:border-[#4d4666]'
                }`}
              >
                {/* Top Row: agentId & wait time */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className="text-[12px] font-mono font-bold text-[#f0f2f8] tracking-tight truncate"
                    title={approval.agentId}
                  >
                    {approval.agentId}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-[#ffb547] shrink-0">
                    <Clock className="w-3 h-3 text-[#ffb547]" />
                    <span>{formatWaitTime(approval.createdAt)}</span>
                  </div>
                </div>

                {/* Middle: toolName */}
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#0f1117] text-[#8b92a8] border border-[#2a2d3e]">
                    TOOL
                  </span>
                  <span className="text-[12px] font-mono font-semibold text-[#00d4ff] truncate">
                    {approval.toolName}
                  </span>
                </div>

                {/* Truncated JSON Preview */}
                <div className="mb-3 bg-[#0f1117] p-2 rounded-[4px] border border-[#2a2d3e]">
                  <p
                    className="text-[11px] font-mono text-[#8b92a8] line-clamp-2 break-all select-all"
                    title={argsPreview}
                  >
                    {argsPreview || '{}'}
                  </p>
                </div>

                {/* Action Buttons: APPROVE & DENY */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApproveClick(approval.id)}
                    disabled={Boolean(inProgress)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#00e5a0]/15 hover:bg-[#00e5a0]/25 text-[#00e5a0] border border-[#00e5a0]/40 text-xs font-semibold font-sans tracking-wide transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{inProgress === 'approve' ? 'APPROVING...' : 'APPROVE'}</span>
                  </button>

                  <button
                    onClick={() => handleDenyClick(approval.id)}
                    disabled={Boolean(inProgress)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#ff4d6a]/15 hover:bg-[#ff4d6a]/25 text-[#ff4d6a] border border-[#ff4d6a]/40 text-xs font-semibold font-sans tracking-wide transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{inProgress === 'deny' ? 'DENYING...' : 'DENY'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
