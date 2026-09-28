export interface AuditFinding {
  type: string;
  value: string;
  match?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  agentId: string;
  toolName: string;
  toolArgs: string;
  decision: 'ALLOW' | 'REDACT' | 'BLOCK' | 'PENDING';
  reason: string;
  severity: 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  traceHash: string;
  findings: AuditFinding[];
  sanitizedArgs?: string;
}

export interface PendingApproval {
  id: string;
  agentId: string;
  toolName: string;
  toolArgs: any;
  tokenDelta: number;
  usdDelta: number;
  status: 'waiting' | 'approved' | 'denied';
  createdAt: string;
  resolvedAt?: string | null;
}

export interface AgentState {
  locked: boolean;
  tokenCount: number;
  usdSpent: number;
  callsThisMinute: number;
  toolCallsThisMinute: Record<string, number>;
  lastMinuteReset: number;
  lastHourReset: number;
}

export interface AuditStats {
  total: number;
  blocked: number;
  redacted: number;
  allowed: number;
  critical: number;
}

export interface MinuteActivityBucket {
  time: string;
  allow: number;
  redact: number;
  block: number;
  total: number;
}
