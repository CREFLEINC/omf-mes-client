#!/usr/bin/env bash
# 에뮬레이터 안에서 도는 화면을 개발자 도구로 연다.
#
# 화면이 무엇을 그렸는지·무엇을 요청했는지는 앱 화면만 봐서는 알 수 없다. 디버그 빌드는
# WebView 디버깅이 켜져 있어 붙을 수 있다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./emulator-env.sh
source "$HERE/emulator-env.sh"

require adb

SOCKET="$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)"

if [ -z "$SOCKET" ]; then
  echo "WebView 를 찾지 못했습니다 — 앱이 떠 있는지 확인하세요." >&2
  exit 1
fi

adb forward tcp:9444 "localabstract:$SOCKET" >/dev/null

echo "붙었습니다."
echo "  chrome://inspect  또는  http://127.0.0.1:9444/json/list"
