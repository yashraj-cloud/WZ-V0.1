import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';

interface AgentState {
  locked: boolean;
  tokenCount: number;
  usdSpent: number;
  callsThisMinute: number;
  toolCallsThisMinute: Record<string, number>;
  lastMinuteReset: number;
  lastHourReset: number;
}

interface AuditFinding {
  type: string;
  value: string;
  match?: string;
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

// In-memory store for human approvals
const pendingApprovals = new Map<string, PendingApproval>();

// Initialize SQLite database
const db = new Database('workerzero.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    agentId TEXT,
    toolName TEXT,
    toolArgs TEXT,
    decision TEXT,
    reason TEXT,
    severity TEXT,
    message TEXT,
    traceHash TEXT,
    findings TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_agentId ON audit_events(agentId);
`);

// In-memory per-agent state
const agents: Record<string, AgentState> = {};

function getOrCreateAgent(agentId: string): AgentState {
  const now = Date.now();
  if (!agents[agentId]) {
    agents[agentId] = {
      locked: false,
      tokenCount: 0,
      usdSpent: 0,
      callsThisMinute: 0,
      toolCallsThisMinute: {},
      lastMinuteReset: now,
      lastHourReset: now,
    };
  } else {
    const agent = agents[agentId];
    if (now - agent.lastMinuteReset >= 60000) {
      agent.callsThisMinute = 0;
      agent.toolCallsThisMinute = {};
      agent.lastMinuteReset = now;
    }
    if (now - agent.lastHourReset >= 3600000) {
      agent.lastHourReset = now;
    }
  }
  return agents[agentId];
}

function getAuditStats() {
  const row = db
    .prepare(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN decision = 'BLOCK' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN decision = 'REDACT' THEN 1 ELSE 0 END) AS redacted,
        SUM(CASE WHEN decision = 'ALLOW' THEN 1 ELSE 0 END) AS allowed,
        SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical
      FROM audit_events`
    )
    .get() as any;

  return {
    total: Number(row?.total) || 0,
    blocked: Number(row?.blocked) || 0,
    redacted: Number(row?.redacted) || 0,
    allowed: Number(row?.allowed) || 0,
    critical: Number(row?.critical) || 0,
  };
}

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

function broadcast(data: any) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('WebSocket send error:', err);
      }
    }
  }
}

wss.on('connection', (ws) => {
  const stats = getAuditStats();
  const waitingApprovals = Array.from(pendingApprovals.values())
    .filter((a) => a.status === 'waiting')
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const connectedMsg = {
    type: 'CONNECTED',
    stats,
    agents,
    approvals: waitingApprovals,
  };
  ws.send(JSON.stringify(connectedMsg));
});

const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Blocked tool names for Check 2
const BLOCKED_TOOLS = [
  'delete_database',
  'drop_table',
  'transfer_funds',
  'wire_transfer',
  'send_all_data',
  'export_all_users',
  'disable_auth',
  'remove_firewall',
];

// Tools requiring human approval for Check 2b
const APPROVAL_REQUIRED_TOOLS = [
  'export_data',
  'send_email',
  'send_report',
  'publish',
  'notify_external',
];

// PII patterns for Check 3
const PII_PATTERNS = [
  { type: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: 'PHONE', regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'KEY', regex: /\b[sp]k_[a-zA-Z0-9_-]+\b/g },
  { type: 'SECRET', regex: /\b[a-zA-Z0-9_\-]*(?:api_key|secret)[a-zA-Z0-9_\-]*\b/gi },
];

/**
 * POST /intercept accepts agentId, toolName, toolArgs, tokenDelta, usdDelta.
 * Run these checks in order and stop at first violation:
 * Check 1 — if agent is locked return BLOCK, CRITICAL, CIRCUIT_BREAKER_TRIPPED.
 * Check 2 — if toolName contains any of these words: delete_database, drop_table,
 *            transfer_funds, wire_transfer, send_all_data, export_all_users, disable_auth,
 *            remove_firewall — return BLOCK, HIGH, BLOCKED_TOOL.
 * Check 3 — stringify toolArgs and scan for email addresses, phone numbers, SSN patterns,
 *            strings starting with sk_ or pk_, strings containing api_key or secret —
 *            replace each with [TYPE_REDACTED], return REDACT, MEDIUM, PII_DETECTED,
 *            include sanitizedArgs and findings array.
 * Check 4 — if same tool called more than 20 times per minute by same agent,
 *            lock agent, return BLOCK, CRITICAL, RUNAWAY_LOOP_DETECTED.
 * Check 5 — if tokenCount exceeds 5000 or usdSpent exceeds 5.00,
 *            lock agent, return BLOCK, CRITICAL, BUDGET_EXCEEDED.
 * Check 6 — return ALLOW, INFO, POLICY_PASS.
 * Log every call to audit_events and broadcast to all WebSocket clients.
 * Return HTTP 200 for ALLOW and REDACT, HTTP 403 for BLOCK.
 */
