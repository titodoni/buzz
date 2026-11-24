#!/usr/bin/env bash
# Kiro PreToolUse guard. Reads the tool call as JSON on stdin. When the shell
# command is a `git commit` or `git push`, it checks the staged changes and
# exits 2 (block, message on stderr) if it finds:
#   1. encryption or privacy claims that product steering forbids
#   2. a service-role key, secret key, JWT, or database URL with a password
#   3. `.kiro` listed in .gitignore (tech steering: it must stay in version control)
# Anything else exits 0. Run it by hand: echo '{"command":"git commit"}' | scripts/hooks/precommit-guard.sh
set -u

input="$(cat)"
printf '%s' "$input" | grep -Eq 'git[[:space:]]+(commit|push)' || exit 0

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

problems=""

# Added lines only, in shipped text and code (not specs, ADRs, or steering,
# which quote the forbidden phrases in order to forbid them).
added="$(git diff --cached -U0 --no-color -- README.md app components lib docs/beta-install.md src-tauri/src 2>/dev/null \
  | grep -E '^\+[^+]' || true)"

claims='end-to-end|e2e encrypt|zero-knowledge|military[- ]grade|unhackable|(server|stranger|admin)s? (can ?not|can.t|cannot) (see|read)|hides? who (talks|is talking)|metadata (is )?(hidden|private)'
hits="$(printf '%s\n' "$added" | grep -Ein "$claims" || true)"
if [ -n "$hits" ]; then
  problems="${problems}Forbidden encryption or privacy wording (see .kiro/steering/product.md and docs/adr/0010):\n${hits}\n\n"
fi

secrets="$(git diff --cached -U0 --no-color 2>/dev/null \
  | grep -E '^\+[^+]' \
  | grep -E 'sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}|postgres(ql)?://[^:@<[:space:]]+:[^<@[:space:]]+@' || true)"
if [ -n "$secrets" ]; then
  problems="${problems}Possible secret in staged changes (service key, JWT, or database URL with a password):\n${secrets}\n\n"
fi

if git show :.gitignore 2>/dev/null | grep -Eq '^/?\.kiro/?$'; then
  problems="${problems}.kiro is listed in .gitignore. It must stay in version control.\n"
fi

if [ -n "$problems" ]; then
  printf 'precommit-guard blocked this command:\n\n%b' "$problems" >&2
  exit 2
fi
exit 0
