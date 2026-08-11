import { messages } from '@omf-mes/i18n';

import type { CountSummaryView } from './types';

/**
 * 마감 가능 판정 — **이 화면에서 되돌릴 수 없는 쓰기를 여는 유일한 자리다.**
 *
 * 마감한 실사를 다시 여는 오퍼레이션이 계약에 없다(실측 — 이 자원의 경로는 넷뿐이며 어느
 * 것도 마감을 물리지 않는다). 그래서 이 판정은 **열지 말아야 할 때 열리는 쪽**이 훨씬 비싸고,
 * 판정을 여러 자리에서 다시 만들면 한쪽만 고쳐져 그 비대칭이 생긴다(계획 §5.2 「읽는 자리
 * 파생」 · 감지기 M50과 같은 성질).
 *
 * **잣대는 요약의 두 건수뿐이다**(계획 결정 12 · 승인 13-6). 계약 설명은 「미실사가 0이고
 * 차이가 없거나 **모두 조정된** 뒤」라고 적었는데, **화면은 「모두 조정된」을 알 수 없다** —
 * 조정은 별도 자원(`/inventory/adjustments`)이고 이 화면에 그 결과를 읽을 통로가 없다.
 * 지어내지 않는 유일한 잣대가 `uncountedCount === 0 && varianceCount === 0`이다.
 *
 * **남은 위험**(승인 13-6이 명기를 요구한 자리): 조정을 끝낸 뒤에도 서버가 `varianceCount`를
 * 0으로 내려주지 않으면 **마감이 영영 막힌다.** 착수 이슈 §4가 「우회 경로를 두지 않는다」로
 * 못 박았으므로 막는 쪽으로 진행하고, 그 사실은 어긋남 7로 질문 대기 중이다.
 *
 * **차례가 뜻을 정한다** — 이미 마감했다 → 요약을 못 읽었다 → 미실사가 남았다 → 차이가 남았다.
 * 앞선 사유가 참인 동안 뒤의 사유를 내면 사용자가 **할 수 없는 조치**를 가리킨다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stocktaking;

export interface CloseGateInput {
  /** 상세 응답이 함께 내려준 진행 요약. **화면이 세지 않는다**(착수 이슈 §6 ⭐). */
  summary: CountSummaryView;
  /**
   * **이번 세션에서 이 실사를 마감했는가**(수명 표 「마감 플래그」).
   *
   * 세션 밖에서 마감된 실사는 화면이 알 수 없다(계획 결정 2 — 상태 코드로 분기하지 않는다).
   * 그 갈래는 서버가 400 `STATE_LOCKED`로 되돌리고 저장 실패 배너가 사유와 함께 낸다.
   * 여기서 막는 것은 **이 화면이 스스로 아는 것** 하나뿐이다.
   */
  hasClosedInSession: boolean;
}

/**
 * 건수를 **수로 읽을 수 있는가.**
 *
 * 계약은 요약 4칸을 전부 `required`로 두지만, 같은 계약이 필수라고 말한 라인의 `systemQty`가
 * 실제로는 빠져 올 수 있다는 것을 이미 확인했다(계획 결정 4 · 어긋남 1). 요약에 같은 일이
 * 나면 `undefined > 0`이 **조용히 거짓**이 되어 마감이 열린다 — 되돌릴 수 없는 쓰기가
 * 근거 없이 나가는 길이라, 타입을 믿지 않고 여기서 한 번 본다.
 *
 * `??`를 쓰지 않는 이유는 0 때문이다 — 0은 「다 셌다」는 정상 값이고 대체값으로 메우면
 * **빠져 온 것과 구별되지 않는다.**
 */
const readCount = (value: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * 마감이 왜 막혔는가. 마감할 수 있으면 `null`이다.
 *
 * **버튼과 보내는 자리가 둘 다 이것을 부른다**(계획 결정 3의 구현 규칙 4). 마감에는 확인
 * 창이 있어(계획 결정 15) 버튼을 누른 시점과 요청이 나가는 시점 **사이가 벌어진다** —
 * 그 사이에 상세를 다시 읽어 요약이 바뀌거나 주소로 대상이 바뀔 수 있다.
 */
export const closeBlockReason = (input: CloseGateInput): string | null => {
  if (input.hasClosedInSession) return t.actionReasons.closeAlreadyClosed;

  const uncounted = readCount(input.summary.uncountedCount);
  const variance = readCount(input.summary.varianceCount);

  if (uncounted === null || variance === null) return t.actionReasons.closeSummaryUnavailable;

  /* 미실사가 먼저다 — 세지 않은 줄이 남은 채로 「차이를 조정하라」고 가리킬 수 없다. */
  if (uncounted > 0) return t.actionReasons.closeUncounted(uncounted);
  if (variance > 0) return t.actionReasons.closeVariance(variance);

  return null;
};
