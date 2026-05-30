#!/bin/bash
#
# Black Pearl — Coral Source Setup
#
# Connects GitHub, Slack, and Google Calendar to Coral.
#
# Required env vars:
#   GITHUB_TOKEN               — GitHub PAT (or use device code flow via --interactive)
#   SLACK_TOKEN                — Slack bot/user OAuth token (xoxb-... or xoxp-...)
#   GOOGLE_CALENDAR_ACCESS_TOKEN — Google Calendar OAuth2 access token
#
# Usage:
#   export GITHUB_TOKEN=ghp_xxx
#   export SLACK_TOKEN=xoxb-xxx
#   export GOOGLE_CALENDAR_ACCESS_TOKEN=ya29.xxx
#   bash setup-coral.sh
#
# Or for interactive setup:
#   bash setup-coral.sh --interactive
#

set -e

MODE=""
if [ "$1" == "--interactive" ]; then
  MODE="--interactive"
fi

echo ""
echo "🪸  Black Pearl — Coral Source Setup"
echo "────────────────────────────────────────"
echo ""

# GitHub
echo "📦 Setting up GitHub..."
if [ -n "$GITHUB_TOKEN" ] || [ "$MODE" == "--interactive" ]; then
  coral source add github $MODE && echo "   ✅ GitHub connected" || echo "   ⚠️  GitHub setup failed"
else
  echo "   ⏭  GITHUB_TOKEN not set — skipping"
  echo "   Tip: export GITHUB_TOKEN=ghp_... or run with --interactive"
fi

echo ""

# Slack
echo "💬 Setting up Slack..."
if [ -n "$SLACK_TOKEN" ] || [ "$MODE" == "--interactive" ]; then
  coral source add slack $MODE && echo "   ✅ Slack connected" || echo "   ⚠️  Slack setup failed"
else
  echo "   ⏭  SLACK_TOKEN not set — skipping"
  echo "   Tip: export SLACK_TOKEN=xoxb-... or run with --interactive"
fi

echo ""

# Google Calendar
echo "📅 Setting up Google Calendar..."
if [ -n "$GOOGLE_CALENDAR_ACCESS_TOKEN" ] || [ "$MODE" == "--interactive" ]; then
  coral source add google_calendar $MODE && echo "   ✅ Google Calendar connected" || echo "   ⚠️  Google Calendar setup failed"
else
  echo "   ⏭  GOOGLE_CALENDAR_ACCESS_TOKEN not set — skipping"
  echo "   Tip: export GOOGLE_CALENDAR_ACCESS_TOKEN=ya29...."
fi

echo ""
echo "────────────────────────────────────────"
echo ""
echo "📋 Connected sources:"
coral source list
echo ""
echo "🧪 Testing tables..."
coral sql "SELECT schema_name, table_name, description FROM coral.tables" 2>&1
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. cd server && npm run dev     ← start backend"
echo "  2. cd .. && npx expo start      ← start app"
echo "  3. Tap 'Connect via Coral (Live)' in the app"
echo ""
