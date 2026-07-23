#!/usr/bin/env bash

set -euo pipefail

REMOTE="origin"
TARGET_BRANCH="main"
RUN_BUILD=false
SKIP_UNSHALLOW=false
USAGE="Usage: npm run prepush:check -- [--build] [--skip-unshallow] [--target <branch>] [--remote <remote>] (flags can be combined in any order)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      RUN_BUILD=true
      shift
      ;;
    --skip-unshallow)
      SKIP_UNSHALLOW=true
      shift
      ;;
    --target)
      if [[ -z "${2:-}" || "${2:-}" == --* ]]; then
        echo "Error: --target requires a branch name"
        echo "$USAGE"
        exit 1
      fi
      TARGET_BRANCH="$2"
      shift 2
      ;;
    --remote)
      if [[ -z "${2:-}" || "${2:-}" == --* ]]; then
        echo "Error: --remote requires a remote name"
        echo "$USAGE"
        exit 1
      fi
      REMOTE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "$USAGE"
      exit 1
      ;;
  esac
done

echo "Syncing refs from '$REMOTE'..."
git fetch --prune "$REMOTE"

if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
  if [[ "$SKIP_UNSHALLOW" == "true" ]]; then
    echo "Repository is shallow and --skip-unshallow was set. Continuing without unshallowing."
  else
    echo "Repository is shallow. Converting to a full repository may take time on large repositories..."
    git fetch --unshallow "$REMOTE"
  fi
fi

echo "Fetching explicit target ref '$TARGET_BRANCH'..."
git fetch "$REMOTE" "${TARGET_BRANCH}:refs/remotes/${REMOTE}/${TARGET_BRANCH}"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Detached HEAD detected. Check out a feature branch before pushing."
  exit 1
fi

echo "Current branch: $CURRENT_BRANCH"
PROTECTED_BRANCHES=("main" "master")
if [[ "$TARGET_BRANCH" != "main" && "$TARGET_BRANCH" != "master" ]]; then
  PROTECTED_BRANCHES+=("$TARGET_BRANCH")
fi
for protected_branch in "${PROTECTED_BRANCHES[@]}"; do
  if [[ "$CURRENT_BRANCH" == "$protected_branch" ]]; then
    echo "Do not push directly to protected branch '$CURRENT_BRANCH'. Use a feature branch and PR."
    exit 1
  fi
done

echo "Verifying remotes and heads..."
git remote -v
if git ls-remote --heads "$REMOTE" >/dev/null; then
  echo "Remote head refs are reachable for '$REMOTE'."
fi

if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  echo "Upstream: $(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')"
else
  echo "No upstream configured for '$CURRENT_BRANCH' yet. Set it on first push."
fi

echo "Running required local checks..."
npm run typecheck
npm run test

if [[ "$RUN_BUILD" == "true" ]]; then
  echo "Running optional build check..."
  npm run build
fi

printf '\n'
echo "Pre-push checks completed."
echo "If you still get GH013 (GitHub branch/ruleset policy rejection), fix the exact rule from the error message."
echo "Common fixes: required status checks, correct target branch, missing commit signatures/sign-offs, and PR-only workflow requirements."
