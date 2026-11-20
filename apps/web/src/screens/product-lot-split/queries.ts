import { createIdempotencyKey, type components } from '@omf-mes/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { plantToday } from '../../patterns/plant-time';
import { runRequest } from '../../patterns/request';

/**
 * P-04-08 생산 LOT 분리의 서버 호출(피처 013 · contracts §0~2).
 *
 * | 무엇 | 경로 |
 * | --- | --- |
 * | 스캔 조회 — LOT · 위치별 잔액 · 막힌 이유 | `GET /logistics/product-lot-splits:lookup` |
 * | 분리 — 자식 LOT · 재고 이동 · 발행 기록 2건 | `POST /logistics/product-lot-splits` |
 * | 확인 대기 목록 | `GET /logistics/product-lot-splits?status=UNCONFIRMED` |
 * | 다시 출력 — 두 LOT 의 생산 LOT 라벨 발행 | `POST /app/document-issues` |
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구한다.
 */

export type SplitLookup = components['schemas']['ProductLotSplitLookup'];
export type SplitLookupLocation = SplitLookup['locations'][number];
export type SplitBlock = components['schemas']['ProductLotSplitBlock'];
export type SplitResult = components['schemas']['ProductLotSplitResult'];
export type ProductLotSplit = components['schemas']['ProductLotSplit'];
type DocumentIssue = components['schemas']['DocumentIssue'];

export const productLotSplitKeys = {
  all: ['product-lot-split'] as const,
  queue: ['product-lot-split', 'queue'] as const,
  workOrder: (lotNo: string) => ['product-lot-split', 'work-order', lotNo] as const,
};

/** 확인 대기 목록 한 쪽 크기. 하루 수~수십 건이라 한 번에 받는다. */
export const QUEUE_PAGE_SIZE = 200;

/**
 * 스캔 조회. 같은 번호를 다시 스캔하면 «다시» 읽는다(그사이 피킹·적치가 바뀌었을 수 있다) — 그래서
 * 캐시를 쓰는 조회가 아니라 `useMutation` 이다(P-04-07 `:lookup` 과 같은 까닭).
 */
export const useSplitLookup = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: (lotNo: string): Promise<SplitLookup> =>
      runRequest(() =>
        client.GET('/logistics/product-lot-splits:lookup', { params: { query: { lotNo } } }),
      ),
  });
};

/** 확인 대기 목록 — 오래된 순(서버 정렬), 머리 수는 `unconfirmedCount`. */
export const useSplitQueue = (enabled: boolean) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productLotSplitKeys.queue,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/product-lot-splits', {
          params: { query: { status: 'UNCONFIRMED', page: 1, size: QUEUE_PAGE_SIZE } },
        }),
      ),
  });
};

/**
 * 다시 출력할 분리의 W/O — 라벨에 찍는다. 목록 항목에는 W/O 가 없어 원래 LOT 번호로 스캔 조회를 한 번 부른다
 * (자식 LOT 의 W/O 도 원래 LOT 의 것이다 · 라벨 D-6). 확인 대기인 LOT 이라 조회는 막힘과 함께 200 으로 온다.
 */
export const useSplitWorkOrder = (lotNo: string | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productLotSplitKeys.workOrder(lotNo ?? ''),
    enabled: lotNo !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/product-lot-splits:lookup', {
          params: { query: { lotNo: lotNo ?? '' } },
        }),
      );

      return data.lot.workOrderNo;
    },
  });
};

export interface SplitInput {
  lotId: number;
  locationId: number;
  qty: number;
  workerNo: string;
}

/**
 * [분리하고 라벨 2장 출력] — 한 번 누르면 서버가 한 트랜잭션에서 나누고 발행 기록 두 건을 만든다.
 *
 * ⭐ **멱등 키는 한 시도에 하나**(`docs/decisions.md` 결정 10). 응답을 못 받아 다시 누르면 같은 키로 보내 두 번
 *    나뉘지 않게 한다. 같은 LOT · 위치 · 수량이 아니면 새 키다. 서버가 판정을 끝낸 뒤에는 `resetKey` 로 버린다.
 * ⭐ 영업일은 단말이 보낸다(공유계약 C-8) — 누른 순간의 공장 날짜다(P-04-07 `:complete` 와 같은 꼴).
 */
export const useCreateSplit = () => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const attempt = useRef<{ target: string; key: string } | null>(null);

  const keyFor = (input: SplitInput): string => {
    const target = `${String(input.lotId)}:${String(input.locationId)}:${String(input.qty)}`;
    if (attempt.current === null || attempt.current.target !== target) {
      attempt.current = { target, key: createIdempotencyKey() };
    }
    return attempt.current.key;
  };

  const mutation = useMutation({
    mutationFn: (input: SplitInput): Promise<SplitResult> => {
      const now = new Date();

      return runRequest(() =>
        client.POST('/logistics/product-lot-splits', {
          params: {
            header: { 'Idempotency-Key': keyFor(input), 'X-Worker-No': input.workerNo },
          },
          body: {
            lotId: input.lotId,
            locationId: input.locationId,
            qty: input.qty,
            businessDate: plantToday(now),
            occurredAt: now.toISOString(),
          },
        }),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: productLotSplitKeys.queue });
    },
  });

  return {
    ...mutation,
    resetKey: (): void => {
      attempt.current = null;
    },
  };
};

export interface ReissueInput {
  split: ProductLotSplit;
  reasonCode: string;
  printerName: string | null;
  workerNo: string;
}

export interface ReissuedLabels {
  parent: DocumentIssue;
  child: DocumentIssue;
}

/**
 * 확인 대기 분리의 두 라벨을 다시 발행한다 — 사람이 고른 사유를 싣는다(분리 직후 자동 사유 `LOT_SPLIT` 은 서버만
 * 쓴다). 한 요청 두 대상이라 둘 다 발행되거나 둘 다 안 된다.
 */
export const useReissueSplitLabels = () => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: async (input: ReissueInput): Promise<ReissuedLabels> => {
      const { parentLot, childLot } = input.split;
      const data = await runRequest(() =>
        client.POST('/app/document-issues', {
          params: {
            header: { 'Idempotency-Key': createIdempotencyKey(), 'X-Worker-No': input.workerNo },
          },
          body: {
            documentTypeCode: 'PRODUCTION_LOT_LABEL',
            targets: [
              { targetTypeCode: 'LOT', targetId: parentLot.lotId },
              { targetTypeCode: 'LOT', targetId: childLot.lotId },
            ],
            reissueReasonCode: input.reasonCode,
            printerName: input.printerName,
          },
        }),
      );
      const issueOf = (lotId: number): DocumentIssue | undefined =>
        data.items.find((issue) => issue.target.targetId === lotId || issue.lotId === lotId);
      const parent = issueOf(parentLot.lotId);
      const child = issueOf(childLot.lotId);

      if (parent === undefined || child === undefined) {
        throw new Error('두 라벨의 발행 기록을 받지 못했습니다.');
      }

      return { parent, child };
    },
  });
};
