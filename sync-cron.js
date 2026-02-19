#!/usr/bin/env node

/**
 * Office State Sync - Cron Job Script
 * 
 * This script is designed to be run periodically via cron.
 * Run with: node /data/.openclaw/workspace/office-app/sync-cron.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://botthew-office.fly.dev';
const WORKSPACE = '/data/.openclaw/workspace';

// Agent role mappings
const AGENTS = {
  'DevBot': { emoji: '👨‍💻', role: 'Lead Developer' },
  'ResearchBot': { emoji: '🔍', role: 'Chief Investigator' },
  'WriterBot': { emoji: '✍️', role: 'Content Strategist' },
  'DesignBot': { emoji: '🎨', role: 'Creative Director' },
  'DebugBot': { emoji: '🕵️', role: 'Systems Detective' },
  'OpsBot': { emoji: '⚙️', role: 'Operations Lead' },
  'DataBot': { emoji: '📊', role: 'Data Analyst' },
  'SecurityBot': { emoji: '🛡️', role: 'Security Analyst' },
  'Botthew': { emoji: '🤖', role: 'Lead Assistant' }
};

function getColor(name) {
  const colors = {
    'Botthew': '#00d9ff',
    'DevBot': '#00ff88',
    'ResearchBot': '#ffaa00',
    'WriterBot': '#ff6b9d',
    'DesignBot': '#a855f7',
    'DebugBot': '#ef4444',
    'OpsBot': '#f59e0b',
    'DataBot': '#06b6d4',
    'SecurityBot': '#22c55e'
  };
  return colors[name] || '#00ff41';
}

function inferAgent(filename, content) {
  const text = `${filename} ${content}`.toLowerCase();
  
  const patterns = {
    'DevBot': ['dev', 'code', 'git', 'deploy', 'debug'],
    'ResearchBot': ['research', 'search', 'web', 'fetch', 'docs'],
    'WriterBot': ['write', 'doc', 'readme', 'content'],
    'DesignBot': ['image', 'design', 'visual', 'asset'],
    'DebugBot': ['debug', 'error', 'log', 'issue'],
    'OpsBot': ['deploy', 'cron', 'config', 'build'],
    'DataBot': ['data', 'query', 'analyze'],
    'SecurityBot': ['security', 'auth', 'secret', 'token'],
  };
  
  for (const [agent, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => text.includes(kw))) return agent;
  }
  
  return 'Botthew';
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
    
    state[name] = {
      name,
      emoji: config.emoji,
      role: config.role,
      color: getColor(name),
      status: isActive ? 'online' : 'idle',
      tasks: session?.messages || 0,
      tokens: session?.tokens || 0,
      productivity: isActive 
        ? Math.min(100, 60 + Math.floor(session.messages * 2) + Math.floor(session.tokens / 100))
        : Math.floor(Math.random() * 30) + 50
    };
  }
  
  return state;
}

async function updateDashboard() {
  const state = buildState();
  
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

// Use https for Fly.io
const https = require('https');

// Run sync
async function run() {
  console.log(`\n🏢 Syncing office state at ${new Date().toISOString()}`);
  
  try {
    const activeCount = getActiveSessions().size;
    console.log(`📊 Found ${activeCount} active sessions`);
    
    const success = await updateDashboard();
    
    if (success) {
      console.log('✅ Dashboard updated\n');
    } else {
      console.log('⚠️  Dashboard update failed\n');
    }
  } catch (error) {
    console.error('❌ Sync error:', error.message);
    process.exit(1);
  }
}

run();
