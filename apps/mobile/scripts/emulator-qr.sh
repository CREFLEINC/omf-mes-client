#!/usr/bin/env bash
# 에뮬레이터 카메라가 실제로 읽을 QR 을 가상 장면 벽에 건다.
#
# 사용법: apps/mobile/scripts/emulator-qr.sh "<QR 에 담을 값>"
#
# 기기등록(M-CO-01)만 카메라로 QR 을 읽는다 - 나머지 화면은 키보드 스캐너다.
# 그 경로는 MLKit 이 카메라 프레임에서 코드를 찾는 것이라, 값을 코드로 밀어 넣으면
# 실제로 도는 부분을 건너뛴다. 카메라 앞에 진짜 QR 을 두어야 같은 것을 잰다.
#
# 에뮬레이터의 가상 장면에는 벽에 붙은 그림(poster) 자리가 있고, 그 이미지를 바꿔 끼울 수
# 있다. 앱이 카메라를 열고 그 벽을 보면 MLKit 이 읽는다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./emulator-env.sh
source "$HERE/emulator-env.sh"

# 기기 등록 관문을 넘으려면 단말 토큰이 담긴 QR 이 필요하다. 그것을 여기서 만든다 -
# 없으면 등록 화면에서 멈춰 나머지 화면을 하나도 볼 수 없다.
if [ "${1:-}" = "--terminal" ]; then
  TERMINAL_CODE="${2:-PDA-EMU-01}"
  PLANT_ID="${3:-1}"
  VALUE="$(node -e '
    const claims = { terminalCode: process.argv[1], plantId: Number(process.argv[2]) };
    const b64 = (value) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    // 서명은 검증하지 않는다 - 화면은 어느 단말인지 보이려고 읽을 뿐이고 판정은 서버가 한다.
    process.stdout.write(`${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.dev`);
  ' "$TERMINAL_CODE" "$PLANT_ID")"
  echo "단말 토큰을 만들었습니다 — $TERMINAL_CODE · 공장 $PLANT_ID"
else
  VALUE="${1:-}"
fi

if [ -z "$VALUE" ]; then
  echo "QR 에 담을 값을 주세요." >&2
  echo "  $0 --terminal [단말코드] [공장]   기기 등록 QR" >&2
  echo "  $0 '임의의 값'                    그 밖의 QR" >&2
  exit 1
fi

SCENE_DIR="$HOME/.android/avd/${AVD_NAME}.avd"
OUT="$SCENE_DIR/omf-qr.png"

if ! command -v qrencode >/dev/null 2>&1; then
  echo "없음: qrencode — 'brew install qrencode' 로 설치하세요." >&2
  exit 1
fi

mkdir -p "$SCENE_DIR"
# 여백을 넉넉히 둔다. 카메라가 비스듬히 보면 가장자리가 잘려 인식이 흔들린다.
qrencode -o "$OUT" -s 12 -m 4 "$VALUE"

echo "QR 을 만들었습니다 — $VALUE"
echo "  이미지: $OUT"
echo
echo "에뮬레이터를 다시 띄워야 벽에 걸립니다 (emulator-run.sh 가 이 파일을 찾아 씁니다):"
echo "  adb emu kill && apps/mobile/scripts/emulator-run.sh"
echo
echo "앱에서 카메라를 열고 가상 장면의 벽을 향하면(방향키·마우스로 시점을 돌립니다) 읽힙니다."
