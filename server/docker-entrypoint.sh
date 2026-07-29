#!/bin/sh
# Companion entrypoint (linuxserver.io-style PUID/PGID/TZ). Starts as root, fixes ownership of the
# data dir to the requested uid/gid, optionally sets the timezone, then drops privileges and execs
# the app as PUID:PGID. Defaults to 1000:1000 (the node:alpine default user) when unset.
set -e
umask 077

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Timezone (only affects host log timestamps; the dashboard renders the controller's own local time).
# Non-fatal: tolerate a read-only /etc/localtime bind mount (a common linuxserver-style pattern).
if [ -n "${TZ:-}" ] && [ -f "/usr/share/zoneinfo/${TZ}" ]; then
	ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime 2>/dev/null || true
	echo "${TZ}" > /etc/timezone 2>/dev/null || true
fi

# Ensure the SQLite data dir exists and is writable by the requested user (handles bind mounts).
mkdir -p /data
chown -R "${PUID}:${PGID}" /data

echo "[entrypoint] starting as ${PUID}:${PGID} (TZ=${TZ:-unset})"
exec su-exec "${PUID}:${PGID}" "$@"
