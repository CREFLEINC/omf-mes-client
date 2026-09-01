import type { ApiClient, components } from '@omf-mes/api-client';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 투입 기록 — **스캔 한 건이 곧 한 호출이다**(스펙 §5-8 · 공유계약 C-3 「건별 저장 + 마지막
 * 일괄 완료」).
 *
 * ⭐ **이 순서가 이 화면의 가장 조용한 위험을 닫는다.** 오투입(BOM 불일치) 판정은 서버가
 * 하는데, 담아 두었다가 확정에서 한꺼번에 보내면 **그 판정을 확정 버튼을 누른 뒤에야** 받는다.
 * 그때는 앞 자재가 이미 기록돼 있고 투입은 정정이 아니라 새 기록으로만 고칠 수 있어(이력 불변
 * B-3 · 계약에 정정 경로 부재 §8 미결 9) 되돌릴 수 없다. 건별로 보내면 **NG가 스캔 자리에서
 * 나고 그 자재는 아예 기록되지 않는다** — §6의 「BOM에 없음 → 자재LOT 스캔부터 루프백」이
 * 성립하는 자리가 여기다.
 *
 * ⛔ **「투입 확정」은 이 훅을 부르지 않는다.** 그 버튼은 그날 목록을 닫는 완료 동작이지
 * 저장을 모아 보내는 버튼이 아니다(§5-8). 계약에 그에 대응하는 오퍼레이션이 없는 것도 같은
 * 이유다 — 서버가 할 일이 없다.
 *
 * ## 헤더 둘
 *
 * | 헤더 | 왜 |
 * | --- | --- |
 * | `Idempotency-Key` | **필수.** 오프라인 대상 오퍼레이션이라 재전송돼도 전표가 둘이 되지 않아야 한다 |
 * | `X-Worker-No` | **필수.** 이 쓰기를 「누가 한 일」로 기록할 근거 — 서버가 이 사번으로 작업자를 푼다(D-5) |
 * | `If-Match` | **싣지 않는다.** 계약이 선택으로 두었고, 큐에 쌓인 요청은 잠금 토큰을 싣지 않는다(C-9) |
 *
 * **자재 한 건에 키 하나**를 만들어 그 시도에 붙인다(`docs/decisions.md` #10).
 */

type Client = ApiClient['client'];
type MaterialConsumptionCreate = components['schemas']['MaterialConsumptionCreate'];
type MaterialConsumption = components['schemas']['MaterialConsumption'];

const postConsumption = async (
  client: Client,
  workerNo: string,
  body: MaterialConsumptionCreate,
): Promise<MaterialConsumption> =>
  runRequest(() =>
    client.POST('/production/material-consumptions', {
      params: {
        header: {
          /* 시도마다 새로 만든다 — 보낼 값이 다르면 다른 쓰기다(#10 ⓐ). */
          'Idempotency-Key': crypto.randomUUID(),
          'X-Worker-No': workerNo,
        },
      },
      body,
    }),
  );

export interface RecordVariables {
  workerNo: string;
  body: MaterialConsumptionCreate;
}

export type RecordResult = UseMutationResult<MaterialConsumption, Error, RecordVariables>;

/**
 * 자재 한 건을 기록한다. **되돌릴 수 없다.**
 *
 * 실패는 그 한 건에만 미친다 — 앞서 기록된 것은 남고, 이 건은 남지 않는다. 부분 기록이라는
 * 모호한 상태가 생기지 않는 것이 건별 저장의 값이다.
 */
export const useRecordConsumption = (): RecordResult => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: ({ workerNo, body }: RecordVariables) => postConsumption(client, workerNo, body),
  });
};

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
