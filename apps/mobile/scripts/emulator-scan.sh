#!/usr/bin/env bash
# 스캐너 일체형 PDA 가 스캔값을 흘려보내는 것과 같은 형태로 에뮬레이터에 입력을 넣는다.
#
# 사용법:
#   apps/mobile/scripts/emulator-scan.sh GI-2026-000402          종료 문자까지 (기본)
#   apps/mobile/scripts/emulator-scan.sh --no-enter CTN-2026-01  종료 문자 없는 단말
#   apps/mobile/scripts/emulator-scan.sh --slow ABC-1            사람이 손으로 친 속도
#
# 이 단말의 스캐너는 키보드 입력으로 들어온다. 앱은 그것을 일반 키보드와 구별하지 못해
# 「빠른 버스트」로 판정한다(patterns/scanner.ts — 평균 간격 60ms 이하 · 입력 3건 이상).
# adb 의 input text 는 문자를 한 묶음으로 밀어 넣어 그 기준 안에 든다.
#
# --slow 는 그 판정이 사람 손을 스캔으로 오인하지 않는지 보는 자리다. 통과하면 결함이다.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./emulator-env.sh
source "$HERE/emulator-env.sh"

require adb

ENTER=1
SLOW=0

while [ $# -gt 0 ]; do
  case "$1" in
    --no-enter) ENTER=0; shift ;;
    --slow) SLOW=1; shift ;;
    --) shift; break ;;
    -*) echo "모르는 선택지: $1" >&2; exit 1 ;;
    *) break ;;
  esac
done

CODE="${1:-}"

if [ -z "$CODE" ]; then
  echo "스캔값을 주세요. 예: $0 GI-2026-000402" >&2
  exit 1
fi

if ! adb devices | grep -q '^emulator-.*device$'; then
  echo "에뮬레이터가 없습니다 — apps/mobile/scripts/emulator-run.sh 를 먼저 실행하세요." >&2
  exit 1
fi

if [ "$SLOW" = "1" ]; then
  # 한 글자씩 따로 보낸다. adb 왕복이 문자마다 100ms 를 훌쩍 넘어 사람 손 속도가 된다.
  echo "느리게 넣는 중 (사람 손 흉내) — $CODE"
  for (( i=0; i<${#CODE}; i++ )); do
    adb shell input text "${CODE:$i:1}"
  done
else
  echo "스캔 넣는 중 — $CODE"
  # 한 묶음으로 민다. 문자 사이가 붙어 있어 앱이 버스트로 본다.
  adb shell input text "$CODE"
fi

if [ "$ENTER" = "1" ]; then
  adb shell input keyevent 66
fi

echo "넣었습니다."
