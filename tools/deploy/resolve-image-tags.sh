#!/usr/bin/env bash

set -euo pipefail

: "${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}"
: "${REGISTRY_HOST:?REGISTRY_HOST is required}"
: "${GITHUB_EVENT_NAME:?GITHUB_EVENT_NAME is required}"
: "${GITHUB_REF:?GITHUB_REF is required}"
: "${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

[[ "$IMAGE_REPOSITORY" =~ ^[a-z0-9.-]+(:[0-9]+)?/[a-z0-9._-]+(/[a-z0-9._-]+)*$ ]] || {
  printf 'FRONT_IMAGE_REPOSITORY must be a lowercase registry/repository path.\n' >&2
  exit 1
}
[[ "$REGISTRY_HOST" =~ ^[a-z0-9.-]+(:[0-9]+)?$ ]] || {
  printf 'REGISTRY_HOST must be a lowercase host with an optional port.\n' >&2
  exit 1
}
[[ "$IMAGE_REPOSITORY" == "${REGISTRY_HOST}/"* ]] || {
  printf 'FRONT_IMAGE_REPOSITORY must belong to REGISTRY_HOST.\n' >&2
  exit 1
}

short_sha="${GITHUB_SHA:0:7}"
tags=("${IMAGE_REPOSITORY}:sha-${short_sha}")

[[ "$GITHUB_EVENT_NAME" == 'push' && "$GITHUB_REF" == refs/tags/* ]] || {
  printf 'Only release tag pushes can publish the front image.\n' >&2
  exit 1
}
[[ "$GITHUB_REF_NAME" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  printf 'Release tag must follow vMAJOR.MINOR.PATCH: %s\n' "$GITHUB_REF_NAME" >&2
  exit 1
}
tags+=("${IMAGE_REPOSITORY}:${GITHUB_REF_NAME}" "${IMAGE_REPOSITORY}:stable")

{
  printf 'registry=%s\n' "$REGISTRY_HOST"
  printf 'tags<<EOF\n'
  printf '%s\n' "${tags[@]}"
  printf 'EOF\n'
} >>"$GITHUB_OUTPUT"
