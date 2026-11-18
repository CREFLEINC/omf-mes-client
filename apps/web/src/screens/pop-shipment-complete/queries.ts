import { createIdempotencyKey } from '@omf-mes/api-client';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { plantToday } from '../../patterns/plant-time';
import { runRequest } from '../../patterns/request';
import {
  searchQueryOf,
  type Completion,
  type CompletionResult,
  type SearchCriteria,
} from './model';

/**
 * P-04-07 출하 완료의 서버 호출 — 지시서 코드 해석(`:lookup`), 출하 완료(`:complete`), 찾기 목록.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 지시서 코드(`SHPREQ:{no}`) → 확인 값. 스캔·찾기·[다시 확인]이 모두 이 길 하나로 연다 — 세 입구가 같은
 * 확인 화면을 보는 근거다(R-9).
 *
 * ⭐ 조회지만 `useMutation` 이다. 같은 코드를 다시 스캔하면 «다시» 읽어야 한다(다른 단말에서 검사·피킹이
 * 끝났을 수 있다) — 캐시 키가 같다고 지난 값을 보이면 안 된다.
 */
export const useLookupShipmentRequest = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: (code: string): Promise<Completion> =>
      runRequest(() =>
        client.GET('/logistics/shipment-requests:lookup', { params: { query: { code } } }),
      ),
  });
};

export interface CompleteInput {
  completion: Completion;
  workerNo: string;
}

/**
 * [출하 완료] — 한 번 누르면 끝난다(확인 창 없음 — 확인 화면이 곧 확인 창이다).
 *
 * ⭐ **멱등 키는 한 시도에 하나**(`docs/decisions.md` 결정 10). 응답을 못 받아 다시 누르면 같은 키로 보내
 *    두 번 출하되지 않게 한다. 서버가 판정을 끝낸 실패(막힘·바뀜·이미 완료)나 성공 뒤에는 `resetKey` 로
 *    버리고, 다음 시도는 새 키를 쓴다.
 * ⭐ 영업일은 단말이 보낸다(공유계약 C-8) — 누른 순간의 공장 날짜다. 시각도 누른 순간이다.
 * ⭐ `If-Match` 는 확인 값의 `versionNo` 다 — 확인한 뒤 피킹이 바뀌었으면 서버가 409 로 돌려보낸다.
 */
export const useCompleteShipment = () => {
  const { client } = useApiClient();
  const attempt = useRef<{ target: string; key: string } | null>(null);

  const keyFor = (completion: Completion): string => {
    const target = `${String(completion.shipmentRequestId)}:${String(completion.versionNo)}`;
    if (attempt.current === null || attempt.current.target !== target) {
      attempt.current = { target, key: createIdempotencyKey() };
    }
    return attempt.current.key;
  };

  const mutation = useMutation({
    mutationFn: ({ completion, workerNo }: CompleteInput): Promise<CompletionResult> => {
      const now = new Date();

      return runRequest(() =>
        client.POST('/logistics/shipment-requests/{shipmentRequestId}:complete', {
          params: {
            path: { shipmentRequestId: completion.shipmentRequestId },
            header: {
              'Idempotency-Key': keyFor(completion),
              'If-Match': `"${String(completion.versionNo)}"`,
              'X-Worker-No': workerNo,
            },
          },
          body: { businessDate: plantToday(now), occurredAt: now.toISOString() },
        }),
      );
    },
  });

  return {
    ...mutation,
    resetKey: (): void => {
      attempt.current = null;
    },
  };
};

/** 찾기 목록. 쪽을 넘기는 동안 앞 쪽을 남겨 목록이 깜빡이지 않게 한다. */
export const useShipmentRequestSearch = (criteria: SearchCriteria, enabled: boolean) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-shipment-complete', 'search', criteria],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/shipment-requests', {
          params: { query: searchQueryOf(criteria, plantToday()) },
        }),
      ),
  });
};