app.post('/intercept', (req, res) => {
  const { agentId, toolName, toolArgs, tokenDelta = 0, usdDelta = 0 } = req.body;

  if (!agentId || !toolName) {
    return res.status(400).json({
      error: 'Missing required parameters: agentId and toolName are required.',
    });
  }

  const agent = getOrCreateAgent(agentId);
  const rawArgsStr =
    typeof toolArgs === 'string' ? toolArgs : JSON.stringify(toolArgs ?? {});

  let decision = 'ALLOW';
  let severity = 'INFO';
  let reason = 'POLICY_PASS';
  let message = 'Policy pass: Tool execution permitted.';
  let sanitizedArgs: string | undefined = undefined;
  let findings: AuditFinding[] = [];
  let agentLocked = false;

  // Check 1: if agent is locked return BLOCK, CRITICAL, CIRCUIT_BREAKER_TRIPPED
  if (agent.locked) {
    decision = 'BLOCK';
    severity = 'CRITICAL';
    reason = 'CIRCUIT_BREAKER_TRIPPED';
    message = `Circuit breaker tripped: Agent '${agentId}' is locked.`;
  } else {
    // Check 2: if toolName contains any of blocked words return BLOCK, HIGH, BLOCKED_TOOL
    const lowerToolName = toolName.toLowerCase();
    const matchedBlockedWord = BLOCKED_TOOLS.find((word) =>
      lowerToolName.includes(word)
    );

    if (matchedBlockedWord) {
      decision = 'BLOCK';
      severity = 'HIGH';
      reason = 'BLOCKED_TOOL';
      message = `Tool execution blocked: '${toolName}' contains restricted word '${matchedBlockedWord}'.`;
    } else {
      // Check 2b: If toolName contains any of words: export_data, send_email, send_report, publish, notify_external
      const matchedApprovalWord = APPROVAL_REQUIRED_TOOLS.find((word) =>
        lowerToolName.includes(word)
      );

      if (matchedApprovalWord) {
        const approvalId = uuidv4();
        const createdAt = new Date().toISOString();
        const approvalObj: PendingApproval = {
          id: approvalId,
          agentId,
          toolName,
          toolArgs: toolArgs ?? {},
          tokenDelta: Number(tokenDelta) || 0,
          usdDelta: Number(usdDelta) || 0,
          status: 'waiting',
          createdAt,
          resolvedAt: null,
        };

        // Store in pendingApprovals map
        pendingApprovals.set(approvalId, approvalObj);

        // Broadcast to WebSocket clients with type PENDING_APPROVAL and full approval object
        broadcast({
          type: 'PENDING_APPROVAL',
          approval: approvalObj,
        });

        // Create audit record for PENDING decision
        const eventId = uuidv4();
        const timestamp = createdAt;
        const traceHash = crypto
          .createHash('sha256')
          .update(`${eventId}:${timestamp}:${agentId}:${toolName}:${rawArgsStr}`)
          .digest('hex');

        const auditRecord = {
          id: eventId,
          timestamp,
          agentId,
          toolName,
          toolArgs: rawArgsStr,
          decision: 'PENDING',
          reason: 'HUMAN_APPROVAL_REQUIRED',
          severity: 'MEDIUM',
          message: 'Human approval required before this tool can execute',
          traceHash,
          findings: JSON.stringify([]),
        };

        try {
          const insertStmt = db.prepare(`
            INSERT INTO audit_events (
              id, timestamp, agentId, toolName, toolArgs, decision, reason, severity, message, traceHash, findings
            ) VALUES (
              @id, @timestamp, @agentId, @toolName, @toolArgs, @decision, @reason, @severity, @message, @traceHash, @findings
            )
          `);
          insertStmt.run(auditRecord);
        } catch (err) {
          console.error('Error inserting audit record for pending approval:', err);
        }

        // Broadcast EVENT to WebSocket clients so it appears in audit log
        broadcast({
          type: 'EVENT',
          event: {
            ...auditRecord,
            findings: [],
          },
        });

        // Return HTTP 202 with decision PENDING, reason HUMAN_APPROVAL_REQUIRED, severity MEDIUM,
        // message Human approval required before this tool can execute, and approvalId in the response
        return res.status(202).json({
          id: eventId,
          timestamp,
          agentId,
          toolName,
          toolArgs: rawArgsStr,
          decision: 'PENDING',
          reason: 'HUMAN_APPROVAL_REQUIRED',
          severity: 'MEDIUM',
          message: 'Human approval required before this tool can execute',
          approvalId,
          traceHash,
        });
      }

      // Check 3: stringify toolArgs and scan for email addresses, phone numbers,
      // SSN patterns, strings starting with sk_ or pk_, strings containing api_key or secret —
      // replace each with [TYPE_REDACTED], return REDACT, MEDIUM, PII_DETECTED,
      // include sanitizedArgs and findings array.
      let currentArgs = rawArgsStr;
      const detectedFindings: AuditFinding[] = [];

      for (const p of PII_PATTERNS) {
        currentArgs = currentArgs.replace(p.regex, (match) => {
          if (match === '[TYPE_REDACTED]') return match;
          detectedFindings.push({ type: p.type, value: match, match });
          return '[TYPE_REDACTED]';
        });
      }

      if (detectedFindings.length > 0) {
        decision = 'REDACT';
        severity = 'MEDIUM';
        reason = 'PII_DETECTED';
        message = 'Sensitive data or credential detected in arguments. Redaction applied.';
        sanitizedArgs = currentArgs;
        findings = detectedFindings;

        // Account for tool usage on sanitized execution
        agent.callsThisMinute = (agent.callsThisMinute || 0) + 1;
        agent.toolCallsThisMinute[toolName] =
          (agent.toolCallsThisMinute[toolName] || 0) + 1;
        agent.tokenCount = (agent.tokenCount || 0) + (Number(tokenDelta) || 0);
        agent.usdSpent = Number(
          ((agent.usdSpent || 0) + (Number(usdDelta) || 0)).toFixed(4)
        );
      } else {
        // Check 4: if same tool called more than 20 times per minute by same agent,
        // lock agent, return BLOCK, CRITICAL, RUNAWAY_LOOP_DETECTED.
        agent.callsThisMinute = (agent.callsThisMinute || 0) + 1;
        const currentCalls = (agent.toolCallsThisMinute[toolName] || 0) + 1;
        agent.toolCallsThisMinute[toolName] = currentCalls;

        if (currentCalls > 20) {
          agent.locked = true;
          agentLocked = true;
          decision = 'BLOCK';
          severity = 'CRITICAL';
          reason = 'RUNAWAY_LOOP_DETECTED';
          message = `Runaway loop detected: '${toolName}' called ${currentCalls} times in current minute by agent '${agentId}' (limit: 20). Agent locked.`;
        } else {
          // Check 5: if tokenCount exceeds 5000 or usdSpent exceeds 5.00,
          // lock agent, return BLOCK, CRITICAL, BUDGET_EXCEEDED.
          agent.tokenCount =
            (agent.tokenCount || 0) + (Number(tokenDelta) || 0);
          agent.usdSpent = Number(
            ((agent.usdSpent || 0) + (Number(usdDelta) || 0)).toFixed(4)
          );

          if (agent.tokenCount > 5000 || agent.usdSpent > 5.0) {
            agent.locked = true;
            agentLocked = true;
            decision = 'BLOCK';
            severity = 'CRITICAL';
            reason = 'BUDGET_EXCEEDED';
            message = `Budget exceeded: tokenCount=${agent.tokenCount} (limit 5000) or usdSpent=$${agent.usdSpent.toFixed(2)} (limit $5.00). Agent locked.`;
          } else {
            // Check 6: return ALLOW, INFO, POLICY_PASS
            decision = 'ALLOW';
            severity = 'INFO';
            reason = 'POLICY_PASS';
            message = 'Policy pass: Tool execution permitted.';
          }
        }
      }
    }
  }

  // Create audit record
  const eventId = uuidv4();
  const timestamp = new Date().toISOString();
  const traceHash = crypto
    .createHash('sha256')
    .update(`${eventId}:${timestamp}:${agentId}:${toolName}:${rawArgsStr}`)
    .digest('hex');

  const auditRecord = {
    id: eventId,
    timestamp,
    agentId,
    toolName,
    toolArgs: rawArgsStr,
    decision,
    reason,
    severity,
    message,
    traceHash,
    findings: JSON.stringify(findings),
  };

  // Log to audit_events SQLite table
  try {
    const insertStmt = db.prepare(`
      INSERT INTO audit_events (
        id, timestamp, agentId, toolName, toolArgs, decision, reason, severity, message, traceHash, findings
      ) VALUES (
        @id, @timestamp, @agentId, @toolName, @toolArgs, @decision, @reason, @severity, @message, @traceHash, @findings
      )
    `);
    insertStmt.run(auditRecord);
  } catch (err) {
    console.error('Error inserting audit record:', err);
  }

  // Broadcast EVENT with full event object to all WebSocket clients
  broadcast({
    type: 'EVENT',
    event: {
      ...auditRecord,
      findings,
      ...(sanitizedArgs ? { sanitizedArgs } : {}),
    },
  });

  // On lock broadcast AGENT_LOCKED
  if (agentLocked) {
    broadcast({
      type: 'AGENT_LOCKED',
      agentId,
    });
  }

  // Build response object
  const responsePayload: any = {
    id: eventId,
    timestamp,
    agentId,
    toolName,
    toolArgs: rawArgsStr,
    decision,
    reason,
    severity,
    message,
    traceHash,
    findings,
  };

  if (decision === 'REDACT') {
    responsePayload.sanitizedArgs = sanitizedArgs;
  }

  // Return HTTP 200 for ALLOW and REDACT, HTTP 403 for BLOCK
  const statusCode = decision === 'BLOCK' ? 403 : 200;
  return res.status(statusCode).json(responsePayload);
});

