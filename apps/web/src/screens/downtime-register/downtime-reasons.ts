/**
 * 비가동 사유 — **자리표시 상수다.** 값 목록이 아직 확정되지 않았고(추적 omf-mes#145),
 * 공통코드가 서면 그쪽에서 받는다. 그때 이 파일만 지운다.
 *
 * ⛔ **이 값들을 판정에 쓰지 않는다.** 화면이 고르게 하는 선택지일 뿐이고, 어느 사유가
 * 어떤 뜻인지는 서버·집계 화면이 정한다. 화면이 「이 사유면 이렇게 한다」를 만들면 승인된 적
 * 없는 규칙이 굳는다.
 *
 * ## 왜 2단인데 보내는 것은 하나인가
 *
 * 화면은 대·소분류 2단으로 그린다. 그런데 계약의 쓰기 본문은 **`reasonCode` 한 칸**이다 —
 * 대분류는 소분류를 좁히는 **화면의 장치**이고 서버로 가지 않는다. 목록이 확정되면서 2단이
 * 실제 축이 되면 그때 계약이 함께 바뀐다.
 *
 * ⛔ **대분류 코드를 본문에 실어 보내지 않는다.** 계약에 그 칸이 없어 서버가 읽지 않고,
 * 읽지 않는 값을 보내면 나중에 「보냈으니 저장됐겠지」로 읽힌다.
 */

/** 사유 소분류 하나 — 보내는 것은 이 `code`다. */
export interface DowntimeReason {
  code: string;
  name: string;
}

/** 사유 대분류 하나 — 소분류를 좁히는 화면의 장치다. */
export interface DowntimeReasonCategory {
  code: string;
  name: string;
  reasons: readonly DowntimeReason[];
}

/**
 * 임시 목록. **화면은 이 목록을 「임시」라고 밝히고 쓴다** — 밝히지 않으면 확정된 체계로
 * 읽히고, 나중에 값이 갈릴 때 이미 쌓인 기록의 뜻이 흔들린다.
 */
export const PLACEHOLDER_REASON_CATEGORIES: readonly DowntimeReasonCategory[] = [
  {
    code: 'EQUIPMENT',
    name: '설비',
    reasons: [
      { code: 'BREAKDOWN', name: '고장' },
      { code: 'MOLD_CHANGE', name: '금형 교체' },
      { code: 'ADJUSTMENT', name: '설비 조정' },
    ],
  },
  {
    code: 'MATERIAL',
    name: '자재',
    reasons: [
      { code: 'MATERIAL_WAIT', name: '자재 대기' },
      { code: 'MATERIAL_DEFECT', name: '자재 불량' },
    ],
  },
  {
    code: 'QUALITY',
    name: '품질',
    reasons: [
      { code: 'INSPECTION', name: '검사 대기' },
      { code: 'REWORK', name: '재작업' },
    ],
  },
  {
    code: 'PLAN',
    name: '계획',
    reasons: [
      { code: 'NO_ORDER', name: '작업 없음' },
      { code: 'SHIFT_BREAK', name: '휴게' },
    ],
  },
];

/** 대분류 코드로 그 소분류들을 찾는다. 모르는 대분류면 빈 목록이다. */
export const reasonsOfCategory = (categoryCode: string | null): readonly DowntimeReason[] =>
  PLACEHOLDER_REASON_CATEGORIES.find((category) => category.code === categoryCode)?.reasons ?? [];

/**
 * 사유 코드의 이름. 임시 목록에 없으면 `null`이다 — **코드를 이름인 척 보이지 않는다**.
 * 서버가 준 `reasonName`이 있으면 그쪽이 먼저다(이 함수는 그것이 없을 때만 쓰인다).
 */
export const reasonName = (code: string): string | null => {
  for (const category of PLACEHOLDER_REASON_CATEGORIES) {
    const found = category.reasons.find((reason) => reason.code === code);
    if (found !== undefined) return found.name;
  }

  return null;
};
