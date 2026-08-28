import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  toLineView,
  toPrinterView,
  toReceiptView,
  toTargetRows,
  type LineView,
  type PrinterView,
  type ReceiptListResult,
  type ReceiptView,
  type TargetRow,
} from './types';

/**
 * 이 화면의 요청 — 이 슬라이스에서는 **읽기 하나뿐**이다.
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 첫 진입 | 라벨 미발행 입하 건 목록 |
 *
 * ⚠ **미부착(`supplierLotMissing`) 조건을 아직 싣지 못한다.** 스펙 §3-6 은 목록 원천을
 * `?supplierLotMissing=true&labelIssued=false` 두 질의로 정했고 **설계 저장소의 계약에는
 * 이미 들어와 있다.** 다만 그 계약을 이 저장소에 반영하려면 생성 타입을 다시 만들어야 하는데,
 * 그 재생성이 **이번 이슈 범위 밖의 다른 화면 다섯 곳을 깨뜨린다**(필수 필드 신설 22곳).
 * 계약 반영이 별도로 이뤄질 때까지 **화면이 받아서 거른다** — 그래서 한 쪽에 보이는 줄 수가
 * 쪽 크기와 다를 수 있고, 그 사실을 화면이 밝힌다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

/** 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** — 요청 URL이 조건을 그대로 드러낸다. */
export interface ReceiptListQuery {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
}

const RECEIPT_LIST_KEY = ['pop-material-lot-label', 'receipts'] as const;

export const receiptKeys = {
  lists: RECEIPT_LIST_KEY,
  list: (query: ReceiptListQuery) => [...RECEIPT_LIST_KEY, query] as const,
  /**
   * 라인 캐시는 **고른 건마다 갈린다.** 목록 키와 앞머리를 갈라 두어, 목록만 다시 불러도
   * 라인까지 함께 무효화되지 않게 한다.
   */
  lines: (inboundReceiptId: number | null) =>
    ['pop-material-lot-label', 'receipt-lines', inboundReceiptId] as const,
};

const fetchReceipts = async (
  client: Client,
  query: ReceiptListQuery,
): Promise<ReceiptListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts', {
      // 이미 발행된 건은 목록에서 뺀다. 그 건은 재인쇄 경로로 간다.
      params: { query: { ...query, labelIssued: false } },
    }),
  );

  return { items: data.items.map(toReceiptView), page: data.page };
};

/**
 * 발행 대상 입하 건 목록.
 *
 * **조건 없이 곧바로 조회한다.** 화면에 들어오면 무엇을 고를 수 있는지 바로 보여야 한다 —
 * 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다. 터치 단말에는 조건을 치는 자리가 없다.
 */
export const useReceipts = (query: ReceiptListQuery): UseQueryResult<ReceiptListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.list(query),
    queryFn: () => fetchReceipts(client, query),
  });
};

const fetchReceiptLines = async (client: Client, inboundReceiptId: number): Promise<LineView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts/{inboundReceiptId}/lines', {
      params: { path: { inboundReceiptId } },
    }),
  );

  return data.items.map(toLineView);
};

/**
 * 고른 입하 건의 품목.
 *
 * **고르기 전에는 부르지 않는다**(`enabled`). 캐시 키가 고른 번호를 담으므로 같은 건을
 * 다시 그려도 요청이 한 번을 넘지 않는다.
 */
export const useReceiptLines = (inboundReceiptId: number | null): UseQueryResult<LineView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.lines(inboundReceiptId),
    enabled: inboundReceiptId !== null,
    queryFn: () => {
      if (inboundReceiptId === null) {
        throw new Error('입하 건을 고르기 전에는 품목을 조회하지 않습니다.');
      }

      return fetchReceiptLines(client, inboundReceiptId);
    },
  });
};

/**
 * 이 단말이 쓸 수 있는 프린터와 그 상태.
 *
 * ⛔ **`documentTypeCode`로 거르지 않는다.** 문서 유형 값 목록이 아직 확정되지 않아(착수 이슈
 * 미결 1) 화면이 값을 넣으면 서버가 모르는 코드로 걸러 **목록이 통째로 비어 올 수 있다.**
 * 거르지 않으면 최악이 「쓸 수 없는 프린터도 함께 보인다」이고, 거르면 최악이 「쓸 수 있는
 * 프린터가 없다고 보인다」다 — 뒤쪽이 더 나쁘다.
 *
 * ⚠ **비어 올 수 있다.** 서버가 무엇을 보고 목록을 만드는지가 미결이다(착수 이슈 6항).
 * 빈 목록은 정상 응답이므로 오류로 다루지 않고 빈 상태로 그린다.
 */
export const usePrinters = (): UseQueryResult<PrinterView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-material-lot-label', 'printers'],
    queryFn: async () => {
      const data = await runRequest(() => client.GET('/app/printers', {}));

      return data.items.map(toPrinterView);
    },
  });
};

export interface TargetRowsResult {
  rows: TargetRow[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * 목록에 놓일 발번 대상 줄 — **입하 건마다 라인을 받아 한 목록으로 편다.**
 *
 * 스펙 §3 은 품목·수량이 목록에 바로 보이는 한 단계다. 계약이 입하 건 목록에 품목을 싣지
 * 않아 건마다 라인을 따로 부르고, 그 결과를 화면이 합친다.
 *
 * ⚠ **요청이 쪽마다 1 + N 이다.** 쪽 크기를 작게 두어(POP 목록은 한 화면에 몇 줄뿐이다)
 * 감당한다. 계약이 라인을 함께 내려 주면 1 회로 줄어든다(검토 요청 omf-mes#245 ③).
 */
export const useTargetRows = (receipts: ReceiptView[]): TargetRowsResult => {
  const { client } = useApiClient();

  const results = useQueries({
    queries: receipts.map((receipt) => ({
      queryKey: receiptKeys.lines(receipt.inboundReceiptId),
      queryFn: () => fetchReceiptLines(client, receipt.inboundReceiptId),
    })),
  });

  return {
    rows: results.flatMap((result, index) => {
      const receipt = receipts[index];

      return receipt === undefined || result.data === undefined
        ? []
        : toTargetRows(receipt, result.data);
    }),
    isPending: results.some((result) => result.isPending),
    // 한 건이라도 실패하면 목록이 불완전하다 — 일부만 보이는 것을 「전부」로 내지 않는다.
    isError: results.some((result) => result.isError),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};
