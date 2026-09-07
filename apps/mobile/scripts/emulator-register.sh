#!/usr/bin/env bash
# 기기 등록 관문을 넘겨 준다 - 나머지 화면을 보려면 이 관문을 넘어야 한다.
#
# 사용법: apps/mobile/scripts/emulator-register.sh [단말코드] [공장]
#
# ⚠ 이것은 지름길이다. 진짜 등록 경로는 카메라로 QR 을 읽는 것이고(emulator-qr.sh),
# 그 경로를 대신 재지 않는다. 이 스크립트는 등록 «뒤»의 화면들을 열기 위한 것이다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./emulator-env.sh
source "$HERE/emulator-env.sh"

require adb
require node

TERMINAL_CODE="${1:-PDA-EMU-01}"
# 목 서버의 씨앗 공장. 여기가 어긋나면 작업자 명부가 비어 사번 확인에서 막힌다.
PLANT_ID="${2:-1001}"

bash "$HERE/emulator-inspect.sh" >/dev/null

node "$HERE/emulator-register.mjs" "$TERMINAL_CODE" "$PLANT_ID" "$EMULATOR_API_BASE_URL"

adb shell am force-stop "$APP_ID"
adb shell am start -n "$APP_ID/.MainActivity" >/dev/null

echo "등록했습니다 — $TERMINAL_CODE · 공장 $PLANT_ID"
