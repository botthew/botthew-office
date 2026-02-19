#!/usr/bin/env node

/**
 * Office State Sync Agent
 * Fetches OpenClaw sessions and updates the Mission Control dashboard
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');

// Dashboard URL
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

// Agent role mappings
const AGENT_ROLES = {
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

// Get sessions from OpenClaw's transcript files
function getSessionsFromFiles() {
  const workspace = '/data/.openclaw/workspace';
  const sessions = {};
  const cutoff = Date.now() - (30 * 60 * 1000); // Last 30 minutes
  
  try {
    const files = fs.readdirSync(workspace);
    
    files.forEach(file => {
      if (!file.endsWith('.jsonl')) return;
      
      const filepath = `${workspace}/${file}`;
      const stats = fs.statSync(filepath);
      
      // Only consider recently active files
      if (stats.mtimeMs < cutoff) return;
      
      try {
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.trim().split('\n');
        
        // Get last line for status
        if (lines.length > 0) {
          const lastLine = JSON.parse(lines[lines.length - 1]);
          
          // Extract label from file or transcript
          let label = file.replace('.jsonl', '');
          
          // Try to determine agent type from context
          let agentName = inferAgentName(lastLine, label);
          
          if (agentName) {
            if (!sessions[agentName]) {
              sessions[agentName] = {
                name: agentName,
                ...AGENT_ROLES[agentName] || { emoji: '🤖', role: 'Team Member' },
                status: 'online',
                messages: 0,
                tokens: 0,
                files: []
              };
            }
            
            sessions[agentName].messages += 1;
            if (lastLine.tokens) {
              sessions[agentName].tokens += (lastLine.tokens || 0);
            }
            sessions[agentName].files.push(file);
          }
        }
      } catch (e) {
        // Skip unreadable files
      }
    });
  } catch (e) {
    console.error('Error reading workspace:', e.message);
  }
  
  return Object.values(sessions);
}

function inferAgentName(line, filename) {
  const content = JSON.stringify(line).toLowerCase();
  
  // Check for known agent patterns in labels/keys
  const patterns = {
    'DevBot': ['dev', 'code', 'git', 'debug', 'deploy'],
    'ResearchBot': ['research', 'search', 'web', 'docs'],
    'WriterBot': ['write', 'doc', 'readme', 'content'],
    'DesignBot': ['image', 'design', 'visual', 'asset'],
    'DebugBot': ['debug', 'error', 'log', 'issue'],
    'OpsBot': ['deploy', 'cron', 'config', 'infra'],
    'DataBot': ['data', 'query', 'analyze', 'stats'],
    'SecurityBot': ['security', 'auth', 'permission', 'secret'],
  };
  
  for (const [agent, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => content.includes(kw) || filename.toLowerCase().includes(kw))) {
      return agent;
    }
  }
  
  return null;
}

// Build dashboard state
function buildState(sessions) {
  const state = {};
  const now = Date.now();
  
  for (const [name, info] of Object.entries(AGENT_ROLES)) {
    const session = sessions.find(s => s.name === name);
    const isActive = session !== undefined && session.messages > 0;
    
    state[name] = {
      name,
      emoji: info.emoji,
      role: info.role,
      color: getAgentColor(name),
      status: isActive ? 'online' : 'idle',
      activeMinutes: isActive ? Math.floor((now - session?.files?.[0] ? getFileAge(session.files[0]) : 0) / 60000) : 0,
      messages: session?.messages || 0,
      tokens: session?.tokens || 0,
      productivity: calculateProductivity(session)
    };
  }
  
  return state;
}

function getFileAge(filepath) {
  try {
    return fs.statSync(filepath).mtimeMs;
  } catch {
    return Date.now();
  }
}

function getAgentColor(name) {
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

function calculateProductivity(session) {
  if (!session || session.messages === 0) {
    return Math.floor(Math.random() * 30) + 50;
  }
  
  // Productivity based on activity
  const base = 60;
  const messageBonus = Math.min(25, session.messages * 0.5);
  const tokenBonus = Math.min(15, session.tokens / 1000);
  
  return Math.min(100, Math.floor(base + messageBonus + tokenBonus));
}

// Send state to dashboard
async function updateDashboard(state) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(state);
    const url = new URL('/api/update-state', DASHBOARD_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log(`[${new Date().toISOString()}] ✅ Updated ${Object.keys(state).length} agents`);
      }
      resolve(res.statusCode === 200);
    });
    
    req.on('error', (e) => {
      console.error(`[${new Date().toISOString()}] ❌ Error: ${e.message}`);
      resolve(false);
    });
    
    req.write(data);
    req.end();
  });
}

// Main sync function
async function sync() {
  console.log(`\n🏢 Syncing office state at ${new Date().toISOString()}`);
  
  try {
    // Get active sessions from file system
    const sessions = getSessionsFromFiles();
    console.log(`📊 Found ${sessions.length} active sessions`);
    
    // Build state
    const state = buildState(sessions);
    
    // Update dashboard
    await updateDashboard(state);
    
  } catch (error) {
    console.error('Sync error:', error.message);
  }
}

// Run sync
sync();