// GET /audit returns last 100 events newest first. Supports query params agentId, decision, severity, limit.
app.get('/audit', (req, res) => {
  const { agentId, decision, severity } = req.query;
  const limitParam = parseInt(req.query.limit as string, 10);
  const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 100;

  const conditions: string[] = [];
  const params: any[] = [];

  if (agentId) {
    conditions.push('agentId = ?');
    params.push(agentId);
  }
  if (decision) {
    conditions.push('decision = ?');
    params.push(decision);
  }
  if (severity) {
    conditions.push('severity = ?');
    params.push(severity);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM audit_events ${whereClause} ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit);

  try {
    const rows = db.prepare(sql).all(...params) as any[];
    const events = rows.map((r) => {
      let parsedFindings: any = [];
      try {
        parsedFindings = JSON.parse(r.findings || '[]');
      } catch {
        parsedFindings = r.findings;
      }
      return {
        ...r,
        findings: parsedFindings,
      };
    });
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /audit/stats returns total, blocked, redacted, allowed, critical counts.
app.get('/audit/stats', (req, res) => {
  res.json(getAuditStats());
});

// GET /agents returns all in-memory agent states.
app.get('/agents', (req, res) => {
  res.json(agents);
});

// POST /agent/:agentId/reset clears agent from memory and broadcasts AGENT_RESET.
app.post('/agent/:agentId/reset', (req, res) => {
  const { agentId } = req.params;
  delete agents[agentId];
  broadcast({
    type: 'AGENT_RESET',
    agentId,
  });
  res.json({
    status: 'ok',
    agentId,
    message: `Agent '${agentId}' reset successfully.`,
  });
});

// POST /agent/:agentId/lock locks agent and broadcasts AGENT_LOCKED.
app.post('/agent/:agentId/lock', (req, res) => {
  const { agentId } = req.params;
  const agent = getOrCreateAgent(agentId);
  agent.locked = true;

  broadcast({
    type: 'AGENT_LOCKED',
    agentId,
  });

  res.json({
    status: 'ok',
    agentId,
    locked: true,
    message: `Agent '${agentId}' has been locked.`,
  });
});

// Human Approval Endpoints

// GET /approvals — returns all pending approvals with status waiting, newest first.
app.get('/approvals', (req, res) => {
  const waiting = Array.from(pendingApprovals.values())
    .filter((a) => a.status === 'waiting')
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  res.json(waiting);
});

// GET /approvals/:id/status — returns just the current status field of the approval. Agent polls every 2s.
app.get('/approvals/:id/status', (req, res) => {
  const { id } = req.params;
  const approval = pendingApprovals.get(id);
  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }
  res.json({ status: approval.status });
});

// GET /approvals/:id — returns single approval by id including current status.
app.get('/approvals/:id', (req, res) => {
  const { id } = req.params;
  const approval = pendingApprovals.get(id);
  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }
  res.json(approval);
});

// POST /approvals/:id/approve — sets status to approved, resolvedAt to now, broadcasts APPROVAL_RESOLVED with decision approved and approvalId. Returns success true.
app.post('/approvals/:id/approve', (req, res) => {
  const { id } = req.params;
  const approval = pendingApprovals.get(id);
  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }
  approval.status = 'approved';
  approval.resolvedAt = new Date().toISOString();

  broadcast({
    type: 'APPROVAL_RESOLVED',
    approvalId: id,
    decision: 'approved',
  });

  res.json({ success: true });
});

