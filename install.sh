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

ask() {
  local prompt="$1"
  shift
  local options=("$@")
  local count=${#options[@]}

  printf "\n${BOLD}%s${RESET}\n" "$prompt"
  for i in "${!options[@]}"; do
    printf "  %d) %s\n" "$((i + 1))" "${options[$i]}"
  done

  while true; do
    printf "> "
    read -r choice
    if [ "$choice" -ge 1 ] 2>/dev/null && [ "$choice" -le "$count" ] 2>/dev/null; then
      return "$((choice - 1))"
    fi
    printf "  Enter a number between 1 and %d\n" "$count"
  done
}

detect_tools() {
  if [ ! -f "$PLUGIN_DIR/SKILL.md" ]; then
    printf "${RED}Plugin source files not found at %s${RESET}\n" "$PLUGIN_DIR"
    printf "Run this script from the repository root.\n"
    exit 1
  fi

  if command -v claude > /dev/null 2>&1; then
    HAS_CLAUDE=1
  fi

  if [ -d "$HOME/.config/opencode" ]; then
    HAS_OPENCODE=1
  fi

  if [ "$HAS_CLAUDE" -eq 0 ] && [ "$HAS_OPENCODE" -eq 0 ]; then
    printf "${RED}No supported tools detected.${RESET}\n\n"
    printf "Install Claude Code: https://claude.ai/claude-code\n"
    printf "Install OpenCode:    https://opencode.ai\n"
    exit 1
  fi
}

choose_tools() {
  if [ "$HAS_CLAUDE" -eq 1 ] && [ "$HAS_OPENCODE" -eq 1 ]; then
    ask "Install for which tool?" "Claude Code + OpenCode (both)" "Claude Code only" "OpenCode only"
    case $? in
      0) INSTALL_CLAUDE=1; INSTALL_OPENCODE=1 ;;
      1) INSTALL_CLAUDE=1; INSTALL_OPENCODE=0 ;;
      2) INSTALL_CLAUDE=0; INSTALL_OPENCODE=1 ;;
    esac
  elif [ "$HAS_CLAUDE" -eq 1 ]; then
    INSTALL_CLAUDE=1; INSTALL_OPENCODE=0
    printf "\nDetected: Claude Code\n"
  else
    INSTALL_CLAUDE=0; INSTALL_OPENCODE=1
    printf "\nDetected: OpenCode\n"
  fi
}

choose_scope() {
  ask "Install where?" "Global (user-wide)" "Project-local (current directory)"
  case $? in
    0) SCOPE="global" ;;
    1) SCOPE="local" ;;
  esac
}

install_claude() {
  if [ "$SCOPE" = "local" ]; then
    printf "\n${BOLD}Installing for Claude Code (project-local)...${RESET}\n"
    local target_dir=".claude/skills/prototype"

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
  else
    printf "\n${BOLD}Installing for Claude Code (global)...${RESET}\n"

    if ! claude plugin marketplace add I2olanD/ai.to.interface-design; then
      printf "${RED}  marketplace add failed${RESET}\n"
      return 1
    fi

    if ! claude plugin install ai-to-interface-design@ai-to-interface-design; then
      printf "${RED}  plugin install failed${RESET}\n"
      return 1
    fi
  fi

  CLAUDE_OK=1
}

install_opencode() {
  local target_dir

  if [ "$SCOPE" = "local" ]; then
    target_dir=".opencode/skills/prototype"
    printf "\n${BOLD}Installing for OpenCode (project-local)...${RESET}\n"
  else
    target_dir="$HOME/.config/opencode/skills/prototype"
    printf "\n${BOLD}Installing for OpenCode (global)...${RESET}\n"
  fi

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

  if [ "$INSTALL_CLAUDE" -eq 1 ]; then
    if [ "$CLAUDE_OK" -eq 1 ]; then
      printf "  ${GREEN}✓${RESET} Claude Code (%s)\n" "$SCOPE"
    else
      printf "  ${RED}✗${RESET} Claude Code\n"
    fi
  fi

  if [ "$INSTALL_OPENCODE" -eq 1 ]; then
    if [ "$OPENCODE_OK" -eq 1 ]; then
      printf "  ${GREEN}✓${RESET} OpenCode (%s)\n" "$SCOPE"
    else
      printf "  ${RED}✗${RESET} OpenCode\n"
    fi
  fi
}

main() {
  detect_tools
  choose_tools
  choose_scope

  if [ "${INSTALL_CLAUDE:-0}" -eq 1 ]; then
    install_claude
  fi

  if [ "${INSTALL_OPENCODE:-0}" -eq 1 ]; then
    install_opencode
  fi

  summarize

  if [ "$CLAUDE_OK" -eq 1 ] || [ "$OPENCODE_OK" -eq 1 ]; then
    exit 0
  fi

  exit 1
}

main
