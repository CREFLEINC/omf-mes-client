import type { components } from '@omf-mes/api-client';

/**
 * 서버가 돌려준 투입 기록을 화면의 말로 옮긴다.
 *
 * ⚠ **보내는 일은 여기에 없다.** 투입 쓰기는 outbox가 소유한다(`outbox.ts`) — 공유계약 C-1이
 * 「로컬 저장 후 즉시 성공 피드백」과 「재전송은 같은 키로」를 함께 요구하므로, 멱등 키가 큐
 * 항목에 붙어 있어야 하고 보내는 자리도 그 큐 안이어야 한다. 이 파일에 뮤테이션을 두면 키가
 * 시도마다 새로 생겨 **재전송이 새 전표가 된다.**
 */

type MaterialConsumption = components['schemas']['MaterialConsumption'];

/**
 * 서버가 「기록만 하고 막지 않은 것」 — 스펙 §5-3.
 *
 * 오투입 판정은 세 축으로 갈리고 **막는 것은 BOM 불일치 하나뿐**이다. 나머지 둘은 통과하되
 * 기록되며, **화면이 그 구분을 보여야 한다** — 나중에 계보를 추적할 때 필요하다.
 *
 * ⛔ **화면이 판정하지 않는다.** 서버가 돌려준 값의 유무를 읽을 뿐이다.
 *
 * ⛔ **「교차 투입」 축은 여기에 없다.** 한때 `actualUseProcessId` 의 유무로 세웠는데, 계약이
 *    그 필드를 「**서버가 이 W/O 의 공정으로 채운다**」고 정해 두어(요청 쪽 설명) 정상 투입에도
 *    늘 채워져 돌아온다 — 유무로 보면 **모든 줄에 붙어 구분이 0** 이 된다. 실측도 같았다
 *    (WIP-CHAIN-01 D8, 2026-09-15: 사출·조립 전 건에 표시됨). 값의 유무가 판정의 근거가
 *    되지 못하므로 축을 세우지 않는다.
 *
 * ⭐ 되살리려면 **서버가 판정 결과를 내려 줄 때**다(`isCrossProcess` 같은 값). 화면이
 *    「자재의 지정 공정 ≠ 실제 투입 공정」을 스스로 비교하려면 BOM 조회가 필요한데, 그것은
 *    위의 ⛔(화면이 판정하지 않는다)와 어긋난다.
 */
export interface RecordedNote {
  lotId: number;
  /** 출고에 귀속되지 않았다 — `shopfloorReceiptLineId`가 비어 있다. 계약이 조건부 채움으로 명시한 필드다. */
  unlinkedIssue: boolean;
}

export const toRecordedNote = (recorded: MaterialConsumption): RecordedNote => ({
  lotId: recorded.lotId,
  unlinkedIssue: recorded.shopfloorReceiptLineId === undefined,
});
