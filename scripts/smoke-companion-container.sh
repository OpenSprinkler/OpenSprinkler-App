#!/bin/sh
# Build and exercise the exact production companion image used by Proxmox/GitHub releases.
set -eu

command -v docker >/dev/null 2>&1 || {
	echo "Docker is required for the companion container smoke test." >&2
	exit 1
}
command -v curl >/dev/null 2>&1 || {
	echo "curl is required for the companion container smoke test." >&2
	exit 1
}

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo_root"

smoke_parent=${TMPDIR:-/tmp}
smoke_dir=$(mktemp -d "$smoke_parent/opensprinkler-companion-smoke.XXXXXX")
container_name="opensprinkler-companion-smoke-$$"
image_name="opensprinkler-companion-smoke:$$"
image_built=0

cleanup() {
	status=$?
	trap - EXIT HUP INT TERM
	if docker container inspect "$container_name" >/dev/null 2>&1; then
		docker container rm --force "$container_name" >/dev/null 2>&1 || true
	fi
	if [ "$image_built" -eq 1 ]; then
		docker image rm "$image_name" >/dev/null 2>&1 || true
	fi
	case "$smoke_dir" in
		"$smoke_parent"/opensprinkler-companion-smoke.*) rm -rf -- "$smoke_dir" ;;
	esac
	exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

wait_for_healthy() {
	healthy=0
	attempt=0
	health_status=starting
	while [ "$attempt" -lt 120 ]; do
		health_status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_name")
		case "$health_status" in
			healthy) healthy=1; break ;;
			unhealthy|missing) break ;;
		esac
		running=$(docker inspect --format '{{.State.Running}}' "$container_name")
		[ "$running" = "true" ] || break
		attempt=$((attempt + 1))
		sleep 0.25
	done
	[ "$healthy" -eq 1 ]
}

stop_cleanly() {
	docker stop --time 7 "$container_name" >/dev/null
	exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$container_name")
	[ "$exit_code" = "0" ] || {
		docker logs "$container_name" >&2 || true
		echo "Companion exited with status $exit_code during graceful stop." >&2
		exit 1
	}
}

# Service-level env_file paths are resolved by Compose, not --env-file. Use an isolated project
# directory so validation never reads, creates, or overwrites the operator's real .env file.
cp .env.example "$smoke_dir/.env"
docker compose --project-directory "$smoke_dir" -f "$repo_root/docker-compose.yml" config --quiet

case "${SMOKE_PLATFORM:-}" in
	""|linux/amd64|linux/arm64) ;;
	*) echo "SMOKE_PLATFORM must be linux/amd64 or linux/arm64." >&2; exit 1 ;;
esac

if [ -n "${SMOKE_IMAGE:-}" ]; then
	image_repository=${SMOKE_IMAGE%@sha256:*}
	image_digest=${SMOKE_IMAGE##*@sha256:}
	if [ -z "$image_repository" ] || [ "$SMOKE_IMAGE" != "$image_repository@sha256:$image_digest" ]; then
		echo "SMOKE_IMAGE must be an immutable image reference ending in @sha256:<64 lowercase hex characters>." >&2
		exit 1
	fi
	case "$image_repository" in
		*@*) echo "SMOKE_IMAGE contains more than one digest separator." >&2; exit 1 ;;
	esac
	if [ "${#image_digest}" -ne 64 ]; then
		echo "SMOKE_IMAGE must contain a 64-character sha256 digest." >&2
		exit 1
	fi
	case "$image_digest" in
		*[!0-9a-f]*) echo "SMOKE_IMAGE contains an invalid sha256 digest." >&2; exit 1 ;;
	esac
	image_name=$SMOKE_IMAGE
	if [ -n "${SMOKE_PLATFORM:-}" ]; then
		docker pull --platform "$SMOKE_PLATFORM" "$image_name"
	else
		docker pull "$image_name"
	fi
else
	case "${SMOKE_PLATFORM:-}" in
		"") docker build --file server/Dockerfile --tag "$image_name" . ;;
		linux/amd64|linux/arm64)
			docker build --platform "$SMOKE_PLATFORM" --file server/Dockerfile --tag "$image_name" .
			;;
	esac
fi
image_built=1

# Production images must contain only the compiled entry and production dependencies.
docker run --rm --entrypoint sh "$image_name" -c \
	'test -f /app/dist-server/index.mjs && test -f /app/dist-server/index.mjs.map && test ! -e /app/server/index.ts && test ! -e /app/node_modules/tsx'

