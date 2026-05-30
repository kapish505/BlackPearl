/**
 * Black Pearl — Coral SQL Backend Server
 *
 * Wraps the Coral CLI so users can:
 *   1. Connect their own GitHub / Slack / Google Calendar accounts
 *   2. Query their data via cross-source SQL JOINs
 *
 * Endpoints:
 *   GET  /api/health             — check Coral CLI
 *   POST /api/sources/connect    — connect a user source (GitHub/Slack/Calendar)
 *   GET  /api/sources/status     — which sources are live
 *   GET  /api/tables             — available Coral tables
 *   POST /api/query              — run raw SQL
 *   GET  /api/operational        — full cross-source operational query
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import oauthRouter from './oauth.js';

const exec = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini (ensure GEMINI_API_KEY is in your environment)
const ai = new GoogleGenAI({});

app.use(cors());
app.use(express.json());

// Mount OAuth Routes
app.use('/api/auth', oauthRouter);

// ─── Per-user token store (in-memory, single-user for hackathon) ──────────────

const userTokens = {};

function getCoralEnv() {
  const env = { ...process.env };
  for (const [key, val] of Object.entries(userTokens)) {
    if (val) env[key] = val;
  }
  return env;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const coralBin = process.env.RENDER ? './bin/coral' : 'coral';

async function coralSQL(query) {
  try {
    const { stdout } = await exec(coralBin, ['sql', '--format', 'json', query], {
      timeout: 30_000,
      env: getCoralEnv(),
      maxBuffer: 10 * 1024 * 1024,
    });
    const trimmed = stdout.trim();
    if (!trimmed || trimmed === '[]') return [];
    try { return JSON.parse(trimmed); }
    catch { return []; }
  } catch (err) {
    throw new Error(err.stderr || err.message || 'Coral query failed');
  }
}

async function getConnectedSources() {
  try {
    const tables = await coralSQL('SELECT DISTINCT schema_name FROM coral.tables');
    return tables.map(t => t.schema_name);
  } catch { return []; }
}

// ─── Source Connection ────────────────────────────────────────────────────────

const SOURCE_ENV_MAP = {
  github: 'GITHUB_TOKEN',
  slack: 'SLACK_TOKEN',
  google_calendar: 'GOOGLE_CALENDAR_ACCESS_TOKEN',
  gmail: 'GMAIL_TOKEN',
  discord: 'DISCORD_TOKEN',
  linkedin: 'LINKEDIN_TOKEN',
};

/**
 * POST /api/sources/connect
 * Body: { source: 'github' | 'slack' | 'google_calendar' | 'gmail' | 'discord' | 'linkedin', token: string }
 *
 * Stores the user's token and runs `coral source add <name>`.
 */
app.post('/api/sources/connect', async (req, res) => {
  const { source, token } = req.body;

  if (!source || !token) {
    return res.status(400).json({ status: 'error', message: 'source and token are required' });
  }

  const envKey = SOURCE_ENV_MAP[source];
  if (!envKey) {
    return res.status(400).json({ status: 'error', message: `Unknown source: ${source}. Use: github, slack, google_calendar, gmail, discord, linkedin` });
  }

  // Store the token
  userTokens[envKey] = token;
  console.log(`[connect] Storing ${source} token (${token.substring(0, 8)}...)`);

  // Run coral source add with the token in env
  try {
    const env = getCoralEnv();
    const args = ['source', 'add'];

    // Custom sources need to use the --file flag pointing to the manifest
    if (['gmail', 'discord', 'linkedin'].includes(source)) {
      const manifestPath = new URL(`./coral-sources/${source}/manifest.yaml`, import.meta.url).pathname;
      args.push('--file', manifestPath);
    } else {
      args.push(source);
    }

    const { stdout, stderr } = await exec(coralBin, args, {
      timeout: 30_000,
      env,
    });
    console.log(`[connect] ✅ ${source} connected: ${stdout.trim()}`);

    // Verify the source appears in tables
    const sources = await getConnectedSources();

    res.json({
      status: 'ok',
      source,
      message: `${source} connected successfully`,
      connectedSources: sources,
    });
  } catch (err) {
    const msg = err.stderr || err.message;
    // If source already exists, that's fine
    if (msg.includes('already exists') || msg.includes('already configured')) {
      console.log(`[connect] ${source} already configured, token updated`);
      const sources = await getConnectedSources();
      res.json({ status: 'ok', source, message: `${source} reconnected`, connectedSources: sources });
    } else {
      console.error(`[connect] ✗ ${source}: ${msg}`);
      res.status(500).json({ status: 'error', source, message: msg });
    }
  }
});

