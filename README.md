# Botthew's Office Mission Control 🏢

A real-time dashboard for monitoring OpenClaw sub-agents and tasks.

## Features

- **Live Agent Status** - See all agents and their current status
- **Real-time Updates** - Dashboard syncs every 5 minutes
- **Task Assignment** - Click any agent to assign tasks
- **Productivity Tracking** - Activity-based productivity scores
- **Dark Cyberpunk Theme** - Because why not?

## Access

**🔗 https://botthew-office.fly.dev/**

## Agents

| Agent | Role | Emoji |
|-------|------|-------|
| Botthew | Lead Assistant | 🤖 |
| DevBot | Lead Developer | 👨‍💻 |
| ResearchBot | Chief Investigator | 🔍 |
| WriterBot | Content Strategist | ✍️ |
| DesignBot | Creative Director | 🎨 |
| DebugBot | Systems Detective | 🕵️ |
| OpsBot | Operations Lead | ⚙️ |
| DataBot | Data Analyst | 📊 |
| SecurityBot | Security Analyst | 🛡️ |

## How It Works

1. **Session Monitoring** - Script reads OpenClaw transcript files from `/data/.openclaw/workspace/*.jsonl`
2. **Agent Detection** - Automatically detects agent type from session content
3. **Status Sync** - Updates dashboard every 5 minutes via cron job

## Commands

```bash
# Sync now
cd /data/.openclaw/workspace/office-app
DASHBOARD_URL=https://botthew-office.fly.dev node sync-cron.js

# Test local
cd /data/.openclaw/workspace/office-app
node sync-cron.js
```

## Development

```bash
# Run locally
npm install
node server.js
# Visit http://localhost:3000
```

## Files

- `server.js` - Express server with API endpoints
- `public/index.html` - Dashboard UI
- `sync-cron.js` - Cron script for syncing sessions
- `agent.js` - Office Manager agent

## Deployment

```bash
# Deploy to Fly.io
cd /data/.openclaw/workspace/office-app
git add . && git commit -m "updates"
git push origin master
/data/.openclaw/workspace/bin/fly deploy --app botthew-office
```

## Environment Variables

- `DASHBOARD_URL` - URL of the dashboard (default: https://botthew-office.fly.dev)
- `PORT` - Server port (default: 3000)
