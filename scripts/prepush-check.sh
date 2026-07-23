#!/usr/bin/env bash

set -euo pipefail

REMOTE="origin"
TARGET_BRANCH="main"
RUN_BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      RUN_BUILD=true
      shift
      ;;
    --target)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "Missing value for --target"
        echo "Usage: npm run prepush:check -- [--build] [--target <branch>] [--remote <remote>]"
        exit 1
      fi
      TARGET_BRANCH="${2:-}"
      shift 2
      ;;
    --remote)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "Missing value for --remote"
        echo "Usage: npm run prepush:check -- [--build] [--target <branch>] [--remote <remote>]"
        exit 1
      fi
      REMOTE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: npm run prepush:check -- [--build] [--target <branch>] [--remote <remote>]"
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET_BRANCH" || -z "$REMOTE" ]]; then
  echo "Remote and target branch are required."
  exit 1
fi

echo "Syncing refs from '$REMOTE'..."
git fetch --prune "$REMOTE"

if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
  echo "Repository is shallow. Unshallowing..."
  git fetch --unshallow "$REMOTE"
fi

echo "Fetching explicit target ref '$TARGET_BRANCH'..."
git fetch "$REMOTE" "${TARGET_BRANCH}:refs/remotes/${REMOTE}/${TARGET_BRANCH}"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Detached HEAD detected. Checkout a feature branch before pushing."
  exit 1
fi

echo "Current branch: $CURRENT_BRANCH"
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  echo "Do not push directly to protected branches '$CURRENT_BRANCH'. Use a feature branch and PR."
  exit 1
fi

echo "Verifying remotes and heads..."
git remote -v
git ls-remote --heads "$REMOTE"

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

echo
echo "Pre-push checks completed."
echo "If you still get GH013, treat it as branch policy rejection and fix the exact rule from the error message."
echo "Common fixes: required status checks, correct target branch, signed commits/signoff, and PR-only workflow."
