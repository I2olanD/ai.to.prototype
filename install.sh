#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR/plugin/skills/prototype"

HAS_CLAUDE=0
HAS_OPENCODE=0
CLAUDE_OK=0
OPENCODE_OK=0

if [ -t 1 ]; then
  GREEN="\033[0;32m"
  RED="\033[0;31m"
  BOLD="\033[1m"
  RESET="\033[0m"
else
  GREEN=""
  RED=""
  BOLD=""
  RESET=""
fi

detect_tools() {
  if command -v claude > /dev/null 2>&1; then
    HAS_CLAUDE=1
  fi

  if [ -d "$HOME/.config/opencode" ]; then
    HAS_OPENCODE=1
  fi

  if [ ! -f "$PLUGIN_DIR/SKILL.md" ]; then
    printf "${RED}Plugin source files not found at %s${RESET}\n" "$PLUGIN_DIR"
    printf "Run this script from the repository root.\n"
    exit 1
  fi

  if [ "$HAS_CLAUDE" -eq 0 ] && [ "$HAS_OPENCODE" -eq 0 ]; then
    printf "${RED}No supported tools detected.${RESET}\n\n"
    printf "Install Claude Code: https://claude.ai/claude-code\n"
    printf "Install OpenCode:    https://opencode.ai\n"
    exit 1
  fi
}

install_claude() {
  printf "${BOLD}Installing for Claude Code...${RESET}\n"

  if ! claude plugin marketplace add I2olanD/ai.to.interface-design; then
    printf "${RED}  plugin marketplace add failed${RESET}\n"
    return 1
  fi
  printf "${GREEN}  marketplace add OK${RESET}\n"

  if ! claude plugin install ai-to-interface-design@ai-to-interface-design; then
    printf "${RED}  plugin install failed${RESET}\n"
    return 1
  fi
  printf "${GREEN}  plugin install OK${RESET}\n"

  CLAUDE_OK=1
}

install_opencode() {
  printf "${BOLD}Installing for OpenCode...${RESET}\n"

  local target_dir="$HOME/.config/opencode/skills/prototype"

  if ! mkdir -p "$target_dir/references"; then
    printf "${RED}  failed to create skill directory${RESET}\n"
    return 1
  fi

  if ! cp "$PLUGIN_DIR/SKILL.md" "$target_dir/SKILL.md"; then
    printf "${RED}  failed to copy SKILL.md${RESET}\n"
    return 1
  fi
  printf "${GREEN}  SKILL.md OK${RESET}\n"

  if ! cp "$PLUGIN_DIR/references/dom-contract-v1.md" "$target_dir/references/dom-contract-v1.md"; then
    printf "${RED}  failed to copy dom-contract-v1.md${RESET}\n"
    return 1
  fi
  printf "${GREEN}  dom-contract-v1.md OK${RESET}\n"

  OPENCODE_OK=1
}

summarize() {
  printf "\n${BOLD}Summary${RESET}\n"

  if [ "$HAS_CLAUDE" -eq 1 ]; then
    if [ "$CLAUDE_OK" -eq 1 ]; then
      printf "  ${GREEN}✓${RESET} Claude Code\n"
    else
      printf "  ${RED}✗${RESET} Claude Code\n"
    fi
  fi

  if [ "$HAS_OPENCODE" -eq 1 ]; then
    if [ "$OPENCODE_OK" -eq 1 ]; then
      printf "  ${GREEN}✓${RESET} OpenCode\n"
    else
      printf "  ${RED}✗${RESET} OpenCode\n"
    fi
  fi
}

main() {
  detect_tools

  if [ "$HAS_CLAUDE" -eq 1 ]; then
    install_claude
  fi

  if [ "$HAS_OPENCODE" -eq 1 ]; then
    install_opencode
  fi

  summarize

  if [ "$CLAUDE_OK" -eq 1 ] || [ "$OPENCODE_OK" -eq 1 ]; then
    exit 0
  fi

  exit 1
}

main
