#!/usr/bin/env bash
# 서명된 릴리스 APK 를 만든다.
#
# 사용법: VITE_API_BASE_URL=<주소> apps/mobile/scripts/release-build.sh
#
# 서명 키는 담당자 로컬에 있고 비밀번호는 Keychain 에만 있다. 이 스크립트가 꺼내 gradle 로
# 넘긴다 - 값이 저장소에도 셸 히스토리에도 argv 에도 남지 않는다.
#
# 준비와 배포 절차는 apps/mobile/README.md 「릴리스 APK 만들기」에 있다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./emulator-env.sh
source "$HERE/emulator-env.sh"

MOBILE="$(cd "$HERE/.." && pwd)"

KEYSTORE="${OMF_RELEASE_KEYSTORE:-$HOME/.secrets/omf-mes-client-android-release.jks}"
KEY_ALIAS="${OMF_RELEASE_KEY_ALIAS:-omf-mes-mobile}"
PASS_LABEL="omf-mes-client-android-release-storepass"

if [ ! -f "$KEYSTORE" ]; then
  echo "키스토어 없음: $KEYSTORE — README 「릴리스 APK 만들기」의 keytool 명령을 먼저 실행하세요." >&2
  exit 1
fi

if ! security find-generic-password -s "$PASS_LABEL" >/dev/null 2>&1; then
  echo "Keychain 에 비밀번호 없음: $PASS_LABEL — 키스토어가 있어도 열 수 없습니다." >&2
  exit 1
fi

# API 주소는 웹 빌드 시점에 굳는다. 주지 않으면 기본값인 단말 자신(127.0.0.1)으로 굳어,
# 빌드도 설치도 성공한 채 조회만 전부 조용히 실패한다. 여기서 막는다.
if [ -z "${VITE_API_BASE_URL:-}" ] && ! grep -qs '^VITE_API_BASE_URL=' "$MOBILE/.env.local"; then
  echo "VITE_API_BASE_URL 이 없습니다 — 이대로 빌드하면 앱이 단말 자신을 부릅니다." >&2
  echo "  주소를 주거나 apps/mobile/.env.local 에 적으세요. 본보기는 .env.example 에 있습니다." >&2
  exit 1
fi

echo "[1/4] 웹 빌드"
pnpm --filter @omf-mes/mobile build >/dev/null

echo "[2/4] 네이티브 동기화"
(cd "$MOBILE" && npx cap sync android >/dev/null)

echo "[3/4] 릴리스 APK 서명 빌드"
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

echo "[4/4] 서명 확인"
APKSIGNER="$(find "$ANDROID_HOME/build-tools" -maxdepth 2 -name apksigner 2>/dev/null | sort -V | tail -1)"
if [ -z "$APKSIGNER" ]; then
  echo "apksigner 없음 — $ANDROID_HOME/build-tools 에 build-tools 를 설치하세요." >&2
  exit 1
fi
"$APKSIGNER" verify --print-certs "$APK"

echo
echo "만들었습니다: $APK"
