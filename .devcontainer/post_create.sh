#!/bin/bash
set -e

# Playwright (Chromium) のインストール
npx --yes playwright install-deps chromium

# Claude Code のインストール
npm install -g @anthropic-ai/claude-code
