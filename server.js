const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory state
const agentState = {
  'Botthew': { status: 'online', tasks: 12, productivity: 85 },
  'DevBot': { status: 'online', tasks: 5, productivity: 92 },
  'ResearchBot': { status: 'online', tasks: 3, productivity: 88 },
  'WriterBot': { status: 'online', tasks: 7, productivity: 78 },
  'DesignBot': { status: 'online', tasks: 8, productivity: 95 },
  'DebugBot': { status: 'online', tasks: 4, productivity: 81 },
  'OpsBot': { status: 'online', tasks: 6, productivity: 87 },
  'DataBot': { status: 'online', tasks: 2, productivity: 90 },
  'SecurityBot': { status: 'online', tasks: 9, productivity: 93 }
};

const taskQueue = [];
const taskHistory = [];

// SSE clients
const sseClients = [];

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  sseClients.push(res);
  
  // Send initial state
  res.write(`data: ${JSON.stringify({ type: 'state', agents: agentState })}\n\n`);
  
  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index > -1) {
      sseClients.splice(index, 1);
    }
  });
});

// Broadcast updates to all SSE clients
const broadcast = (message) => {
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  });
};

// Get all agents
app.get('/api/agents', (req, res) => {
  res.json(agentState);
});

// Assign task to agent
app.post('/api/assign-task', (req, res) => {
  const { agent, task } = req.body;
  
  if (!agent || !task) {
    return res.status(400).json({ error: 'Missing agent or task' });
  }
  
  if (!agentState[agent]) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  const taskEntry = {
    id: Date.now(),
    agent,
    task,
    timestamp: new Date().toISOString(),
    status: 'assigned'
  };
  
  taskQueue.push(taskEntry);
  taskHistory.push(taskEntry);
  
  agentState[agent].tasks = (agentState[agent].tasks || 0) + 1;
  
  broadcast({
    type: 'task_assigned',
    task: taskEntry,
    agents: agentState
  });
  
  res.json({ success: true, task: taskEntry });
});

// Update agent status
app.post('/api/agent-status', (req, res) => {
  const { agent, status } = req.body;
  
  if (!agent || !status) {
    return res.status(400).json({ error: 'Missing agent or status' });
  }
  
  if (!agentState[agent]) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  agentState[agent].status = status;
  
  broadcast({
    type: 'status_update',
    agent,
    status,
    agents: agentState
  });
  
  res.json({ success: true });
});

// Get task history
app.get('/api/task-history', (req, res) => {
  res.json(taskHistory);
});

// Get task queue
app.get('/api/task-queue', (req, res) => {
  res.json(taskQueue);
});

// Root redirect
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});