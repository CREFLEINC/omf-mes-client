#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install_dir="${INSTALL_DIR:-$script_dir}"
non_interactive=0

front_bind_ip="${FRONT_BIND_IP:-}"
front_port="${FRONT_PORT:-}"
api_upstream="${API_UPSTREAM:-}"
image_repository="${IMAGE_REPOSITORY:-}"
image_tag="${IMAGE_TAG:-}"
healthcheck_attempts="${HEALTHCHECK_ATTEMPTS:-30}"
healthcheck_interval="${HEALTHCHECK_INTERVAL_SECONDS:-2}"

usage() {
  cat <<'EOF'
사용법: install-deploy.sh [옵션]

옵션:
  --version <web-vMAJOR.MINOR.PATCH> 배포할 정식 웹 릴리스 버전
  --bind-ip <IPv4>             프런트 서비스를 바인딩할 LAN IPv4 주소
  --port <1-65535>             외부에 공개할 TCP 포트
  --api-upstream <URL>         /api 요청을 전달할 백엔드 원점(경로 제외)
  --image-repository <이름>    레지스트리를 포함한 이미지 저장소
  --install-dir <경로>         설정을 생성할 디렉터리(기본: 스크립트 위치)
  --non-interactive            누락값을 질문하지 않고 실패
  -h, --help                   도움말

공개 이미지를 pull하므로 레지스트리 인증 정보는 받거나 저장하지 않습니다.
EOF
}

fail() {
  printf 'deploy error: %s\n' "$*" >&2
  exit 1
}

require_option_value() {
  local option="$1"
  local value="${2:-}"
  [[ -n "$value" && "$value" != --* ]] || fail "${option} 값이 필요합니다."
}

while (($# > 0)); do
  case "$1" in
    --version)
      require_option_value "$1" "${2:-}"
      image_tag="$2"
      shift 2
      ;;
    --bind-ip)
      require_option_value "$1" "${2:-}"
      front_bind_ip="$2"
      shift 2
      ;;
    --port)
      require_option_value "$1" "${2:-}"
      front_port="$2"
      shift 2
      ;;
    --api-upstream)
      require_option_value "$1" "${2:-}"
      api_upstream="$2"
      shift 2
      ;;
    --image-repository)
      require_option_value "$1" "${2:-}"
      image_repository="$2"
      shift 2
      ;;
    --install-dir)
      require_option_value "$1" "${2:-}"
      install_dir="$2"
      shift 2
      ;;
    --non-interactive)
      non_interactive=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      fail "알 수 없는 옵션입니다: $1"
      ;;
  esac
done

env_file="${install_dir}/.env"
compose_file="${install_dir}/compose.yaml"

load_existing_defaults() {
  local key
  local value

  [[ -f "$env_file" ]] || return 0
  while IFS='=' read -r key value; do
    case "$key" in
      FRONT_BIND_IP)
        [[ -n "$front_bind_ip" ]] || front_bind_ip="$value"
        ;;
      FRONT_PORT)
        [[ -n "$front_port" ]] || front_port="$value"
        ;;
      API_UPSTREAM)
        [[ -n "$api_upstream" ]] || api_upstream="$value"
        ;;
      IMAGE_REPOSITORY)
        [[ -n "$image_repository" ]] || image_repository="$value"
        ;;
      IMAGE_TAG)
        [[ -n "$image_tag" ]] || image_tag="$value"
        ;;
    esac
  done <"$env_file"
}

detect_lan_ip() {
  if command -v ip >/dev/null 2>&1; then
    ip -o -4 addr show scope global 2>/dev/null | awk 'NR == 1 { split($4, address, "/"); print address[1] }'
    return
  fi
  hostname -I 2>/dev/null | awk '{ print $1 }'
}

prompt_value() {
  local variable_name="$1"
  local label="$2"
  local default_value="$3"
  local value

  if [[ -n "$default_value" ]]; then
    read -r -p "${label} [${default_value}]: " value
    printf -v "$variable_name" '%s' "${value:-$default_value}"
  else
    read -r -p "${label}: " value
    printf -v "$variable_name" '%s' "$value"
  fi
}

