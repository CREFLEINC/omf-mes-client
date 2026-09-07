#!/usr/bin/env bash
# 에뮬레이터를 띄우고 지금 코드를 설치해 실행한다.
#
# 사용법: apps/mobile/scripts/emulator-run.sh [AVD 이름]
#
# 목 서버는 이 스크립트가 띄우지 않는다 - 별도 창에서 `pnpm mock` 을 먼저 돌려 둔다.
# 한 스크립트가 서버까지 들고 있으면 앱을 다시 설치할 때마다 씨앗이 초기화된다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./emulator-env.sh
source "$HERE/emulator-env.sh"

AVD_NAME="${1:-$AVD_NAME}"
MOBILE="$(cd "$HERE/.." && pwd)"

require emulator
require adb

if ! emulator -list-avds | grep -qx "$AVD_NAME"; then
  echo "AVD 없음: $AVD_NAME — README 「에뮬레이터에 설치·실행」의 avdmanager 명령을 먼저 실행하세요." >&2
  exit 1
fi

booted() {
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]
}

if booted; then
  echo "[1/5] 이미 떠 있는 에뮬레이터를 쓴다"
else
  echo "[1/5] 에뮬레이터 부팅 — $AVD_NAME"

  # 방금 죽인 에뮬레이터가 adb 목록에 잠시 남는다. 그것을 「떠 있다」로 읽으면 설치가
  # 허공으로 간다. 목록이 아니라 부팅 완료 신호로 판정하고, 사라질 때까지 기다린다.
  for _ in $(seq 1 15); do
    adb devices | grep -q '^emulator-' || break
    sleep 1
  done

  # 카메라 QR 을 넣으려면 가상 장면이어야 한다. emulator-qr.sh 가 구워 둔 그림이 있으면
  # 그것을 벽에 건다 - 기기 등록은 카메라로만 넘을 수 있는 관문이다.
  QR_PNG="$HOME/.android/avd/${AVD_NAME}.avd/omf-qr.png"
  POSTER=()
  if [ -f "$QR_PNG" ]; then
    POSTER=(-virtualscene-poster "wall=$QR_PNG")
    echo "      벽에 걸 QR: $QR_PNG"
  fi
  emulator -avd "$AVD_NAME" -camera-back virtualscene -no-snapshot-load "${POSTER[@]}" >/dev/null 2>&1 &
  adb wait-for-device
  until booted; do
    sleep 2
  done
fi

echo "[2/5] 웹 빌드 — API 기준 $EMULATOR_API_BASE_URL"
VITE_API_BASE_URL="$EMULATOR_API_BASE_URL" pnpm --filter @omf-mes/mobile build >/dev/null

echo "[3/5] 네이티브 동기화 — 개발 기기 평문 허용을 켠 채로"
(cd "$MOBILE" && CAP_ALLOW_LOCAL_HTTP=1 npx cap sync android >/dev/null)

echo "[4/5] 디버그 APK 빌드"
(cd "$MOBILE/android" && ./gradlew --quiet assembleDebug)

echo "[5/5] 설치·실행"
adb install -r "$MOBILE/android/app/build/outputs/apk/debug/app-debug.apk" >/dev/null

# 카메라는 기기 등록 관문이 쓴다. 물어보는 창을 사람이 눌러 주지 않으면 거기서 멈춘다.
adb shell pm grant "$APP_ID" android.permission.CAMERA >/dev/null 2>&1 || true

adb shell am start -n "$APP_ID/.MainActivity" >/dev/null

# 설치가 허공으로 가도 앞 단계들은 성공으로 보인다. 실제로 올라갔는지 확인한다.
if ! adb shell pm list packages 2>/dev/null | grep -q "$APP_ID"; then
  echo "설치되지 않았습니다 — 위 단계의 오류를 확인하세요." >&2
  exit 1
fi

echo
echo "떴습니다. 스캔은 apps/mobile/scripts/emulator-scan.sh 로 넣습니다."
echo "화면 안을 보려면: apps/mobile/scripts/emulator-inspect.sh"
echo "(목 서버가 없으면 조회가 전부 실패합니다 — 다른 창에서 'pnpm mock')"
