import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toReceiptLineView, toReceiptView, type ReceiptLineView, type ReceiptView } from './types';

/**
 * 이 슬라이스의 읽기 — **계획 대비 수령 한 구획뿐이다.** 스캔·투입 확정의 오퍼레이션은 뒤 슬라이스다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * **줄을 얻으려면 두 번 물어야 한다.** 목록 응답(`ShopfloorReceipt`)에는 줄이 없고 상세
 * (`ShopfloorReceiptDetailResponse`)에만 있다 — 계약이 그렇게 갈라 두었다. 그래서 목록으로
 * 전표를 찾고 전표마다 상세를 부른다.
 */

type Client = ApiClient['client'];

export const materialInputScanKeys = {
  all: ['material-input-scan'] as const,
  receipts: (workOrderId: number) => ['material-input-scan', 'receipts', workOrderId] as const,
  receiptDetail: (shopfloorReceiptId: number) =>
    ['material-input-scan', 'receipt-detail', shopfloorReceiptId] as const,
};

const fetchReceipts = async (client: Client, workOrderId: number): Promise<ReceiptView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/shopfloor-receipts', { params: { query: { workOrderId } } }),
  );

  return data.items.map(toReceiptView);
};

const fetchReceiptLines = async (
  client: Client,
  shopfloorReceiptId: number,
): Promise<ReceiptLineView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/shopfloor-receipts/{shopfloorReceiptId}', {
      params: { path: { shopfloorReceiptId } },
    }),
  );

  return data.lines.map(toReceiptLineView);
};

/** 계획 대비 수령 구획이 읽는 것 전부. */
export interface ReceiptLinesResult {
  lines: ReceiptLineView[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * 이 작업지시로 라인에 내려온 자재를 줄 단위로 모은다.
 *
 * **부분 실패를 성공으로 접지 않는다.** 전표 셋 중 하나의 상세가 실패하면 그 전표의 줄만
 * 통째로 빠지는데, 남은 둘만 그려 두면 화면은 「이게 전부」라고 말하게 된다 — 작업자는 없는
 * 자재를 못 받은 것으로 읽고 결품 처리를 시작한다. 그래서 하나라도 실패하면 **실패로 낸다.**
 *
 * `workOrderId`가 `null`이면 부르지 않는다 — 주소에 작업지시가 없는 상태다.
 */
export const useReceiptLines = (workOrderId: number | null): ReceiptLinesResult => {
  const { client } = useApiClient();

  const receipts = useQuery({
    queryKey: materialInputScanKeys.receipts(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('작업지시 없이는 수령 내역을 조회하지 않습니다.');
      }

      return fetchReceipts(client, workOrderId);
    },
  });

  const receiptIds = receipts.data?.map((receipt) => receipt.shopfloorReceiptId) ?? [];

  const details = useQueries({
    queries: receiptIds.map((shopfloorReceiptId) => ({
      queryKey: materialInputScanKeys.receiptDetail(shopfloorReceiptId),
      queryFn: () => fetchReceiptLines(client, shopfloorReceiptId),
    })),
  });

  const detailError = details.find((detail) => detail.isError);

  return {
    lines: details.flatMap((detail) => detail.data ?? []),
    /*
     * 전표를 찾는 중이거나, 찾은 전표의 상세가 아직 오지 않은 동안은 **불러오는 중**이다.
     * 상세가 하나라도 비어 있는데 「없습니다」로 내면 있는 자재가 없는 것으로 보인다.
     */
    isPending:
      (workOrderId !== null && receipts.isPending) || details.some((detail) => detail.isPending),
    isError: receipts.isError || detailError !== undefined,
    error: receipts.isError ? receipts.error : detailError?.error,
    refetch: () => {
      void receipts.refetch();
      details.forEach((detail) => {
        void detail.refetch();
      });
    },
  };
};
