#!/usr/bin/env bash
# 에뮬레이터 명령들이 함께 쓰는 환경. 다른 스크립트가 source 로 읽는다.
#
# 이 저장소의 웹 툴체인에는 JDK 도 Android SDK 도 없다. 셸 프로파일에 넣어 두지 않은
# 사람도 같은 결과를 얻도록 여기서 잡는다 - 잡히지 않은 채로 도는 것보다 낫다.

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# 에뮬레이터에서 호스트를 가리키는 주소. 단말의 127.0.0.1 은 단말 자신이라 목 서버에 닿지 않는다.
export EMULATOR_HOST_ALIAS="10.0.2.2"
export MOCK_PORT="${MOCK_PORT:-4010}"
export EMULATOR_API_BASE_URL="http://${EMULATOR_HOST_ALIAS}:${MOCK_PORT}"

# 지원 범위의 아래 끝. 위 끝은 omf-pda-api37 이다.
export AVD_NAME="${AVD_NAME:-omf-pda-api33}"

export APP_ID="com.crefle.omfmes.mobile"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "없음: $1 — apps/mobile/README.md 「한 번만 준비하는 것」을 먼저 실행하세요." >&2
    exit 1
  fi
}
