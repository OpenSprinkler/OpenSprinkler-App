#!/bin/sh

set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_directory/.." && pwd)

if ! command -v docker >/dev/null 2>&1; then
	echo "Docker is required for the containerized legacy browser suite." >&2
	exit 1
fi

temporary_directory=$(mktemp -d "${TMPDIR:-/tmp}/opensprinkler-browser.XXXXXX")
image_id_file="$temporary_directory/image-id"
image_name="opensprinkler-browser-tests:${temporary_directory##*/}"
container_name="${temporary_directory##*/}"

cleanup() {
	exit_status=$?
	trap - EXIT HUP INT TERM
	docker container rm --force "$container_name" >/dev/null 2>&1 || true
	docker image rm "$image_name" >/dev/null 2>&1 || true
	rm -f -- "$image_id_file"
	rmdir -- "$temporary_directory" 2>/dev/null || true
	exit "$exit_status"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

docker build \
	--file "$repository_root/test/karma-browser.Dockerfile" \
	--iidfile "$image_id_file" \
	--tag "$image_name" \
	"$repository_root/test"

image_id=$(sed -n '1p' "$image_id_file")
case "$image_id" in
	sha256:*) ;;
	*)
		echo "Docker did not report the built browser-test image ID." >&2
		exit 1
		;;
esac

docker run \
	--rm \
	--init \
	--name "$container_name" \
	--network none \
	--read-only \
	--shm-size 1g \
	--tmpfs /tmp:rw,nosuid,nodev,size=512m \
	--volume "$repository_root:/workspace:ro" \
	--workdir /workspace \
	"$image_id" "$@"