valid_ipv4() {
  local value="$1"
  local octet
  local -a octets

  IFS='.' read -r -a octets <<<"$value"
  ((${#octets[@]} == 4)) || return 1
  for octet in "${octets[@]}"; do
    [[ "$octet" =~ ^[0-9]{1,3}$ ]] || return 1
    ((10#$octet <= 255)) || return 1
  done
}

load_existing_defaults

if ((non_interactive == 0)); then
  detected_ip="$(detect_lan_ip || true)"
  prompt_value image_tag "배포 버전" "$image_tag"
  prompt_value front_bind_ip "LAN 바인딩 IPv4" "${front_bind_ip:-$detected_ip}"
  prompt_value front_port "프런트 공개 포트" "${front_port:-8080}"
  prompt_value api_upstream "백엔드 원점(예: http://10.0.0.10:3100)" "$api_upstream"
  prompt_value image_repository "이미지 저장소(예: registry.example.com/group/front)" "$image_repository"
fi

[[ "$image_tag" =~ ^web-v[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
  fail "배포 버전은 web-vMAJOR.MINOR.PATCH 형식이어야 합니다."
valid_ipv4 "$front_bind_ip" || fail "LAN 바인딩 주소는 올바른 IPv4여야 합니다."
[[ "$front_port" =~ ^[0-9]+$ ]] || fail "포트는 숫자여야 합니다."
((10#$front_port >= 1 && 10#$front_port <= 65535)) || fail "포트는 1~65535 범위여야 합니다."
if [[ "$api_upstream" =~ ^https?://[A-Za-z0-9._-]+(:([0-9]{1,5}))?$ ]]; then
  api_port="${BASH_REMATCH[2]:-}"
  if [[ -n "$api_port" ]] && ((10#$api_port < 1 || 10#$api_port > 65535)); then
    fail "백엔드 원점 포트는 1~65535 범위여야 합니다."
  fi
else
  fail "백엔드 원점은 경로 없는 http(s) URL이어야 합니다."
fi
[[ "$image_repository" =~ ^[a-z0-9.-]+(:[0-9]+)?/[a-z0-9._-]+(/[a-z0-9._-]+)*$ ]] ||
  fail "이미지 저장소 형식이 올바르지 않습니다."
[[ "$healthcheck_attempts" =~ ^[1-9][0-9]*$ ]] || fail "헬스 체크 횟수는 양의 정수여야 합니다."
[[ "$healthcheck_interval" =~ ^[0-9]+$ ]] || fail "헬스 체크 간격은 0 이상의 정수여야 합니다."

command -v docker >/dev/null 2>&1 || fail "docker 명령을 찾을 수 없습니다."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2를 사용할 수 없습니다."
if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  fail "헬스 체크에 필요한 curl 또는 wget을 찾을 수 없습니다."
fi

mkdir -p -- "$install_dir"
umask 077
temporary_env="$(mktemp "${install_dir}/.env.tmp.XXXXXX")"
temporary_compose="$(mktemp "${install_dir}/compose.tmp.XXXXXX.yaml")"
trap 'rm -f -- "$temporary_env" "$temporary_compose"' EXIT

{
  printf 'FRONT_BIND_IP=%s\n' "$front_bind_ip"
  printf 'FRONT_PORT=%s\n' "$front_port"
  printf 'API_UPSTREAM=%s\n' "$api_upstream"
  printf 'IMAGE_REPOSITORY=%s\n' "$image_repository"
  printf 'IMAGE_TAG=%s\n' "$image_tag"
} >"$temporary_env"

cat >"$temporary_compose" <<'YAML'
name: omf-mes-front

services:
  front:
    image: '${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}:${IMAGE_TAG:?IMAGE_TAG is required}'
    pull_policy: always
    restart: unless-stopped
    init: true
    ports:
      - '${FRONT_BIND_IP:?FRONT_BIND_IP is required}:${FRONT_PORT:?FRONT_PORT is required}:8080'
    environment:
      API_UPSTREAM: '${API_UPSTREAM:?API_UPSTREAM is required}'
      NGINX_ENVSUBST_FILTER: '^API_UPSTREAM$'
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--output-document=-', 'http://127.0.0.1:8080/healthz']
      interval: 30s
      timeout: 3s
      start_period: 10s
      retries: 3
YAML

temporary_compose_command=(docker compose --env-file "$temporary_env" -f "$temporary_compose")
"${temporary_compose_command[@]}" config --quiet
printf '이미지를 가져오는 중입니다: %s:%s\n' "$image_repository" "$image_tag"
"${temporary_compose_command[@]}" pull

[[ ! -f "$env_file" ]] || cp -p -- "$env_file" "${env_file}.previous"
[[ ! -f "$compose_file" ]] || cp -p -- "$compose_file" "${compose_file}.previous"
mv -- "$temporary_env" "$env_file"
mv -- "$temporary_compose" "$compose_file"
trap - EXIT

compose_command=(docker compose --env-file "$env_file" -f "$compose_file")
"${compose_command[@]}" up -d --remove-orphans

health_url="http://${front_bind_ip}:${front_port}/healthz"
check_health() {
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error --max-time 3 "$health_url" 2>/dev/null
  else
    wget --quiet --timeout=3 --tries=1 --output-document=- "$health_url" 2>/dev/null
  fi
}

for ((attempt = 1; attempt <= healthcheck_attempts; attempt += 1)); do
  if [[ "$(check_health || true)" == 'ok' ]]; then
    printf '배포가 완료되었습니다: %s (%s:%s)\n' "$image_tag" "$front_bind_ip" "$front_port"
    "${compose_command[@]}" ps
    exit 0
  fi
  sleep "$healthcheck_interval"
done

"${compose_command[@]}" ps >&2 || true
"${compose_command[@]}" logs --tail=100 front >&2 || true
fail "${health_url} 헬스 체크에 실패했습니다. 이전 설정은 .previous 파일에서 확인할 수 있습니다."
