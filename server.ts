import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const __filename = typeof __filename !== 'undefined' ? __filename : '';
const __dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize SQLite Database with better-sqlite3
  const dbPath = path.join(__dirname, "workerzero.db");
  const db = new Database(dbPath);

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
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      firstSeen TEXT,
      userAgent TEXT,
      referrer TEXT
    )
  `);

  // In-memory per-agent state (starts completely empty)
  const agentsMap = new Map<string, {
    agentId: string;
    locked: boolean;
    tokenCount: number;
    usdSpent: number;
    callsThisMinute: number;
    toolCallsThisMinute: Map<string, number>;
    lastMinuteReset: number;
    lastHourReset: number;
    name: string;
    framework: string;
    owner: string;
    riskScore: number;
    lastAction: string;
  }>();

  // In-memory pendingApprovals map (starts completely empty)
  const pendingApprovalsMap = new Map<string, {
    id: string;
    agentId: string;
    toolName: string;
    toolArgs: any;
    tokenDelta: number;
    usdDelta: number;
    status: 'waiting' | 'approved' | 'denied';
    createdAt: string;
    resolvedAt?: string;
  }>();

  // Helper for traceHash
  function computeTraceHash(id: string, timestamp: string, agentId: string, decision: string): string {
    const raw = id + timestamp + agentId + decision;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  }

  // HTTP & WebSocket server setup
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<WebSocket>();

  function getStats() {
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN decision = 'BLOCK' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN decision = 'REDACT' OR decision = 'REDACTED' THEN 1 ELSE 0 END) as redacted,
        SUM(CASE WHEN decision = 'ALLOW' THEN 1 ELSE 0 END) as allowed,
        SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical
      FROM audit_events
    `).get() as any;

    const pending = Array.from(pendingApprovalsMap.values()).filter(a => a.status === 'waiting').length;

    return {
      total: row?.total || 0,
      blocked: row?.blocked || 0,
      redacted: row?.redacted || 0,
      allowed: row?.allowed || 0,
      critical: row?.critical || 0,
      pending: pending || 0,
    };
  }

  wss.on("connection", (ws) => {
    clients.add(ws);
    const stats = getStats();
    const agents = Array.from(agentsMap.values()).map(a => ({
      ...a,
      toolCallsThisMinute: Object.fromEntries(a.toolCallsThisMinute)
    }));
    const approvals = Array.from(pendingApprovalsMap.values()).filter(a => a.status === 'waiting');

    ws.send(JSON.stringify({
      type: "CONNECTED",
      stats,
      agents,
      approvals
    }));

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  function broadcast(data: any) {
    const payload = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  // PII & Secret scanning helper
  function scanToolArgs(toolArgs: any): { sanitized: any; findings: string[] } {
    const findings: string[] = [];
    const strArgs = typeof toolArgs === 'string' ? toolArgs : JSON.stringify(toolArgs);
    let sanitizedStr = strArgs;

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    if (emailRegex.test(sanitizedStr)) {
      findings.push("PII_EMAIL_DETECTED");
      sanitizedStr = sanitizedStr.replace(emailRegex, "[TYPE_REDACTED]");
    }

    const phoneRegex = /\b\d{10,}\b/g;
    if (phoneRegex.test(sanitizedStr)) {
      findings.push("PII_PHONE_DETECTED");
      sanitizedStr = sanitizedStr.replace(phoneRegex, "[TYPE_REDACTED]");
    }

    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    if (ssnRegex.test(sanitizedStr)) {
      findings.push("PII_SSN_DETECTED");
      sanitizedStr = sanitizedStr.replace(ssnRegex, "[TYPE_REDACTED]");
    }

    const keyRegex = /\b(sk_|pk_)[a-zA-Z0-9-_]{10,}\b/g;
    if (keyRegex.test(sanitizedStr)) {
      findings.push("SECRET_KEY_DETECTED");
      sanitizedStr = sanitizedStr.replace(keyRegex, "[TYPE_REDACTED]");
    }

    const secretRegex = /"?(api_key|secret)"?\s*[:=]\s*"?[^"\s}]+["s]?/gi;
    if (secretRegex.test(sanitizedStr)) {
      findings.push("CREDENTIAL_FIELD_DETECTED");
      sanitizedStr = sanitizedStr.replace(secretRegex, '"$1": "[TYPE_REDACTED]"');
    }

    let sanitized = sanitizedStr;
    try {
      sanitized = JSON.parse(sanitizedStr);
    } catch {
      // keep as string
    }

    return { sanitized, findings };
  }

  // POST /visitor endpoint
  app.post("/visitor", (req, res) => {
    const { visitorId, userAgent, referrer } = req.body;
    if (!visitorId) {
      return res.status(400).json({ error: "visitorId required" });
    }

    const existing = db.prepare("SELECT id FROM visitors WHERE id = ?").get(visitorId);
    if (existing) {
      return res.json({ counted: false });
    }

    const firstSeen = new Date().toISOString();
    db.prepare("INSERT INTO visitors (id, firstSeen, userAgent, referrer) VALUES (?, ?, ?, ?)").run(
      visitorId,
      firstSeen,
      userAgent || "",
      referrer || ""
    );

    res.json({ counted: true });
  });

  // GET /visitor/stats endpoint
  app.get("/visitor/stats", (req, res) => {
    const totalRow = db.prepare("SELECT COUNT(*) as cnt FROM visitors").get() as any;
    const totalUniqueVisitors = totalRow?.cnt || 0;

    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todayRow = db.prepare("SELECT COUNT(*) as cnt FROM visitors WHERE firstSeen LIKE ?").get(`${todayPrefix}%`) as any;
    const todayVisitors = todayRow?.cnt || 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekRow = db.prepare("SELECT COUNT(*) as cnt FROM visitors WHERE firstSeen >= ?").get(sevenDaysAgo) as any;
    const thisWeekVisitors = weekRow?.cnt || 0;

    res.json({
      totalUniqueVisitors,
      todayVisitors,
      thisWeekVisitors,
    });
  });

  // POST /intercept
  app.post("/intercept", (req, res) => {
    const { agentId, toolName, toolArgs, tokenDelta = 100, usdDelta = 0.05 } = req.body;

    if (!agentId || !toolName) {
      return res.status(400).json({ error: "agentId and toolName are required" });
    }

    if (!agentsMap.has(agentId)) {
      agentsMap.set(agentId, {
        agentId,
        locked: false,
        tokenCount: 0,
        usdSpent: 0,
        callsThisMinute: 0,
        toolCallsThisMinute: new Map(),
        lastMinuteReset: Date.now(),
        lastHourReset: Date.now(),
        name: agentId,
        framework: "ExternalAgent",
        owner: "Enterprise",
        riskScore: 10,
        lastAction: toolName,
      });
    }

    const agent = agentsMap.get(agentId)!;
    const now = Date.now();

    if (now - agent.lastMinuteReset > 60000) {
      agent.callsThisMinute = 0;
      agent.toolCallsThisMinute.clear();
      agent.lastMinuteReset = now;
    }

    agent.callsThisMinute++;
    const currentToolCalls = (agent.toolCallsThisMinute.get(toolName) || 0) + 1;
    agent.toolCallsThisMinute.set(toolName, currentToolCalls);

    agent.tokenCount += (tokenDelta ?? 100);
    agent.usdSpent += (usdDelta ?? 0.05);
    agent.lastAction = toolName;

    let decision = "ALLOW";
    let severity = "INFO";
    let reason = "POLICY_PASS";
    let message = "Transaction evaluated and approved by WorkerZero Gateway.";
    let sanitizedArgs = toolArgs;
    let findings: string[] = [];
    let httpStatus = 200;

    const lowerTool = (toolName || "").toLowerCase();

    if (agent.locked) {
      decision = "BLOCK";
      severity = "CRITICAL";
      reason = "CIRCUIT_BREAKER_TRIPPED";
      message = `Agent ${agentId} is locked due to circuit breaker trip.`;
      httpStatus = 403;
    }
    else if (
      lowerTool.includes("delete_database") ||
      lowerTool.includes("drop_table") ||
      lowerTool.includes("transfer_funds") ||
      lowerTool.includes("wire_transfer") ||
      lowerTool.includes("send_all_data") ||
      lowerTool.includes("export_all_users") ||
      lowerTool.includes("disable_auth") ||
      lowerTool.includes("remove_firewall")
    ) {
      decision = "BLOCK";
      severity = "HIGH";
      reason = "BLOCKED_TOOL";
      message = `Tool execution blocked: ${toolName} is restricted by enterprise policy.`;
      agent.riskScore = Math.min(100, agent.riskScore + 40);
      httpStatus = 403;
    }
    else if (
      lowerTool.includes("export_data") ||
      lowerTool.includes("send_email") ||
      lowerTool.includes("send_report") ||
      lowerTool.includes("publish") ||
      lowerTool.includes("notify_external")
    ) {
      const approvalId = uuidv4();
      const approval = {
        id: approvalId,
        agentId,
        toolName,
        toolArgs,
        tokenDelta: tokenDelta ?? 100,
        usdDelta: usdDelta ?? 0.05,
        status: 'waiting' as const,
        createdAt: new Date().toISOString(),
      };
      pendingApprovalsMap.set(approvalId, approval);

      decision = "PENDING";
      severity = "MEDIUM";
      reason = "HUMAN_APPROVAL_REQUIRED";
      message = "Action paused awaiting human operator sign-off.";
      httpStatus = 202;

      const eventId = uuidv4();
      const timestamp = new Date().toISOString();
      const traceHash = computeTraceHash(eventId, timestamp, agentId, decision);
      findings = ["HUMAN_REVIEW_GATE"];

      db.prepare(`
        INSERT INTO audit_events (id, timestamp, agentId, toolName, toolArgs, decision, reason, severity, message, traceHash, findings)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(eventId, timestamp, agentId, toolName, JSON.stringify(toolArgs), decision, reason, severity, message, traceHash, JSON.stringify(findings));

      const event = {
        id: eventId,
        timestamp,
        agentId,
        toolName,
        toolArgs,
        decision,
        reason,
        severity,
        message,
        traceHash,
        findings
      };

      broadcast({ type: "EVENT", event });
      broadcast({ type: "PENDING_APPROVAL", approval });

      return res.status(202).json({
        decision,
        reason,
        severity,
        message,
        approvalId,
        agentId,
        toolName
      });
    }
    else {
      const scan = scanToolArgs(toolArgs);
      if (scan.findings.length > 0) {
        decision = "REDACT";
        severity = "MEDIUM";
        reason = "PII_DETECTED";
        message = "Outbound payload contained sensitive credentials or PII which were redacted inline.";
        sanitizedArgs = scan.sanitized;
        findings = scan.findings;
        agent.riskScore = Math.min(100, agent.riskScore + 15);
      }
      else if (currentToolCalls > 20) {
        agent.locked = true;
        decision = "BLOCK";
        severity = "CRITICAL";
        reason = "RUNAWAY_LOOP_DETECTED";
        message = `Agent locked due to runaway execution loop (>20 calls/min for ${toolName}).`;
        agent.riskScore = 95;
        httpStatus = 403;
      }
      else if (agent.tokenCount > 5000 || agent.usdSpent > 5.00) {
        agent.locked = true;
        decision = "BLOCK";
        severity = "CRITICAL";
        reason = "BUDGET_EXCEEDED";
        message = `Agent locked: Budget limit exceeded (Tokens: ${agent.tokenCount}, USD: $${agent.usdSpent.toFixed(2)}).`;
        agent.riskScore = 90;
        httpStatus = 403;
      }
    }

    const eventId = uuidv4();
    const timestamp = new Date().toISOString();
    const traceHash = computeTraceHash(eventId, timestamp, agentId, decision);

    db.prepare(`
      INSERT INTO audit_events (id, timestamp, agentId, toolName, toolArgs, decision, reason, severity, message, traceHash, findings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, timestamp, agentId, toolName, JSON.stringify(sanitizedArgs), decision, reason, severity, message, traceHash, JSON.stringify(findings));

    const event = {
      id: eventId,
      timestamp,
      agentId,
      toolName,
      toolArgs: sanitizedArgs,
      decision,
      reason,
      severity,
      message,
      traceHash,
      findings
    };

    broadcast({ type: "EVENT", event });

    return res.status(httpStatus).json({
      decision,
      reason,
      severity,
      message,
      sanitizedArgs,
      findings,
      agentId,
      toolName
    });
  });

  // GET /audit
  app.get("/audit", (req, res) => {
    const { agentId, decision, severity, limit = 100 } = req.query;
    let query = "SELECT * FROM audit_events WHERE 1=1";
    const params: any[] = [];

    if (agentId) {
      query += " AND agentId = ?";
      params.push(agentId);
    }
    if (decision) {
      query += " AND decision = ?";
      params.push(decision);
    }
    if (severity) {
      query += " AND severity = ?";
      params.push(severity);
    }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(Number(limit));

    const rows = db.prepare(query).all(...params) as any[];
    const parsed = rows.map(r => ({
      ...r,
      toolArgs: (() => { try { return JSON.parse(r.toolArgs); } catch { return r.toolArgs; } })(),
      findings: (() => { try { return JSON.parse(r.findings); } catch { return []; } })(),
    }));
    res.json(parsed);
  });

  // GET /audit/stats
  app.get("/audit/stats", (req, res) => {
    res.json(getStats());
  });

  // GET /agents
  app.get("/agents", (req, res) => {
    const agents = Array.from(agentsMap.values()).map(a => ({
      ...a,
      toolCallsThisMinute: Object.fromEntries(a.toolCallsThisMinute)
    }));
    res.json(agents);
  });

  // POST /agent/:agentId/reset
  app.post("/agent/:agentId/reset", (req, res) => {
    const { agentId } = req.params;
    agentsMap.delete(agentId);
    broadcast({ type: "AGENT_RESET", agentId });
    res.json({ success: true, agentId });
  });

  // POST /agent/:agentId/lock
  app.post("/agent/:agentId/lock", (req, res) => {
    const { agentId } = req.params;
    if (!agentsMap.has(agentId)) {
      agentsMap.set(agentId, {
        agentId,
        locked: true,
        tokenCount: 0,
        usdSpent: 0,
        callsThisMinute: 0,
        toolCallsThisMinute: new Map(),
        lastMinuteReset: Date.now(),
        lastHourReset: Date.now(),
        name: agentId,
        framework: "ExternalAgent",
        owner: "Enterprise",
        riskScore: 90,
        lastAction: "Manually Locked",
      });
    } else {
      agentsMap.get(agentId)!.locked = true;
    }
    const agent = agentsMap.get(agentId)!;
    broadcast({ type: "AGENT_LOCKED", agent });
    res.json({ success: true, agent });
  });

  // GET /approvals
  app.get("/approvals", (req, res) => {
    const waiting = Array.from(pendingApprovalsMap.values())
      .filter(a => a.status === 'waiting')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(waiting);
  });

  // GET /approvals/:id/status
  app.get("/approvals/:id/status", (req, res) => {
    const { id } = req.params;
    const approval = pendingApprovalsMap.get(id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    res.json({ status: approval.status });
  });

  // POST /approvals/:id/approve
  app.post("/approvals/:id/approve", (req, res) => {
    const { id } = req.params;
    const approval = pendingApprovalsMap.get(id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    approval.status = 'approved';
    approval.resolvedAt = new Date().toISOString();

    const eventId = uuidv4();
    const timestamp = new Date().toISOString();
    const traceHash = computeTraceHash(eventId, timestamp, approval.agentId, "ALLOW");
    db.prepare(`
      INSERT INTO audit_events (id, timestamp, agentId, toolName, toolArgs, decision, reason, severity, message, traceHash, findings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, timestamp, approval.agentId, approval.toolName, JSON.stringify(approval.toolArgs), "ALLOW", "HUMAN_APPROVED", "INFO", "Action approved by human operator.", traceHash, JSON.stringify(["HUMAN_APPROVED"]));

    const event = {
      id: eventId,
      timestamp,
      agentId: approval.agentId,
      toolName: approval.toolName,
      toolArgs: approval.toolArgs,
      decision: "ALLOW",
      reason: "HUMAN_APPROVED",
      severity: "INFO",
      message: "Action approved by human operator.",
      traceHash,
      findings: ["HUMAN_APPROVED"]
    };

    broadcast({ type: "EVENT", event });
    broadcast({ type: "APPROVAL_RESOLVED", approval });
    res.json({ success: true, approval });
  });

  // POST /approvals/:id/deny
  app.post("/approvals/:id/deny", (req, res) => {
    const { id } = req.params;
    const approval = pendingApprovalsMap.get(id);
    if (!approval) {
      return res.status(404).json({ error: "Approval not found" });
    }
    approval.status = 'denied';
    approval.resolvedAt = new Date().toISOString();

    const eventId = uuidv4();
    const timestamp = new Date().toISOString();
    const traceHash = computeTraceHash(eventId, timestamp, approval.agentId, "BLOCK");
    db.prepare(`
      INSERT INTO audit_events (id, timestamp, agentId, toolName, toolArgs, decision, reason, severity, message, traceHash, findings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, timestamp, approval.agentId, approval.toolName, JSON.stringify(approval.toolArgs), "BLOCK", "HUMAN_DENIED", "HIGH", "Action denied by human operator.", traceHash, JSON.stringify(["HUMAN_DENIED"]));

    const event = {
      id: eventId,
      timestamp,
      agentId: approval.agentId,
      toolName: approval.toolName,
      toolArgs: approval.toolArgs,
      decision: "BLOCK",
      reason: "HUMAN_DENIED",
      severity: "HIGH",
      message: "Action denied by human operator.",
      traceHash,
      findings: ["HUMAN_DENIED"]
    };

    broadcast({ type: "EVENT", event });
    broadcast({ type: "APPROVAL_RESOLVED", approval });
    res.json({ success: true, approval });
  });

  // DELETE /audit
  app.delete("/audit", (req, res) => {
    db.exec("DELETE FROM audit_events");
    pendingApprovalsMap.clear();
    agentsMap.clear();
    broadcast({ type: "AUDIT_CLEARED" });
    res.json({ success: true });
  });

  // GET /health
  app.get("/health", (req, res) => {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM audit_events").get() as any;
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      totalEvents: row?.cnt || 0,
      activeAgents: Array.from(agentsMap.values()).filter(a => !a.locked).length,
    });
  });

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const viteServer = await createViteServer({
      server: { middlewareMode: true, hmr: false },
    });
    app.use(viteServer.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`WorkerZero Gateway running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