// POST /approvals/:id/deny — sets status to denied, resolvedAt to now, broadcasts APPROVAL_RESOLVED with decision denied and approvalId. Returns success true.
app.post('/approvals/:id/deny', (req, res) => {
  const { id } = req.params;
  const approval = pendingApprovals.get(id);
  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }
  approval.status = 'denied';
  approval.resolvedAt = new Date().toISOString();

  broadcast({
    type: 'APPROVAL_RESOLVED',
    approvalId: id,
    decision: 'denied',
  });

  res.json({ success: true });
});

// GET /health and GET /api/health return status ok, timestamp, totalEvents, activeAgents.
function getHealthHandler(req: express.Request, res: express.Response) {
  console.log(`[health] ${req.method} ${req.originalUrl} called at ${new Date().toISOString()}`);
  // NOTE: database query temporarily removed/non-fatal while diagnosing
  // silent process crashes. Just return ok: true so this endpoint cannot
  // fail due to DB access issues.
  try {
    res.json({ ok: true });
  } catch (err) {
    console.error('[health] error while sending response:', err);
    try {
      res.status(500).json({ ok: false });
    } catch (innerErr) {
      console.error('[health] failed to send error response:', innerErr);
    }
  }
}
app.get('/health', getHealthHandler);
app.get('/api/health', getHealthHandler);

