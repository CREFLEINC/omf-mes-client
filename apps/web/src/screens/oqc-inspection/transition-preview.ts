import { toJudgmentDirection, type JudgmentDirection } from './judgment-direction';
import { formatMicro, readMicro, toTotals, type QuantityDraft } from './quantity-draft';

/**
 * 전이 경고에 실을 값 — **`null` 이면 경고를 그리지 않는다.**
 *
 * ⭐ **셀 수 없으면 그리지 않는다.** 경고의 첫 규칙이 「대상 규모를 숫자로 말한다」인데, 한 칸이
 * 수량이 아닌 동안 세 칸을 0으로 읽고 세면 **화면이 거짓 숫자를 근거로 되돌릴 수 없는 쓰기를
 * 권하게 된다.** 그때는 경고 자체를 세우지 않는 편이 정직하다 — 무엇을 고쳐야 하는지는 그 칸의
 * 오류가 이미 말하고 있다.
 *
 * ⚠ **합계가 어긋나도 그린다.** 어긋남은 저장을 막는 사유이지 「무엇이 일어나는가」를 못 말할
 * 이유가 아니다. 막는 것은 저장 버튼이고 이 경고는 미리 보이는 것이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export interface TransitionPreview {
  /** 지금 친 값을 그대로 되읽은 것. 마이크로 단위를 거쳐 표기를 화면 전체와 맞춘다 */
  accepted: string;
  rejected: string;
  held: string;
  /** 아는 판정일 때만 방향 문장을 덧붙인다 */
  direction: JudgmentDirection;
}

/** 빈 칸은 0으로 읽는다 — 여기 도달했으면 세 칸이 모두 수량이거나 비어 있다. */
const fieldText = (raw: string): string => formatMicro(readMicro(raw));

export const toTransitionPreview = (
  draft: QuantityDraft,
  overallJudgmentCode: string,
  inspectedQty: number,
): TransitionPreview | null => {
  /* 합계 판정을 다시 짜지 않고 그대로 쓴다 — 두 자리가 다른 자를 쓰면 언젠가 갈린다. */
  if (toTotals(draft, inspectedQty).kind === 'uncountable') return null;

  return {
    accepted: fieldText(draft.accepted),
    rejected: fieldText(draft.rejected),
    held: fieldText(draft.held),
    direction: toJudgmentDirection(overallJudgmentCode),
  };
};
