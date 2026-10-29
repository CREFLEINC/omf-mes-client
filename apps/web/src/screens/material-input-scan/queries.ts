import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
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
  consumptions: (workOrderId: number) =>
    ['material-input-scan', 'consumptions', workOrderId] as const,
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

/** 이 W/O에 이미 기록된 투입의 LOT별 합. 수량은 저장 단위(`uomId`) 그대로다. */
export interface RecordedLot {
  qty: number;
  uomId: number;
  /** 기록마다 단위가 달라 합(`qty`)을 믿을 수 없다. */
  hasMixedUom: boolean;
  /** 합에 들어간 투입 기록 번호. 화면이 방금 기록한 건이 이미 들어 있는지 가른다. */
  consumptionIds: readonly number[];
  /** 건별 기록(편집 영역의 투입 기록 목록). 수량은 저장 단위 그대로다. */
  items: readonly RecordedItem[];
}

export interface RecordedItem {
  materialConsumptionId: number;
  qty: number;
  uomId: number;
  occurredAt: string;
}

export interface RecordedConsumptions {
  byLot: ReadonlyMap<number, RecordedLot>;
  isPending: boolean;
  isError: boolean;
}

const EMPTY_RECORDED: ReadonlyMap<number, RecordedLot> = new Map();

/**
 * 이 W/O에 이미 기록된 투입(`GET /production/material-consumptions?workOrderId=`, 사용자 화면 확인
 * 결정 2026-10-23, PI-13). 화면을 다시 열어도 기록된 LOT이 「스캔 전」으로 보이지 않게 하고, 스캔한
 * LOT의 투입 수량 기본값(수령 − 기록)에 쓴다.
 *
 * ⛔ 판정에 쓰지 않는다. 표시와 기본값뿐이다. 못 받으면 비어 있는 것으로 두고 화면은 그대로 선다.
 */
export const useRecordedConsumptions = (workOrderId: number | null): RecordedConsumptions => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: materialInputScanKeys.consumptions(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) throw new Error('작업지시 없이는 투입 기록을 조회하지 않습니다.');

      const data = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/production/material-consumptions', {
            params: { query: { workOrderId, page, size } },
          }),
        ),
      );

      const byLot = new Map<number, RecordedLot>();
      for (const item of data.items) {
        const prev = byLot.get(item.lotId);
        byLot.set(item.lotId, {
          qty: (prev?.qty ?? 0) + item.inputQty,
          uomId: item.uomId,
          hasMixedUom: prev !== undefined && (prev.hasMixedUom || prev.uomId !== item.uomId),
          consumptionIds: [...(prev?.consumptionIds ?? []), item.materialConsumptionId],
          items: [
            ...(prev?.items ?? []),
            {
              materialConsumptionId: item.materialConsumptionId,
              qty: item.inputQty,
              uomId: item.uomId,
              occurredAt: item.occurredAt,
            },
          ],
        });
      }

      return byLot;
    },
  });

  return {
    byLot: query.data ?? EMPTY_RECORDED,
    isPending: workOrderId !== null && query.isPending,
    isError: query.isError,
  };
};
