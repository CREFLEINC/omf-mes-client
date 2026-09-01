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
 */
export interface RecordedNote {
  lotId: number;
  /** 출고에 귀속되지 않았다 — `shopfloorReceiptLineId`가 비어 있다. */
  unlinkedIssue: boolean;
  /** 다른 공정용 자재를 썼다 — `actualUseProcessId`가 채워져 있다. */
  crossProcess: boolean;
}

export const toRecordedNote = (recorded: MaterialConsumption): RecordedNote => ({
  lotId: recorded.lotId,
  unlinkedIssue: recorded.shopfloorReceiptLineId === undefined,
  crossProcess: recorded.actualUseProcessId !== undefined,
});