current_uid=$(id -u)
current_gid=$(id -g)
api_token='companion-smoke-token-0123456789abcdef'
docker run --detach --name "$container_name" \
	--publish 127.0.0.1::8080 \
	--volume "$smoke_dir:/data" \
	--health-interval 1s \
	--health-timeout 3s \
	--health-start-period 1s \
	--health-retries 10 \
	--env "PUID=$current_uid" \
	--env "PGID=$current_gid" \
	--env LISTEN_HOST=0.0.0.0 \
	--env PORT=8080 \
	--env DATABASE_PATH=/data/data.db \
	--env "API_TOKEN=$api_token" \
	--env CONTROLLER_BASE=http://192.0.2.1/ \
	--env CONTROLLER_TIMEOUT_MS=100 \
	--env POLL_INTERVAL_SEC=300 \
	"$image_name" >/dev/null

port_mapping=$(docker port "$container_name" 8080/tcp | sed -n '1p')
host_port=${port_mapping##*:}
case "$host_port" in
	''|*[!0-9]*) echo "Unable to determine the published companion port." >&2; exit 1 ;;
esac
base_url="http://127.0.0.1:$host_port"

if ! wait_for_healthy; then
	docker logs "$container_name" >&2 || true
	docker inspect --format '{{json .State.Health}}' "$container_name" >&2 || true
	echo "Companion image did not become healthy (status: $health_status)." >&2
	exit 1
fi

unauth_status=$(curl --silent --show-error --max-time 2 --output "$smoke_dir/health-unauthorized.json" \
	--write-out '%{http_code}' "$base_url/api/health")
[ "$unauth_status" = "401" ] || {
	echo "Unauthenticated health request returned HTTP $unauth_status (wanted 401)." >&2
	exit 1
}
curl --fail --silent --show-error --max-time 2 --header "Authorization: Bearer $api_token" \
	--output "$smoke_dir/health.json" "$base_url/api/health"
grep -F '"ok":true' "$smoke_dir/health.json" >/dev/null
grep -F '"companion":"v1"' "$smoke_dir/health.json" >/dev/null
curl --fail --silent --show-error --dump-header "$smoke_dir/page.headers" \
	--output "$smoke_dir/index.html" "$base_url/"
curl --fail --silent --show-error --dump-header "$smoke_dir/api.headers" \
	--header "Authorization: Bearer $api_token" \
	--output "$smoke_dir/health-second.json" "$base_url/api/health"
curl --fail --silent --show-error --output "$smoke_dir/home.js" "$base_url/home.js"
tr '[:upper:]' '[:lower:]' <"$smoke_dir/page.headers" >"$smoke_dir/page.headers.lower"
tr '[:upper:]' '[:lower:]' <"$smoke_dir/api.headers" >"$smoke_dir/api.headers.lower"
grep -F 'x-content-type-options: nosniff' "$smoke_dir/page.headers.lower" >/dev/null
grep -F "content-security-policy: frame-ancestors 'self'" "$smoke_dir/page.headers.lower" >/dev/null
grep -F 'cache-control: no-store' "$smoke_dir/api.headers.lower" >/dev/null
grep -F 'id="app"' "$smoke_dir/index.html" >/dev/null
grep -F 'assets/app.js' "$smoke_dir/home.js" >/dev/null

db_owner=$(stat -c '%u:%g' "$smoke_dir/data.db")
db_mode=$(stat -c '%a' "$smoke_dir/data.db")
[ "$db_owner" = "$current_uid:$current_gid" ] || {
	echo "Unexpected SQLite owner: $db_owner (wanted $current_uid:$current_gid)." >&2
	exit 1
}
[ "$db_mode" = "600" ] || {
	echo "Unexpected SQLite mode: $db_mode (wanted 600)." >&2
	exit 1
}

stop_cleanly

# Direct image users may select an IPv6-only listener even though Compose standardizes on IPv4.
# Include harmless surrounding whitespace accepted by loadConfig so the image health probe must apply
# the same normalization before selecting its loopback address.
docker container rm "$container_name" >/dev/null
docker run --detach --name "$container_name" \
	--volume "$smoke_dir:/data" \
	--health-interval 1s \
	--health-timeout 3s \
	--health-start-period 1s \
	--health-retries 10 \
	--env "PUID=$current_uid" \
	--env "PGID=$current_gid" \
	--env "LISTEN_HOST= ::1 " \
	--env PORT=8080 \
	--env DATABASE_PATH=/data/data.db \
	--env "API_TOKEN=$api_token" \
	--env CONTROLLER_BASE=http://192.0.2.1/ \
	--env CONTROLLER_TIMEOUT_MS=100 \
	--env POLL_INTERVAL_SEC=300 \
	"$image_name" >/dev/null
if ! wait_for_healthy; then
	docker logs "$container_name" >&2 || true
	docker inspect --format '{{json .State.Health}}' "$container_name" >&2 || true
	echo "IPv6-only companion image did not become healthy (status: $health_status)." >&2
	exit 1
fi
stop_cleanly

echo "Companion image/Compose smoke test passed (IPv4/IPv6 health, auth, and graceful stop verified)."
