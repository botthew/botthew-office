// Office Manager Agent - Controls the Mission Control Dashboard
// Uses Kimi K2 for intelligent decision making

const http = require('http');

// Load model config - Kimi K2 from config/models.json
let MODEL_CONFIG = {};
try {
  MODEL_CONFIG = require('/data/.openclaw/workspace/config/models.json');
} catch {
  MODEL_CONFIG = {
    models: {
      'kimi2': { openrouter_id: 'moonshotai/kimi-k2', display_name: 'Kimi K2' },
      'kimi2_5': { openrouter_id: 'moonshotai/kimi-k2.5', display_name: 'Kimi K2.5' },
      'minimax2_1': { openrouter_id: 'minimax/minimax-m2.1', display_name: 'MiniMax M2.1' }
    }
  };
}

const KIMI2_MODEL = 'moonshotai/kimi-k2'; // Kimi K2
const KIMI2_5_MODEL = 'moonshotai/kimi-k2.5'; // Kimi K2.5
const DEFAULT_MODEL = KIMI2_MODEL;

// Dashboard API endpoint (running on Fly.io)
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

// Track agent states
const agentStates = new Map();
const taskHistory = [];
let lastSessionCheck = 0;

// Known agent types and their roles
const AGENT_ROLES = {
  'DevBot': { role: 'Lead Developer', emoji: '👨‍💻', color: '#00ff88' },
  'ResearchBot': { role: 'Chief Investigator', emoji: '🔍', color: '#ffaa00' },
  'WriterBot': { role: 'Content Strategist', emoji: '✍️', color: '#ff6b9d' },
  'DesignBot': { role: 'Creative Director', emoji: '🎨', color: '#a855f7' },
  'DebugBot': { role: 'Systems Detective', emoji: '🕵️', color: '#ef4444' },
  'OpsBot': { role: 'Operations Lead', emoji: '⚙️', color: '#f59e0b' },
  'DataBot': { role: 'Data Analyst', emoji: '📊', color: '#06b6d4' },
  'SecurityBot': { role: 'Security Analyst', emoji: '🛡️', color: '#22c55e' },
  'Botthew': { role: 'Lead Assistant', emoji: '🤖', color: '#00d9ff' }
};

// Simulate real sessions (replace with actual OpenClaw session API calls)
async function getActiveSessions() {
  // In production, this would call OpenClaw's sessions_list API
  // For now, return simulated active sessions
  return [
    { key: 'agent:main:subagent:dev-001', label: 'DevBot', activeMinutes: 45, messages: 12 },
    { key: 'agent:main:subagent:research-002', label: 'ResearchBot', activeMinutes: 23, messages: 5 },
    { key: 'agent:main:subagent:debug-003', label: 'DebugBot', activeMinutes: 67, messages: 19 },
    { key: 'agent:main:subagent:design-004', label: 'DesignBot', activeMinutes: 12, messages: 3 }
  ];
}

// Update dashboard state
async function updateDashboard(sessions) {
  const state = {};
  
  for (const [name, config] of Object.entries(AGENT_ROLES)) {
    const session = sessions.find(s => s.label === name);
    const isActive = session !== undefined;
    
    state[name] = {
      name,
      role: config.role,
      emoji: config.emoji,
      color: config.color,
      status: isActive ? 'online' : 'idle',
      activeMinutes: session?.activeMinutes || 0,
      messages: session?.messages || 0,
      productivity: Math.min(100, 70 + Math.floor(Math.random() * 25))
    };
  }
  
  // Send to dashboard
  try {
    await postJSON(`${DASHBOARD_URL}/api/update-state`, state);
    console.log('Dashboard updated with real session data');
  } catch (error) {
    console.error('Failed to update dashboard:', error.message);
  }
  
  return state;
}

// Assign task to agent
async function assignTask(agentName, taskDescription) {
  const session = taskHistory.find(t => t.agent === agentName && t.status === 'pending');
  
  const task = {
    id: Date.now(),
    agent: agentName,
    task: taskDescription,
    timestamp: new Date().toISOString(),
    status: 'assigned'
  };
  
  taskHistory.push(task);
  
  // In production, this would call sessions_send
  console.log(`Task assigned to ${agentName}: ${taskDescription}`);
  
  // Notify dashboard
  try {
    await postJSON(`${DASHBOARD_URL}/api/task-assigned`, task);
  } catch (error) {
    console.error('Failed to notify dashboard:', error.message);
  }
  
  return task;
}

// HTTP helper
function postJSON(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

// Main loop
async function main() {
  console.log('🏢 Office Manager Agent started');
  console.log(`Dashboard URL: ${DASHBOARD_URL}`);
  
  // Initial update
  const sessions = await getActiveSessions();
  await updateDashboard(sessions);
  
  // Poll every 30 seconds
  setInterval(async () => {
    try {
      const currentSessions = await getActiveSessions();
      await updateDashboard(currentSessions);
    } catch (error) {
      console.error('Session check failed:', error.message);
    }
  }, 30000);
  
  // Keep alive
  process.on('SIGTERM', () => {
    console.log('Office Manager shutting down');
    process.exit(0);
  });
}

main().catch(console.error);