/**
 * GET /api/sources/status
 * Returns which sources are connected and what tables are available.
 */
app.get('/api/sources/status', async (_req, res) => {
  try {
    const connectedSources = await getConnectedSources();
    const storedTokens = Object.entries(SOURCE_ENV_MAP)
      .filter(([_, envKey]) => !!userTokens[envKey])
      .map(([source]) => source);

    let tables = [];
    try {
      tables = await coralSQL('SELECT schema_name, table_name, description FROM coral.tables');
    } catch { }

    res.json({
      status: 'ok',
      connectedSources,
      storedTokens,
      tables,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Existing Routes ──────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    const { stdout } = await exec(coralBin, ['--version']);
    const sources = await getConnectedSources();
    res.json({ status: 'ok', version: stdout.trim(), sources });
  } catch {
    res.status(500).json({ status: 'error', message: 'Coral CLI not found' });
  }
});

app.get('/api/tables', async (_req, res) => {
  try {
    const tables = await coralSQL('SELECT schema_name, table_name, description FROM coral.tables');
    res.json({ status: 'ok', tables });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'sql field required' });
  const startMs = Date.now();
  try {
    const data = await coralSQL(sql);
    res.json({ status: 'ok', data, rowCount: data.length, query: sql, elapsedMs: Date.now() - startMs });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message, query: sql, elapsedMs: Date.now() - startMs });
  }
});

// ─── Cross-Source Operational Reality ──────────────────────────────────────────

