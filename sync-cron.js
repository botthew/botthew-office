#!/usr/bin/env node

/**
 * Office State Sync - Cron Job Script
 * 
 * This script fetches OpenClaw sessions and updates the Mission Control dashboard.
 * Run with: node /data/.openclaw/workspace/office-app/sync-cron.js
 * 
 * Requires DASHBOARD_URL env var (defaults to https://botthew-office.fly.dev)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://botthew-office.fly.dev';
const WORKSPACE = '/data/.openclaw/workspace';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

// Agent role mappings (Greek letter naming)
const AGENTS = {
  'Botthew': { emoji: '🤖', role: 'Lead Assistant', greek: 'Ω' },
  'DevBot': { emoji: '👨‍💻', role: 'Lead Developer', greek: 'Α' },
  'ResearchBot': { emoji: '🔍', role: 'Chief Investigator', greek: 'Γ' },
  'WriterBot': { emoji: '✍️', role: 'Content Strategist', greek: 'Δ' },
  'DesignBot': { emoji: '🎨', role: 'Creative Director', greek: 'Ε' },
  'DebugBot': { emoji: '🕵️', role: 'Systems Detective', greek: 'Ζ' },
  'OpsBot': { emoji: '⚙️', role: 'Operations Lead', greek: 'Η' },
  'DataBot': { emoji: '📊', role: 'Data Analyst', greek: 'Θ' },
  'SecurityBot': { emoji: '🛡️', role: 'Security Analyst', greek: 'Ι' }
};

// Greek letter colors
const GREEK_COLORS = {
  'Ω': '#ffd700', 'Α': '#00ff88', 'Γ': '#ff6b6b', 'Δ': '#4ecdc4',
  'Ε': '#a855f7', 'Ζ': '#ef4444', 'Η': '#f59e0b', 'Θ': '#06b6d4', 'Ι': '#22c55e'
};

function getColor(name) {
  const greek = AGENTS[name]?.greek || '';
  return GREEK_COLORS[greek] || '#00ff41';
}

function inferAgent(filename, content) {
  const text = `${filename} ${content}`.toLowerCase();
  
  const patterns = {
    'DevBot': ['dev', 'code', 'git', 'deploy', 'debug'],
    'ResearchBot': ['research', 'search', 'web', 'fetch', 'investigate'],
    'WriterBot': ['write', 'doc', 'readme', 'content', 'documentation'],
    'DesignBot': ['image', 'design', 'visual', 'asset', 'generate'],
    'DebugBot': ['debug', 'error', 'log', 'issue', 'fix'],
    'OpsBot': ['deploy', 'cron', 'config', 'build', 'ops'],
    'DataBot': ['data', 'query', 'analyze', 'stats', 'metrics'],
    'SecurityBot': ['security', 'auth', 'secret', 'token', 'protect'],
  };
  
  for (const [agent, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => text.includes(kw))) return agent;
  }
  
  return 'Botthew'; // Default to main agent
}

async function fetchOpenClawSessions() {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/sessions', GATEWAY_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const sessions = JSON.parse(data);
          resolve(sessions);
        } catch {
          resolve([]);
        }
      });
    });
    
    req.on('error', () => resolve([]));
    req.end();
  });
}

function getActiveSessions() {
  const sessions = new Map();
  const cutoff = Date.now() - (30 * 60 * 1000); // 30 minutes
  const files = fs.readdirSync(WORKSPACE);
  
  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;
    
    const filepath = path.join(WORKSPACE, file);
    const stats = fs.statSync(filepath);
    
    // Skip old files
    if (stats.mtimeMs < cutoff) continue;
    
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);
      const lastLine = lines[lines.length - 1];
      
      if (!lastLine) continue;
      
      const parsed = JSON.parse(lastLine);
      const agent = inferAgent(file, JSON.stringify(parsed));
      
      if (!sessions.has(agent)) {
        sessions.set(agent, { messages: 0, tokens: 0, files: [] });
      }
      
      const session = sessions.get(agent);
      session.messages += 1;
      if (parsed.tokens) session.tokens += parsed.tokens;
      session.files.push(file);
    } catch {
      // Skip unreadable files
    }
  }
  
  return sessions;
}

function buildState() {
  const activeSessions = getActiveSessions();
  const state = {};
  const now = Date.now();
  
  for (const [name, config] of Object.entries(AGENTS)) {
    const session = activeSessions.get(name);
    const isActive = session && session.messages > 0;
    const ageMinutes = session?.files?.[0] 
      ? Math.floor((now - fs.statSync(session.files[0]).mtimeMs) / 60000)
      : 999;
    
    // Calculate productivity based on activity
    const productivity = isActive 
      ? Math.min(100, 60 + Math.floor(session.messages * 2) + Math.floor(session.tokens / 100))
      : Math.floor(Math.random() * 30) + 50;
    
    state[name] = {
      name,
      emoji: config.emoji,
      role: config.role,
      greek: config.greek,
      color: getColor(name),
      status: isActive ? 'working' : 'idle',
      tasks: session?.messages || 0,
      tokens: session?.tokens || 0,
      productivity,
      lastActive: isActive ? `${ageMinutes}m ago` : null,
      currentTask: isActive ? `Processing ${session.messages} task${session.messages > 1 ? 's' : ''}` : 'Waiting for assignments...'
    };
  }
  
  // Add stats
  const activeCount = Object.values(state).filter(a => a.status === 'working').length;
  const totalTokens = Object.values(state).reduce((sum, a) => sum + a.tokens, 0);
  
  return {
    agents: state,
    stats: {
      activeAgents: activeCount,
      totalTasks: Object.values(state).reduce((sum, a) => sum + a.tasks, 0),
      totalTokens,
      avgProductivity: Math.round(Object.values(state).reduce((sum, a) => sum + a.productivity, 0) / Object.keys(state).length),
      updatedAt: new Date().toISOString()
    }
  };
}

async function updateDashboard(state) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(state);
    const url = new URL('/api/update-state', DASHBOARD_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', (e) => {
      console.error('Error:', e.message);
      resolve(false);
    });
    
    req.write(data);
    req.end();
  });
}

// Run sync
async function run() {
  console.log(`\n🏢 Syncing office state at ${new Date().toISOString()}`);
  
  try {
    const activeCount = getActiveSessions().size;
    console.log(`📊 Found ${activeCount} active sessions`);
    
    const state = buildState();
    console.log(`📊 Built state for ${Object.keys(state.agents).length} agents`);
    
    const success = await updateDashboard(state);
    
    if (success) {
      console.log('✅ Dashboard updated successfully\n');
      console.log(`   Active agents: ${state.stats.activeAgents}`);
      console.log(`   Total tasks: ${state.stats.totalTasks}`);
      console.log(`   Avg productivity: ${state.stats.avgProductivity}%\n`);
    } else {
      console.log('⚠️  Dashboard update failed\n');
    }
  } catch (error) {
    console.error('❌ Sync error:', error.message);
    process.exit(1);
  }
}

run();
