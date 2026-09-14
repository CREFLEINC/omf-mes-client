#!/usr/bin/env bash
# 서명된 릴리스 APK 를 만든다.
#
# 사용법: VITE_API_BASE_URL=<주소> apps/mobile/scripts/release-build.sh
#
# 서명 키는 담당자 로컬에 있고 비밀번호는 Keychain 에만 있다. 이 스크립트가 꺼내 gradle 로
# 넘긴다 - 값이 저장소에도 셸 히스토리에도 argv 에도 남지 않는다.
#
# 준비와 배포 절차는 apps/mobile/RELEASE-BUILD.md 에 있다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./emulator-env.sh
source "$HERE/emulator-env.sh"

MOBILE="$(cd "$HERE/.." && pwd)"

KEYSTORE="${OMF_RELEASE_KEYSTORE:-$HOME/.secrets/omf-mes-client-android-release.jks}"
KEY_ALIAS="${OMF_RELEASE_KEY_ALIAS:-omf-mes-mobile}"
PASS_LABEL="omf-mes-client-android-release-storepass"

if [ ! -f "$KEYSTORE" ]; then
  echo "키스토어 없음: $KEYSTORE — RELEASE-BUILD.md 「별도 준비물 배치」를 먼저 보세요." >&2
  exit 1
fi

if ! security find-generic-password -s "$PASS_LABEL" >/dev/null 2>&1; then
  echo "Keychain 에 비밀번호 없음: $PASS_LABEL — 키스토어가 있어도 열 수 없습니다." >&2
  exit 1
fi

# API 주소는 웹 빌드 시점에 굳는다. 주지 않으면 기본값인 단말 자신(127.0.0.1)으로 굳어,
# 빌드도 설치도 성공한 채 조회만 전부 조용히 실패한다. 여기서 막는다.
API_BASE_URL="${VITE_API_BASE_URL:-}"
if [ -z "$API_BASE_URL" ] && [ -f "$MOBILE/.env.local" ]; then
  API_BASE_URL="$(sed -n 's/^[[:space:]]*VITE_API_BASE_URL=//p' "$MOBILE/.env.local" \
    | tail -1 | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
fi

if [ -z "$API_BASE_URL" ]; then
  echo "VITE_API_BASE_URL 이 없습니다 — 이대로 빌드하면 앱이 단말 자신을 부릅니다." >&2
  echo "  주소를 주거나 apps/mobile/.env.local 에 적으세요. 예시는 .env.example 에 있습니다." >&2
  exit 1
fi

# 평문 허용 설정을 먼저 만든다. 주소가 잘못되면 여기서 멈춘다 - 웹 빌드에 시간을 쓰기 전이다.
#
# 판정과 파일 생성은 release-network-config.mjs 에 있다. 이 빌드의 보안 경계라 시험할 수 있는
# 자리에 두었다(release-network-config.test.mjs).
echo "[1/5] 평문 HTTP 설정"
CLEARTEXT_HOST="$(node "$HERE/release-network-config.mjs" "$API_BASE_URL" "$MOBILE/android/app/src/release")"

if [ -n "$CLEARTEXT_HOST" ]; then
  echo "      평문 허용 — $CLEARTEXT_HOST 하나만"
else
  echo "      평문 허용 없음 — https 라 열 것이 없다"
fi

echo "[2/5] 웹 빌드 — API 기준 $API_BASE_URL"
VITE_API_BASE_URL="$API_BASE_URL" pnpm --filter @omf-mes/mobile build >/dev/null

echo "[3/5] 네이티브 동기화"
(cd "$MOBILE" && CAP_ALLOW_CLEARTEXT_HTTP="${CLEARTEXT_HOST:+1}" npx cap sync android >/dev/null)

echo "[4/5] 릴리스 APK 서명 빌드"
OMF_RELEASE_KEYSTORE="$KEYSTORE" \
OMF_RELEASE_KEY_ALIAS="$KEY_ALIAS" \
OMF_RELEASE_KEYSTORE_PASSWORD="$(security find-generic-password -s "$PASS_LABEL" -w)" \
  "$MOBILE/android/gradlew" -p "$MOBILE/android" --quiet assembleRelease

APK="$MOBILE/android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK" ]; then
  echo "서명된 APK 가 없습니다 — 서명이 붙지 않으면 이름이 app-release-unsigned.apk 입니다." >&2
  ls "$MOBILE/android/app/build/outputs/apk/release/" >&2 || true
  exit 1
fi

echo "[5/5] 서명 확인"
APKSIGNER="$(find "$ANDROID_HOME/build-tools" -maxdepth 2 -name apksigner 2>/dev/null | sort -V | tail -1)"
if [ -z "$APKSIGNER" ]; then
  echo "apksigner 없음 — $ANDROID_HOME/build-tools 에 build-tools 를 설치하세요." >&2
  exit 1
fi
"$APKSIGNER" verify --print-certs "$APK"

echo
echo "만들었습니다: $APK"
if [ -n "$CLEARTEXT_HOST" ]; then
  echo "평문 HTTP 는 $CLEARTEXT_HOST 에만 열려 있습니다. 다른 주소는 막힙니다."
  echo "그 서버가 CORS 응답 헤더를 주지 않으면 CAP_NATIVE_HTTP=1 도 함께 필요합니다."
fi
