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
API_BASE_URL="${VITE_API_BASE_URL:-}"
if [ -z "$API_BASE_URL" ] && [ -f "$MOBILE/.env.local" ]; then
  API_BASE_URL="$(sed -n 's/^[[:space:]]*VITE_API_BASE_URL=//p' "$MOBILE/.env.local" \
    | tail -1 | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
fi

if [ -z "$API_BASE_URL" ]; then
  echo "VITE_API_BASE_URL 이 없습니다 — 이대로 빌드하면 앱이 단말 자신을 부릅니다." >&2
  echo "  주소를 주거나 apps/mobile/.env.local 에 적으세요. 본보기는 .env.example 에 있습니다." >&2
  exit 1
fi

# 방식과 호스트를 뽑는다. 상대 주소(/api)는 브라우저 프록시를 타라는 뜻이라 APK 에서는 서지
# 않는다 - URL 로 풀리지 않으면 여기서 빈 값이 되고 아래에서 걸린다.
API_PARTS="$(node -e 'try{const u=new URL(process.argv[1]);console.log(u.protocol.replace(":","")+" "+u.hostname)}catch{}' "$API_BASE_URL")"
API_SCHEME="${API_PARTS%% *}"
API_HOST="${API_PARTS##* }"

if [ -z "$API_SCHEME" ] || [ -z "$API_HOST" ]; then
  echo "VITE_API_BASE_URL 을 절대 주소로 읽을 수 없습니다: $API_BASE_URL" >&2
  echo "  APK 에는 브라우저 프록시가 없습니다 — http(s)://<IP>:<PORT>/api 형태로 주세요." >&2
  exit 1
fi

echo "[1/5] 웹 빌드 — API 기준 $API_BASE_URL"
VITE_API_BASE_URL="$API_BASE_URL" pnpm --filter @omf-mes/mobile build >/dev/null

# 릴리스 빌드는 평문 HTTP 를 막는다. 설계 결정 20 ① 이 운영 통신을 사내망 전용 평문으로
# 정했으므로 그 서버 하나에만 열어 준다.
#
# 호스트는 사내 주소라 저장소에 둘 수 없다 - 이 저장소는 공개다. 그래서 파일을 빌드 때 만들고
# app/src/release/ 는 gitignore 에 걸어 두었다. 없으면 릴리스는 평문을 막는 기본값으로 돈다.
RELEASE_SRC="$MOBILE/android/app/src/release"
case "$RELEASE_SRC" in
  */android/app/src/release) rm -rf "$RELEASE_SRC" ;;
  *) echo "예상 밖의 경로라 지우지 않습니다: $RELEASE_SRC" >&2; exit 1 ;;
esac

CAP_CLEARTEXT=""
if [ "$API_SCHEME" = "http" ]; then
  echo "[2/5] 평문 HTTP 허용 — $API_HOST 하나만 연다"
  CAP_CLEARTEXT=1
  mkdir -p "$RELEASE_SRC/res/xml"

  cat > "$RELEASE_SRC/res/xml/network_security_config.xml" <<XML
<?xml version="1.0" encoding="utf-8"?>
<!--
  빌드가 만든 파일이다. 손으로 고치지 않는다 - release-build.sh 가 매번 다시 쓴다.

  운영 서버 하나만 평문으로 연다(설계 결정 20 ①, 사내망 전용). 나머지 주소는 그대로 막힌다.
-->
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">$API_HOST</domain>
    </domain-config>
</network-security-config>
XML

  cat > "$RELEASE_SRC/AndroidManifest.xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<!-- 빌드가 만든 파일이다. 손으로 고치지 않는다 - release-build.sh 가 매번 다시 쓴다. -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!--
      Capacitor 가 usesCleartextTraffic="true" 를 넣는다 - 주소를 가리지 않는 전면 허용이다.
      networkSecurityConfig 가 있으면 minSdk 24 위에서 무시되지만, 매니페스트에 서로 다른 두
      정책이 남는다. 지워서 실제로 도는 정책 하나만 적히게 한다.
    -->
    <application
        android:networkSecurityConfig="@xml/network_security_config"
        tools:replace="android:networkSecurityConfig"
        tools:remove="android:usesCleartextTraffic" />
</manifest>
XML
else
  echo "[2/5] 평문 허용 없음 — $API_SCHEME 라 열 것이 없다"
fi

echo "[3/5] 네이티브 동기화"
(cd "$MOBILE" && CAP_ALLOW_CLEARTEXT_HTTP="$CAP_CLEARTEXT" npx cap sync android >/dev/null)

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
if [ -n "$CAP_CLEARTEXT" ]; then
  echo "평문 HTTP 는 $API_HOST 에만 열려 있습니다. 다른 주소는 막힙니다."
  echo "그 서버가 CORS 응답 헤더를 주지 않으면 CAP_NATIVE_HTTP=1 도 함께 필요합니다."
fi