// WebSocket upgrade handler
function handleUpgrade(req: http.IncomingMessage, socket: any, head: Buffer) {
  try {
    const pathname = (req.url || '').split('?')[0];
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  } catch (err) {
    console.error('WebSocket upgrade error:', err);
  }
}

// Catch any synchronous errors that escape all try/catch blocks. Without
// this handler, an uncaught exception silently kills the process with no
// log output, which manifests as "connection refused" for every request.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Uncaught exception, process may exit:', err);
});

// Catch any rejected promises that are never handled. Same failure mode as
// uncaughtException above — the process can crash silently otherwise.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection] Unhandled promise rejection:', reason, promise);
});

async function start() {
  try {
    const PORT = 3000;

    // Vite integration for development
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    // Primary Server on port 3000 (standard single full-stack port)
    const server = http.createServer(app);
    server.on('upgrade', handleUpgrade);

    // Catch errors binding/using the socket (e.g. EADDRINUSE, EACCES).
    // These can occur even after listen() is called and would otherwise
    // fail silently.
    server.on('error', (err) => {
      console.error('[server error] HTTP server encountered an error:', err);
    });

    // Catch malformed client requests at the socket level so they don't
    // crash the process or hang connections silently.
    server.on('clientError', (err, socket) => {
      console.error('[server clientError] Client connection error:', err);
      if (socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`WorkerZero server running on port ${PORT}`);
      console.log(`  ➜  Dashboard & Gateway API: http://0.0.0.0:${PORT}/`);
      console.log(`  ➜  Interception Endpoint:   http://0.0.0.0:${PORT}/intercept`);
      console.log(`  ➜  WebSocket Stream:        ws://0.0.0.0:${PORT}/ws`);
      console.log(`[start] server.listen callback reached — socket should be bound.`);
    });

    const shutdown = () => {
      server.close(() => {
        process.exit(0);
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[start] Error thrown during server startup:', err);
  }
}

start().catch((err) => {
  console.error('Failed to start WorkerZero server:', err);
});