app.get('/api/operational', async (_req, res) => {
  const connectedSources = await getConnectedSources();
  console.log(`[operational] Connected: ${connectedSources.join(', ') || 'none'}`);

  if (connectedSources.length === 0) {
    return res.json({ status: 'ok', timestamp: new Date().toISOString(), connectedSources, results: {}, queryLog: [] });
  }

  // 1. Get available tables and columns for context
  let schemaContext = 'Available tables and columns:\\n';
  try {
    const tables = await coralSQL('SELECT schema_name, table_name, description FROM coral.tables');
    const cols = await coralSQL('SELECT schema_name, table_name, column_name FROM coral.columns');
    for (const t of tables) {
      const tCols = cols.filter(c => c.schema_name === t.schema_name && c.table_name === t.table_name);
      const colStr = tCols.map(c => c.column_name).join(', ');
      schemaContext += `- ${t.schema_name}.${t.table_name}: ${t.description}\\n  Columns: ${colStr}\\n`;
    }
  } catch (err) {
    console.error('Failed to get schema for LLM', err);
    schemaContext += '(Error fetching schema)';
  }

  // 1.5. Dynamically determine the GitHub owner and repo if github is connected
  let githubOwner = 'kapish505'; // fallback
  let githubRepo = 'PocketGrav'; // fallback
  if (connectedSources.includes('github')) {
    try {
      const loginRes = await coralSQL('SELECT login FROM github.user LIMIT 1');
      if (loginRes.length > 0) githubOwner = loginRes[0].login;

      // Dynamically find the repo with the most operational pressure (most open issues/PRs), fallback to most recently pushed
      const repoRes = await coralSQL("SELECT name FROM github.user_repos ORDER BY open_issues DESC, pushed_at DESC LIMIT 1");
      if (repoRes.length > 0) githubRepo = repoRes[0].name;
    } catch (err) {
      console.warn('Could not dynamically fetch github context:', err);
      // Fallback to pushed_at if open_issues column isn't found
      try {
        const fallbackRes = await coralSQL("SELECT name FROM github.user_repos ORDER BY pushed_at DESC LIMIT 1");
        if (fallbackRes.length > 0) githubRepo = fallbackRes[0].name;
      } catch (e) {
         console.warn('Fallback dynamic repo fetch failed:', e);
      }
    }
  }

  // 2. Ask Gemini to generate 3 useful cross-source queries
  console.log('[operational] Synthesizing dynamic queries with Gemini...');
  const todayISO = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
  const prompt = `You are an expert SQL engineer for Coral (a cross-source query engine).
The user wants to detect "operational pressure" across their connected apps.
Here is the available schema:
${schemaContext}

Generate 3 SQL queries that find operational insights across these sources.
Include a mix of single-source and cross-source JOIN queries, for example:
- Today's calendar events
- Open GitHub PRs with review comments
- Cross-source: meetings that might relate to open PRs

CRITICAL RULES:
1. ONLY use tables and columns listed above. Double-check every column name exists.
2. For ANY queries involving 'github' tables (like github.pulls, github.issues, github.commits), you MUST include WHERE owner='${githubOwner}' AND repo='${githubRepo}'.
3. Coral SQL does NOT support date functions like DATE() or NOW(). Do not try to filter by recent dates, just return the most relevant rows using ORDER BY and LIMIT.
4. Coral SQL does NOT support ILIKE. Use LIKE instead.
5. Coral SQL does NOT support subqueries. Use simple queries only.
6. Always add LIMIT 15 to prevent oversized results.
7. Return STRICTLY a JSON object where keys are query names and values are SQL strings. No markdown.`;

  let queries = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    queries = JSON.parse(response.text);
    console.log('[operational] Dynamic queries generated:', Object.keys(queries));
  } catch (err) {
    console.error('[operational] LLM Synthesis failed, falling back to static queries:', err);
    // Fallback static queries
    if (connectedSources.includes('google_calendar')) queries.calendar = `SELECT summary, start_date_time, end_date_time FROM google_calendar.events ORDER BY start_date_time DESC LIMIT 15`;
    if (connectedSources.includes('github')) queries.github_prs = `SELECT title, state, html_url, created_at FROM github.pulls WHERE owner = '${githubOwner}' AND repo = '${githubRepo}' AND state = 'open' LIMIT 15`;
    if (connectedSources.includes('slack')) queries.slack_channels = `SELECT name, topic, purpose, num_members FROM slack.channels LIMIT 15`;
    if (connectedSources.includes('gmail')) queries.gmail = `SELECT snippet, history_id FROM gmail.messages LIMIT 15`;
  }

  const results = {};
  const queryLog = [];

  // Execute sequentially to prevent CPU thrashing on Render free tier (0.1 CPU)
  for (const ObjectEntry of Object.entries(queries)) {
    const name = ObjectEntry[0];
    const sql = ObjectEntry[1];
    const startMs = Date.now();
    try {
      const data = await coralSQL(sql);
      const elapsedMs = Date.now() - startMs;
      results[name] = { data, rowCount: data.length };
      queryLog.push({ name, sql, elapsedMs, status: 'ok', rowCount: data.length });
      console.log(`  ✓ ${name}: ${data.length} rows (${elapsedMs}ms)`);
    } catch (err) {
      const elapsedMs = Date.now() - startMs;
      results[name] = { data: [], rowCount: 0, error: err.message };
      queryLog.push({ name, sql, elapsedMs, status: 'error', error: err.message });
      console.error(`  ✗ ${name} failed:`, err.message);
    }
  }

  res.json({ status: 'ok', timestamp: new Date().toISOString(), connectedSources, results, queryLog });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('🪸  Black Pearl — Coral SQL Backend');
  console.log(`   Port: ${PORT}`);
  console.log('');
  console.log('   Source connection:');
  console.log('     POST /api/sources/connect   { source, token }');
  console.log('     GET  /api/sources/status');
  console.log('   Queries:');
  console.log('     GET  /api/operational');
  console.log('     POST /api/query');
  console.log('');
});
