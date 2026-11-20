import { createIdempotencyKey } from '@omf-mes/api-client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { plantToday } from '../../patterns/plant-time';
import { popWorkCountKeys } from '../../patterns/pop-work-counts';
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

/** 지금 화면에 연 지시서의 확인 값 캐시 키 — 머리줄 [새로고침](`invalidateQueries`)이 이 값을 다시 읽게 한다. */
export const openedShipmentRequestKey = (code: string) =>
  ['pop-shipment-complete', 'opened', code] as const;

/**
 * 연 지시서를 머리줄 [새로고침] 때 같은 코드로 다시 읽는다(사용자 지시 2026-11-20).
 *
 * ⭐ 여는 것은 여전히 `useLookupShipmentRequest`(스캔할 때마다 다시 읽는다)다. 연 값은 그 응답을 이 키에 넣어 두고
 *    (`setQueryData`), 저절로 다시 받지 않는다(`staleTime: Infinity`) — [새로고침]이 무효로 만들 때만 다시 읽는다.
 */
export const useOpenedShipmentRequest = (code: string | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: openedShipmentRequestKey(code ?? ''),
    enabled: code !== null,
    staleTime: Infinity,
    retry: false,
    queryFn: (): Promise<Completion> =>
      runRequest(() =>
        client.GET('/logistics/shipment-requests:lookup', {
          params: { query: { code: code ?? '' } },
        }),
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
  const queryClient = useQueryClient();
  const { client } = useApiClient();
  /*
   * ⭐ 한 시도의 키와 «본문»을 함께 둔다(실화면 검증 2026-11-20). 같은 키로 다시 보낼 때 시각이 바뀌면 서버가
   *    「같은 요청 키로 다른 내용」(409 DUPLICATE_KEY)으로 거절해, 응답을 못 받은 뒤 다시 누르기가 성립하지 않는다.
   */
  const attempt = useRef<{
    target: string;
    key: string;
    businessDate: string;
    occurredAt: string;
  } | null>(null);

  const attemptFor = (completion: Completion) => {
    const target = `${String(completion.shipmentRequestId)}:${String(completion.versionNo)}`;
    if (attempt.current === null || attempt.current.target !== target) {
      const now = new Date();
      attempt.current = {
        target,
        key: createIdempotencyKey(),
        businessDate: plantToday(now),
        occurredAt: now.toISOString(),
      };
    }
    return attempt.current;
  };

  const mutation = useMutation({
    mutationFn: ({ completion, workerNo }: CompleteInput): Promise<CompletionResult> => {
      const sent = attemptFor(completion);

      return runRequest(() =>
        client.POST('/logistics/shipment-requests/{shipmentRequestId}:complete', {
          params: {
            path: { shipmentRequestId: completion.shipmentRequestId },
            header: {
              'Idempotency-Key': sent.key,
              'If-Match': `"${String(completion.versionNo)}"`,
              'X-Worker-No': workerNo,
            },
          },
          body: { businessDate: sent.businessDate, occurredAt: sent.occurredAt },
        }),
      );
    },
    /* 완료하면 탭 배지·남은 작업 수가 줄어야 한다 — 다음 주기(60초)를 기다리지 않고 다시 읽는다(둘러보기 W-4). */
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: popWorkCountKeys.all });
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
