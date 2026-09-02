import { messages } from '@omf-mes/i18n';

import { canConfirm, type QuantityTotals } from './quantity-draft';

/**
 * 「검사 확정」이 막혔는가, 막혔다면 **무엇이** 막혔는가.
 *
 * ⭐ **순수 함수로 뺀 이유가 있다.** 이 판정은 화면의 유일한 되돌릴 수 없는 쓰기를 지키는
 * 자리인데, 조립부 안에 두면 **막는 조건 하나를 지워도 아무 감지기도 울지 않는다** — 실제로
 * 그런 상태였고 뮤테이션으로 드러났다(단말 권한 갈래를 통째로 지워도 285개 시험이 전부
 * 통과했다). 조건마다 값을 넣어 부를 수 있어야 그 갈래가 실제로 지켜지는지 잴 수 있다.
 *
 * ⛔ **갈래를 뭉개지 않는다.** 「확정할 수 없습니다」 한 문장으로 합치면 푸는 방법이 사라진다 —
 * 권한은 단말 설정을, 합계는 수량을, 판정은 선택을, 항목은 남은 줄을 고쳐야 한다(G-3·G-23).
 *
 * ⚠ **「먼저 임시 저장」 갈래가 없다.** 확정은 회차를 지목하는 쓰기가 아니라 **저장과 같은
 * 경로**이므로(요구서 §3-7), 저장하지 않아도 확정할 수 있다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.pqcInspection.result;

export interface ConfirmGateInput {
  /**
   * 이 단말이 이 공정의 검사를 입력할 수 있는가(`can_input_inspection` · F-1).
   *
   * ⛔ **모를 때는 참으로 넘긴다** — 막으면 권한 있는 사람이 이유 없이 갇힌다. 정본은
   * 서버이고 화면의 막음은 헛수고를 줄이는 편의다.
   */
  canInputInspection: boolean;
  totals: QuantityTotals;
  /** 고른 종합 판정. 빈 문자열이면 아직 고르지 않았다 */
  judgment: string;
  /** 검사 항목이 전부 판정됐는가(스펙 §5-9 「전 항목 판정」) */
  isAllJudged: boolean;
}

/**
 * 막힌 사유 하나. 풀렸으면 `null`.
 *
 * ⭐ **차례가 규정이다.** 단말 권한이 가장 앞이다 — 뒤에 두면 수량·판정·항목을 다 채운
 * 사람이 마지막에야 「이 단말은 할 수 없다」를 만난다. 할 수 없는 일을 다 시킨 뒤 막는 셈이다.
 */
export const toConfirmBlockedReason = (input: ConfirmGateInput): string | null => {
  if (!input.canInputInspection) return t.confirmBlockedByTerminal;
  if (!canConfirm(input.totals)) return t.confirmBlockedByTotals;
  if (input.judgment === '') return t.confirmBlockedByJudgment;
  if (!input.isAllJudged) return t.confirmBlockedByItems;

  return null;
};
