#!/bin/bash

# Office State Sync Script
# Fetches OpenClaw sessions and updates the dashboard
# Run this via cron: */5 * * * * /data/.openclaw/workspace/office-app/sync.sh

DASHBOARD_URL="${DASHBOARD_URL:-https://botthew-office.fly.dev}"

echo "🏢 Syncing office state at $(date)"

# Get sessions from OpenClaw CLI (JSON format)
SESSIONS=$(openclaw sessions list --json 2>/dev/null)

if [ -z "$SESSIONS" ]; then
    echo "⚠️  No sessions found or OpenClaw CLI not available"
    exit 0
fi

# Count active sessions (updated in last 30 minutes)
ACTIVE_COUNT=$(echo "$SESSIONS" | grep -o '"updatedAt"' | wc -l)

echo "📊 Found $ACTIVE_COUNT sessions"

# Send to dashboard
RESPONSE=$(curl -s -X POST "$DASHBOARD_URL/api/update-state" \
    -H "Content-Type: application/json" \
    -d "$SESSIONS")

if [ "$RESPONSE" = '{"success":true}' ]; then
    echo "✅ Dashboard updated"
else
    echo "⚠️  Dashboard update response: $RESPONSE"
fi
