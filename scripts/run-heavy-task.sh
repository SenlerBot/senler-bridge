#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
WORKSPACE_DISPATCHER="$SCRIPT_DIR/../../../../aibot-api/scripts/development/dispatch-heavy-task.sh"

for dispatcher_candidate in \
  "$WORKSPACE_DISPATCHER" \
  "$SCRIPT_DIR/../../../../../aibot-api/scripts/development/dispatch-heavy-task.sh"; do
  if [ -x "$dispatcher_candidate" ]; then
    exec "$dispatcher_candidate" "$@"
  fi
done

disable_gate='false'
command_started='false'
task='heavy task'

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      [ "$#" -ge 2 ] || {
        printf '[heavy-task-gate] error: %s requires a value\n' "$1" >&2
        exit 2
      }
      shift 2
      ;;
    --task)
      [ "$#" -ge 2 ] || {
        printf '[heavy-task-gate] error: %s requires a value\n' "$1" >&2
        exit 2
      }
      task="$2"
      shift 2
      ;;
    --disable)
      disable_gate='true'
      shift
      ;;
    --)
      shift
      command_started='true'
      break
      ;;
    *)
      printf '[heavy-task-gate] error: unknown option: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

[ "$command_started" = 'true' ] && [ "$#" -gt 0 ] || {
  printf '[heavy-task-gate] error: a command is required after --\n' >&2
  exit 2
}

is_truthy() {
  case "${1:-}" in
    '' | 0 | false | FALSE | no | NO | off | OFF) return 1 ;;
    *) return 0 ;;
  esac
}

if is_truthy "${HEAVY_TASK_GATE_ACTIVE:-}" ||
  [ "$disable_gate" = 'true' ] ||
  is_truthy "${CI:-}" ||
  [ -f /.dockerenv ]; then
  exec "$@"
fi

fallback_lock="${HEAVY_TASK_GATE_FALLBACK_LOCK:-${TMPDIR:-/tmp}/aibot-frontend-heavy-task.lock}"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$fallback_lock"
  flock -n 9 || {
    printf '[heavy-task-gate] error: another frontend heavy task is running (%s).\n' "$task" >&2
    exit 2
  }
  HEAVY_TASK_GATE_ACTIVE=1
  export HEAVY_TASK_GATE_ACTIVE
  exec "$@"
fi

fallback_lock_dir="${fallback_lock}.d"
cleanup_fallback_lock() {
  rm -f "$fallback_lock_dir/pid"
  rmdir "$fallback_lock_dir" 2>/dev/null || true
}

if ! mkdir "$fallback_lock_dir" 2>/dev/null; then
  lock_owner="$(sed -n '1p' "$fallback_lock_dir/pid" 2>/dev/null || true)"
  case "$lock_owner" in
    '' | *[!0-9]*) lock_owner='' ;;
  esac
  if [ -n "$lock_owner" ] && kill -0 "$lock_owner" 2>/dev/null; then
    printf '[heavy-task-gate] error: another frontend heavy task is running (%s).\n' "$task" >&2
    exit 2
  fi
  rm -f "$fallback_lock_dir/pid"
  rmdir "$fallback_lock_dir" 2>/dev/null || {
    printf '[heavy-task-gate] error: stale heavy-task lock cannot be recovered.\n' >&2
    exit 2
  }
  mkdir "$fallback_lock_dir" 2>/dev/null || {
    printf '[heavy-task-gate] error: another frontend heavy task started concurrently.\n' >&2
    exit 2
  }
fi
printf '%s\n' "$$" > "$fallback_lock_dir/pid"
trap cleanup_fallback_lock EXIT
trap 'exit 130' HUP INT TERM
HEAVY_TASK_GATE_ACTIVE=1
export HEAVY_TASK_GATE_ACTIVE
"$@"
