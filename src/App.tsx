import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { AuditEvent, AgentState, AuditStats, PendingApproval } from './types';
import StatsRow from './components/StatsRow';
import ActivityChart from './components/ActivityChart';
import AuditLog from './components/AuditLog';
import DemoScenarios from './components/DemoScenarios';
import PendingApprovals from './components/PendingApprovals';
import ActiveAgents from './components/ActiveAgents';
import ActivePolicies from './components/ActivePolicies';
import LandingPage from './components/LandingPage';
import IntegratePage from './components/IntegratePage';
import ConnectPage from './components/ConnectPage';

export default function App() {
  // Simple state-based router with window.history.pushState
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Connects to gateway: use same-origin so requests always reach the backend in any environment (preview or local)
  const API_BASE = '';
  const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = typeof window !== 'undefined' && window.location.host ? window.location.host : '';
  const WS_URL = wsHost ? `${wsProtocol}//${wsHost}/ws` : '';

  // State
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    blocked: 0,
    redacted: 0,
    allowed: 0,
    critical: 0,
  });
  const [agents, setAgents] = useState<Record<string, AgentState>>({});
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [newestEventIds, setNewestEventIds] = useState<Set<string>>(new Set());
  const [agentPanelFlashRed, setAgentPanelFlashRed] = useState(false);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [newestApprovalIds, setNewestApprovalIds] = useState<Set<string>>(new Set());

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);

  // onMessageRef pattern - assign handler to a ref on every render so the socket always has the freshest closure
  const onMessageRef = useRef<((event: MessageEvent) => void) | null>(null);

  onMessageRef.current = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);

      if (data.type === 'CONNECTED') {
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.agents) {
          setAgents(data.agents);
        }
        if (data.approvals) {
          setApprovals(data.approvals);
        }
      } else if (data.type === 'PENDING_APPROVAL') {
        // Add new pending approval to the top with subtle pulse animation
        const newApproval: PendingApproval = data.approval;
        if (newApproval && newApproval.id) {
          setApprovals((prev) => {
            const filtered = prev.filter((a) => a.id !== newApproval.id);
            return [newApproval, ...filtered];
          });
          setNewestApprovalIds((prev) => new Set(prev).add(newApproval.id));
          setTimeout(() => {
            setNewestApprovalIds((prev) => {
              const next = new Set(prev);
              next.delete(newApproval.id);
              return next;
            });
          }, 3000);
        }
      } else if (data.type === 'APPROVAL_RESOLVED') {
        // Remove approval from list
        const resolvedId = data.approvalId;
        if (resolvedId) {
          setApprovals((prev) => prev.filter((a) => a.id !== resolvedId));
        }
      } else if (data.type === 'EVENT') {
        const newEvent: AuditEvent = data.event;

        // Prepend event to list with strict deduplication
        if (newEvent && newEvent.id) {
          setEvents((prev) => {
            const filtered = prev.filter((item) => item.id !== newEvent.id);
            return [newEvent, ...filtered].slice(0, 100);
          });

          // Flash cyan for 2 seconds
          setNewestEventIds((prev) => new Set(prev).add(newEvent.id));
          setTimeout(() => {
            setNewestEventIds((prev) => {
              const updated = new Set(prev);
              updated.delete(newEvent.id);
              return updated;
            });
          }, 2000);

          // If agent was locked by this event, flash active agents panel red for 1 second
          if (
            newEvent.reason === 'CIRCUIT_BREAKER_TRIPPED' ||
            newEvent.severity === 'CRITICAL'
          ) {
            setAgentPanelFlashRed(true);
            setTimeout(() => setAgentPanelFlashRed(false), 1000);
          }
        }

        // Update stats counters
        setStats((prev) => {
          const isAllowed = newEvent.decision === 'ALLOW';
          const isBlocked = newEvent.decision === 'BLOCK';
          const isRedacted = newEvent.decision === 'REDACT';
          const isCrit = newEvent.severity === 'CRITICAL';

          return {
            total: prev.total + 1,
            allowed: prev.allowed + (isAllowed ? 1 : 0),
            blocked: prev.blocked + (isBlocked ? 1 : 0),
            redacted: prev.redacted + (isRedacted ? 1 : 0),
            critical: prev.critical + (isCrit ? 1 : 0),
          };
        });

        // Refetch agents to keep counters synced
        fetchAgents();
      } else if (data.type === 'AGENT_LOCKED') {
        // Flash entire panel red for 1 second when any agent locks
        setAgentPanelFlashRed(true);
        setTimeout(() => setAgentPanelFlashRed(false), 1000);
        fetchAgents();
      } else if (data.type === 'AGENT_RESET') {
        fetchAgents();
      } else if (data.type === 'AUDIT_CLEARED') {
        setEvents([]);
        setStats({
          total: 0,
          blocked: 0,
          redacted: 0,
          allowed: 0,
          critical: 0,
        });
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  };

  // HTTP Fetch helpers
  const fetchAuditEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/audit?limit=50`);
      if (res.ok) {
        const data: AuditEvent[] = await res.json();
        setEvents((prev) => {
          const map = new Map<string, AuditEvent>();
          for (const item of data) {
            if (item && item.id) map.set(item.id, item);
          }
          for (const item of prev) {
            if (item && item.id && !map.has(item.id)) {
              map.set(item.id, item);
            }
          }
          return Array.from(map.values()).slice(0, 100);
        });
      }
    } catch (err) {
      console.warn('fetchAuditEvents warning:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/audit/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('fetchStats warning:', err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (err) {
      console.warn('fetchAgents warning:', err);
    }
  };

  const fetchApprovals = async () => {
    try {
      const res = await fetch(`${API_BASE}/approvals`);
      if (res.ok) {
        const data: PendingApproval[] = await res.json();
        setApprovals(data);
      }
    } catch (err) {
      console.warn('fetchApprovals warning:', err);
    }
  };

  const handleApprove = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDeny = (id: string) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  // Connect to WebSocket in a useEffect with empty dependency array
  useEffect(() => {
    let reconnectTimeout: any;

    function connectWs() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
        };

        ws.onmessage = (e) => {
          onMessageRef.current?.(e);
        };

        ws.onclose = () => {
          setConnected(false);
          reconnectTimeout = setTimeout(connectWs, 2000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.warn('WebSocket initial connection notice:', err);
        reconnectTimeout = setTimeout(connectWs, 2000);
      }
    }

    connectWs();

    // On connect fetch GET /audit?limit=50, GET /audit/stats, GET /agents, GET /approvals to populate UI
    fetchAuditEvents();
    fetchStats();
    fetchAgents();
    fetchApprovals();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Export Compliance Report (.txt) using current dashboard state
  const handleExportReport = () => {
    const timestamp = new Date().toISOString();
    const blockRate =
      stats.total > 0
        ? `${((stats.blocked / stats.total) * 100).toFixed(1)}%`
        : '0.0%';

    // AGENT STATUS section: agentId, ACTIVE or LOCKED status, usdSpent, callsThisMinute
    const agentEntries = Object.entries(agents) as [string, AgentState][];
    const agentLines =
      agentEntries.length > 0
        ? agentEntries
            .map(([agentId, st]) => {
              const status = st.locked ? 'LOCKED' : 'ACTIVE';
              const usdSpent =
                typeof st.usdSpent === 'number'
                  ? `$${st.usdSpent.toFixed(4)}`
                  : '$0.0000';
              const calls = st.callsThisMinute ?? 0;
              return `${agentId}: ${status} | usdSpent: ${usdSpent} | callsThisMinute: ${calls}`;
            })
            .join('\n')
        : 'No agents registered.';

    // AUDIT LOG section: last 50 events each on one line with timestamp, decision, toolName, agentId, reason, traceHash
    const logLines =
      events.length > 0
        ? events
            .slice(0, 50)
            .map((ev) => {
              return `${ev.timestamp} | ${ev.decision} | ${ev.toolName} | ${ev.agentId} | ${ev.reason} | ${ev.traceHash}`;
            })
            .join('\n')
        : 'No audit events recorded.';

    const reportContent = [
      'WORKERZERO COMPLIANCE REPORT',
      `Generated: ${timestamp}`,
      '================================================================================',
      '',
      'SUMMARY',
      '--------------------------------------------------------------------------------',
      `Total Intercepted: ${stats.total}`,
      `Allowed: ${stats.allowed}`,
      `Blocked: ${stats.blocked}`,
      `Redacted: ${stats.redacted}`,
      `Critical Events: ${stats.critical}`,
      `Block Rate: ${blockRate}`,
      '',
      'AGENT STATUS',
      '--------------------------------------------------------------------------------',
      agentLines,
      '',
      'AUDIT LOG',
      '--------------------------------------------------------------------------------',
      logLines,
      '',
      '================================================================================',
      'Generated by WorkerZero Runtime Gateway v1.0',
    ].join('\n');

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workerzero-report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear audit log from UI and server
  const handleClearAuditLog = async () => {
    setEvents([]);
    setStats({
      total: 0,
      blocked: 0,
      redacted: 0,
      allowed: 0,
      critical: 0,
    });
    try {
      await fetch(`${API_BASE}/audit`, { method: 'DELETE' });
    } catch (err) {
      console.warn('handleClearAuditLog warning:', err);
    }
  };

  // Route 1: Landing Page at root route /
  if (currentPath === '/') {
    return <LandingPage onNavigate={navigate} />;
  }

  // Route 2: Integrate Page at /integrate
  if (currentPath === '/integrate') {
    return (
      <IntegratePage
        onNavigate={navigate}
        apiBase={typeof window !== 'undefined' ? window.location.origin : ''}
      />
    );
  }

  // Route 2b: Connect Agent Page at /connect
  if (currentPath === '/connect') {
    return <ConnectPage onNavigate={navigate} />;
  }

  // Route 3: Dashboard at /dashboard (and default)
  return (
    <div className="min-h-screen bg-[#0f1117] text-[#f0f2f8] font-sans antialiased flex flex-col selection:bg-[#00d4ff]/20 selection:text-[#00d4ff]">
      {/* Fixed Header: 56px height, background #1a1d27, border-b #2a2d3e, no shadow */}
      <header className="h-[56px] sticky top-0 z-40 bg-[#1a1d27] border-b border-[#2a2d3e] px-6 flex items-center justify-between shadow-none">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
          {/* Left: logo icon 32px gradient square, "WorkerZero" 15px bold white, divider line, "Runtime Gateway" 12px muted */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
            title="Return to WorkerZero Home"
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

          {/* Center: navigation links DASHBOARD, INTEGRATE, and CONNECT AGENT — 13px medium weight, secondary text color. Active link has cyan color and 2px cyan underline */}
          <nav className="flex items-center gap-6 h-[56px]">
            <button
              onClick={() => navigate('/dashboard')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#00d4ff] border-b-2 border-[#00d4ff] cursor-pointer"
            >
              DASHBOARD
            </button>
            <button
              onClick={() => navigate('/integrate')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#8b92a8] hover:text-[#f0f2f8] transition-colors cursor-pointer border-b-2 border-transparent"
            >
              INTEGRATE
            </button>
            <button
              onClick={() => navigate('/connect')}
              className="h-full flex items-center text-[13px] font-medium font-sans text-[#8b92a8] hover:text-[#f0f2f8] transition-colors cursor-pointer border-b-2 border-transparent"
            >
              CONNECT AGENT
            </button>
          </nav>

          {/* Right: critical badge, EXPORT REPORT button, connection status pill badge */}
          <div className="flex items-center gap-3">
            {/* Critical pill badge if critical events exist */}
            {stats.critical > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ff4d6a]/15 border border-[#ff4d6a]/40 text-[#ff4d6a]">
                <span className="w-2 h-2 rounded-full bg-[#ff4d6a] animate-pulse" />
                <span className="text-[10px] font-bold tracking-wider uppercase font-sans">
                  {stats.critical} CRITICAL
                </span>
              </div>
            )}

            {/* EXPORT REPORT button — small outline button, border #2a2d3e, text secondary, rounded 6px, hover border cyan */}
            <button
              id="export-compliance-report-btn"
              onClick={handleExportReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[#2a2d3e] hover:border-[#00d4ff] text-[#8b92a8] hover:text-[#00d4ff] text-xs font-medium font-sans transition-colors cursor-pointer bg-transparent"
              title="Download WorkerZero Compliance Report (workerzero-report.txt)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT REPORT</span>
            </button>

            {/* Connection status — pill badge, green #00e5a0 when connected, red #ff4d6a when disconnected */}
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-medium ${
                connected
                  ? 'bg-[#00e5a0]/10 border-[#00e5a0]/30 text-[#00e5a0]'
                  : 'bg-[#ff4d6a]/10 border-[#ff4d6a]/30 text-[#ff4d6a]'
              }`}
            >
              {connected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5a0] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00e5a0]" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide font-sans">
                    CONNECTED
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-[#ff4d6a]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide font-sans">
                    DISCONNECTED
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard: max-w-7xl, spacious layout with 20px gap */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-5 md:p-6 space-y-5">
        {/* Top: stats row — 5 cards in a row */}
        <StatsRow stats={stats} />

        {/* Below stats: two columns. Left takes 65% width, Right sidebar takes 35% width. Gap 20px */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Left column (65% width) */}
          <div className="w-full lg:w-[65%] space-y-5 min-w-0">
            {/* Activity chart */}
            <ActivityChart events={events} />

            {/* Audit log */}
            <AuditLog
              events={events}
              newestEventIds={newestEventIds}
              onClear={handleClearAuditLog}
            />
          </div>

          {/* Right sidebar (35% width) */}
          <div className="w-full lg:w-[35%] space-y-5 shrink-0">
            {/* Demo scenarios */}
            <DemoScenarios apiBase={API_BASE} />

            {/* Human Approvals panel: between Demo Scenarios and Active Agents */}
            <PendingApprovals
              approvals={approvals}
              newestApprovalIds={newestApprovalIds}
              apiBase={API_BASE}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />

            {/* Active agents */}
            <ActiveAgents
              agents={agents}
              flashRed={agentPanelFlashRed}
              apiBase={API_BASE}
              onRefreshAgents={fetchAgents}
            />

            {/* Active policies */}
            <ActivePolicies />
          </div>
        </div>
      </main>
    </div>
  );
}