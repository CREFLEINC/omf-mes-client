import type { ApiClient, components } from '@omf-mes/api-client';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 투입 확정 — **이 화면의 유일한 쓰기이자 되돌릴 수 없는 기록**이다.
 *
 * 이력 불변(B-3)이라 투입은 정정이 아니라 새 기록으로만 고칠 수 있고, 계약에는 그 정정 경로
 * 조차 아직 없다(스펙 §8 미결 9). 그래서 보내는 자리를 한 곳에 모으고 무엇이 실리는지가
 * 한눈에 읽히게 한다.
 *
 * ## 헤더 셋
 *
 * | 헤더 | 왜 |
 * | --- | --- |
 * | `Idempotency-Key` | **필수.** 오프라인 대상 오퍼레이션이라 재전송돼도 전표가 둘이 되지 않아야 한다 |
 * | `X-Worker-No` | **필수.** 이 쓰기를 「누가 한 일」로 기록할 근거 — 서버가 이 사번으로 작업자를 푼다(D-5) |
 * | `If-Match` | **싣지 않는다.** 계약이 선택으로 두었고, 큐에 쌓인 요청은 잠금 토큰을 싣지 않는다(C-9) |
 *
 * ## 멱등 키의 수명 — `docs/decisions.md` #10
 *
 * **자재 한 건에 키 하나**를 만들어 그 시도에 붙인다. 여러 자재를 담았으면 자재마다 별개의
 * 쓰기이므로 키도 별개다 — 하나의 키로 묶으면 서버가 두 번째 자재를 재전송으로 읽는다.
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

/**
 * 중간에 실패했을 때 **몇 건이 들어갔는지**를 실어 나른다.
 *
 * 실패하면 결과가 사라지므로 그 수를 오류에 붙이지 않으면 화면이 알 길이 없다 — 서버에
 * 일괄 취소가 없고 정정 경로도 없어(스펙 §8 미결 9), 작업자가 무엇을 다시 해야 하는지는
 * 그 수가 정한다.
 */
export class PartialConfirmError extends Error {
  readonly recordedCount: number;

  constructor(recordedCount: number, options?: ErrorOptions) {
    super(`투입 확정이 ${String(recordedCount)}건까지 기록된 뒤 실패했습니다`, options);
    this.name = 'PartialConfirmError';
    this.recordedCount = recordedCount;
  }
}

export interface ConfirmVariables {
  workerNo: string;
  bodies: MaterialConsumptionCreate[];
}

export type ConfirmResult = UseMutationResult<MaterialConsumption[], Error, ConfirmVariables>;

/**
 * 담은 자재를 차례로 보낸다.
 *
 * ⛔ **동시에 보내지 않는다.** 계약이 자재 한 건씩 받고, 계보가 이 순서로 쌓인다. 병렬로
 * 보내면 하나가 실패했을 때 **어디까지 들어갔는지**를 화면이 알 수 없다 — 되돌릴 수 없는
 * 기록이라 그 모호함이 그대로 남는다.
 *
 * ⚠ **중간에 실패하면 앞서 들어간 것은 그대로 남는다.** 서버에 일괄 취소가 없고 정정 경로도
 * 없다(§8 미결 9). 그래서 실패를 알릴 때 **몇 건이 들어갔는지**를 함께 말한다 — 작업자가
 * 무엇을 다시 해야 하는지는 그 수가 정한다.
 */
export const useConfirmInput = (): ConfirmResult => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: async ({ workerNo, bodies }: ConfirmVariables) => {
      const recorded: MaterialConsumption[] = [];

      for (const body of bodies) {
        try {
          recorded.push(await postConsumption(client, workerNo, body));
        } catch (cause) {
          /* 첫 건부터 실패했으면 원래 오류를 그대로 올린다 — 부분 기록이 없다. */
          if (recorded.length === 0) throw cause;

          throw new PartialConfirmError(recorded.length, { cause });
        }
      }

      return recorded;
    },
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
