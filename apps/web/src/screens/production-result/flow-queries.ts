import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { isServerBaselineBuild } from '../../patterns/pop-server-baseline';
import { terminalPrinters } from '../../patterns/pop-terminal-printers';
import { runRequest } from '../../patterns/request';
import { CONTRACT_BATCH_SIZE, chunkTargets } from './flow-state';

export type Lot = components['schemas']['Lot'];
export type LotDetailResponse = components['schemas']['LotDetailResponse'];
export type Item = components['schemas']['Item'];
export type SerialNumber = components['schemas']['SerialNumber'];
export type Printer = components['schemas']['Printer'];
export type DocumentIssue = components['schemas']['DocumentIssue'];
export type DocumentIssueSummary = components['schemas']['DocumentIssueSummary'];
export type CodeValue = components['schemas']['CodeValue'];
export type PageMeta = components['schemas']['PageMeta'];
export type DocumentTypeCode = DocumentIssue['documentTypeCode'];

export interface CompletedLotPage {
  items: Lot[];
  page: PageMeta;
}

export const productionFlowKeys = {
  all: ['production-flow'] as const,
  currentLot: (workOrderId: number) => ['production-flow', 'current-lot', workOrderId] as const,
  lotDetail: (lotId: number) => ['production-flow', 'lot-detail', lotId] as const,
  completedLots: (workOrderId: number, page: number) =>
    ['production-flow', 'completed-lots', workOrderId, page] as const,
  item: (itemId: number) => ['production-flow', 'item', itemId] as const,
  serials: (lotId: number) => ['production-flow', 'serials', lotId] as const,
  printers: (documentTypeCode: DocumentTypeCode) =>
    ['production-flow', 'printers', documentTypeCode] as const,
  lotIssues: (lotId: number) => ['production-flow', 'lot-issues', lotId] as const,
  tagIssueSummary: (serialIds: readonly number[]) =>
    ['production-flow', 'tag-issue-summary', ...serialIds] as const,
  reissueReasons: ['production-flow', 'reissue-reasons'] as const,
};

/**
 * 「현재 LOT 을 가릴 수 없다」는 사실. 화면은 이것을 오류가 아니라 **막힘**으로 말한다.
 *
 * ⛔ **미마감 LOT 이 둘 이상이면 첫 줄을 집지 않는다**(#1095). 서버 구현 기준선의
 *    `GET /trace/lots` 에는 「현재 것만」(`currentOnly`)도 정렬 축(`sort`)도 없다 — 어느 줄이
 *    먼저 오는지는 서버 마음이다. 그 상태에서 첫 줄을 현재 LOT 으로 읽으면 **다른 LOT 에
 *    생산 실적이 붙는다.** 되돌릴 수 없는 쓰기라 「아마 이것일 것」으로 진행하지 않는다.
 */
export class CurrentLotAmbiguousError extends Error {
  constructor() {
    super('현재 LOT을 가릴 수 없습니다.');
    this.name = 'CurrentLotAmbiguousError';
  }
}

/**
 * 서버가 정한 순서의 첫 미마감 LOT 한 건. 화면이 목록 첫 줄을 현재 LOT으로 추측하지 않는다.
 *
 * ## 질의가 두 갈래다 — 보는 서버가 다르기 때문이다(`patterns/pop-server-baseline`)
 *
 * ⭐ **목·시험은 고정 설계대로 `currentOnly` 로 묻는다.** 그 축이 곧 「현재 LOT」의 정의이고,
 *    목은 생산 LOT · 대기·진행 상태 · 회차 정렬 셋으로 한 건을 골라 답한다. 이쪽에는 애매함이
 *    없다.
 *
 * ⛔ **배포본에는 그 축이 없다.** `currentOnly` 를 보내도 서버가 읽지 않아 「현재 것만」이라는
 *    뜻이 조용히 사라진 채 전체 목록이 온다. 그래서 남은 완료 축(`completed=false`)으로 좁히되
 *    **두 건 이상이면 고르지 않고 막는다**(위 `CurrentLotAmbiguousError`). 한 건이면 애매할
 *    것이 없으므로 그대로 쓴다 — 현장 대부분이 이 경우다.
 *
 * ⚠ **진척(`withProgress`)은 어느 쪽에서도 이 목록으로 받지 않는다.** 기준선이 그 축을 상세
 *    (`/trace/lots/{lotId}`)에만 남겨, 출처를 한 곳으로 모아 두어야 두 서버에서 같게 돈다.
 *    양품 누계는 `useLotDetail` 이 받는다.
 */
export const useCurrentLot = (workOrderId: number | null): UseQueryResult<Lot | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.currentLot(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async (): Promise<Lot | null> => {
      if (workOrderId === null) throw new Error('작업지시가 없으면 현재 LOT을 조회하지 않습니다.');

      if (!isServerBaselineBuild()) {
        const data = await runRequest(() =>
          client.GET('/trace/lots', { params: { query: { workOrderId, currentOnly: true } } }),
        );

        return data.items[0] ?? null;
      }

      /* 두 건째가 있는지 보려면 두 건을 받아야 한다 — 총계만으로는 쪽이 잘렸는지와 갈리지 않는다. */
      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: { query: { workOrderId, completed: false, page: 1, size: 2 } },
        }),
      );

      if (data.items.length > 1) throw new CurrentLotAmbiguousError();

      return data.items[0] ?? null;
    },
  });
};

/**
 * 현재 LOT 의 **상세** 한 건. 마감이 실을 낙관적 잠금 값을 여기서 받는다(#1005).
 *
 * ⭐ **목록으로는 잠글 수 없다.** 판 번호(`version_no`)는 본문에 실리지 않고 **조회 응답의
 *    `ETag` 헤더**로만 온다(공유계약 B-1). 그 보관소는 «요청 경로별»로 담기므로
 *    `GET /trace/lots`(목록)로 받은 값은 `/trace/lots/{lotId}` 자리에 들어가지 않는다.
 *
 * ⛔ **이 조회가 빠지면 잠금이 조용히 사라진다.** 마감 요청이 `If-Match` 를 «있으면» 싣도록
 *    돼 있고 계약도 Optional 이라, 값이 없으면 헤더만 빠진 채 요청이 그대로 나가 성공한다 —
 *    코드는 잠그는 «모양»이고 실제로는 두 단말이 같은 LOT 을 함께 마감한다. 육안 리뷰로는
 *    잡히지 않아 감지기가 이 자리를 지킨다.
 *
 * ⭐ **양품 누계도 여기서 온다**(#1095). 서버 구현 기준선이 `withProgress` 를 목록에서 거두고
 *    상세에만 남겨, 「서버가 계산한 LOT 양품 누계」의 출처가 이 한 곳이 됐다. 헤더만 쓰던
 *    조회가 아니다 — 이 값이 비면 화면은 실적이 이미 적용됐는지를 «모르는» 상태가 된다.
 */
export const useLotDetail = (lotId: number | null): UseQueryResult<LotDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.lotDetail(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: () => {
      if (lotId === null) throw new Error('LOT이 없으면 상세를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/trace/lots/{lotId}', {
          params: { path: { lotId }, query: { withProgress: true } },
        }),
      );
    },
  });
};

/** 마감된 LOT 팝업은 확인 전용이다. 서버의 완료 축을 그대로 사용한다. */
export const useCompletedLots = (
  workOrderId: number | null,
  enabled: boolean,
  page: number,
): UseQueryResult<CompletedLotPage> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.completedLots(workOrderId ?? 0, page),
    enabled: enabled && workOrderId !== null,
    queryFn: async (): Promise<CompletedLotPage> => {
      if (workOrderId === null) throw new Error('작업지시가 없으면 마감 LOT을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: { query: { workOrderId, completed: true, page, size: 20 } },
        }),
      );

      return data;
    },
  });
};

/** 인식표 대상 판정은 품목의 서버 값을 읽는다. 화면이 품목 유형으로 추정하지 않는다. */
export const useItem = (itemId: number | null): UseQueryResult<Item> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.item(itemId ?? 0),
    enabled: itemId !== null,
    queryFn: async (): Promise<Item> => {
      if (itemId === null) throw new Error('품목이 없으면 인식표 대상을 판정하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
      );

      return data.item;
    },
  });
};

/** 출력한 인식표 목록을 끝 쪽까지 읽는다. 첫 쪽의 total만 전체 목록으로 오해하지 않는다. */
export const useSerials = (lotId: number | null, enabled: boolean) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.serials(lotId ?? 0),
    enabled: enabled && lotId !== null,
    queryFn: async () => {
      if (lotId === null) throw new Error('LOT이 없으면 인식표 개체를 조회하지 않습니다.');

      const first = await runRequest(() =>
        client.GET('/trace/serial-numbers', {
          params: { query: { lotId, page: 1, size: CONTRACT_BATCH_SIZE } },
        }),
      );
      const totalPages = Math.ceil(first.page.total / Math.max(1, first.page.size));
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2).map(
          async (page) =>
            runRequest(() =>
              client.GET('/trace/serial-numbers', {
                params: { query: { lotId, page, size: CONTRACT_BATCH_SIZE } },
              }),
            ),
        ),
      );

      return {
        items: [first, ...rest].flatMap((response) => response.items),
        page: first.page,
      };
    },
  });
};

/** 개체 생성과 인식표 발행 기록은 별도 쓰기다. 대상별 요약으로 끊긴 중간 상태를 복구한다. */
export const useTagIssueSummary = (
  serials: readonly SerialNumber[],
  enabled: boolean,
): UseQueryResult<DocumentIssueSummary[]> => {
  const { client } = useApiClient();
  const serialIds = serials
    .map((serial) => serial.serialNumberId)
    .sort((left, right) => left - right);

  return useQuery({
    queryKey: productionFlowKeys.tagIssueSummary(serialIds),
    enabled: enabled && serialIds.length > 0,
    queryFn: async () => {
      const chunks = chunkTargets(serialIds);
      const responses = await Promise.all(
        chunks.map(async (targetIds) =>
          runRequest(() =>
            client.GET('/app/document-issues/summary', {
              params: {
                query: {
                  targetTypeCode: 'SERIAL_NUMBER',
                  targetIds,
                  documentTypeCode: 'IDENTIFICATION_TAG',
                },
              },
            }),
          ),
        ),
      );

      return responses.flatMap((response) => response.items);
    },
  });
};

/** 재출력 사유는 환경별 식별자가 아니라 계약의 코드그룹 이름으로 조회한다. */
export const useReissueReasons = (enabled: boolean): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.reissueReasons,
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: 'REISSUE_REASON', page: 1, size: 100 } },
        }),
      );

      return data.items;
    },
  });
};

/** 현재 LOT의 생산 LOT 라벨 발행·인쇄 상태. 재진입해도 단계가 사라지지 않게 서버 이력을 쓴다. */
export const useLotIssues = (lotId: number | null): UseQueryResult<DocumentIssue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.lotIssues(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: async (): Promise<DocumentIssue[]> => {
      if (lotId === null) throw new Error('LOT이 없으면 라벨 발행 이력을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/app/document-issues', {
          params: {
            query: {
              documentTypeCode: 'PRODUCTION_LOT_LABEL',
              targetTypeCode: 'LOT',
              targetId: lotId,
              page: 1,
              size: 100,
            },
          },
        }),
      );

      return data.items;
    },
  });
};

/** 문서 유형을 지원하는 현재 단말 프린터. 검증할 수 없는 셸 목록은 LOT 라벨에만 유지한다. */
export const usePrinters = (documentTypeCode: DocumentTypeCode): UseQueryResult<Printer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.printers(documentTypeCode),
    queryFn: async (): Promise<Printer[]> => {
      const local = await terminalPrinters();
      if (local !== null) {
        const verified = local.filter((printer) =>
          printer.supportedDocumentTypeCodes?.includes(documentTypeCode),
        );
        const hasCapabilityData = local.some(
          (printer) => printer.supportedDocumentTypeCodes !== undefined,
        );

        if (hasCapabilityData) return verified;
        if (documentTypeCode === 'PRODUCTION_LOT_LABEL') return local;
      }

      const data = await runRequest(() =>
        client.GET('/app/printers', {
          params: { query: { documentTypeCode } },
        }),
      );

      return data.items;
    },
  });
};

export const defaultPrinter = (printers: readonly Printer[] | undefined): Printer | null => {
  if (printers === undefined || printers.length === 0) return null;

  return printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;
};

/** 회차가 가장 큰 발행 건이 현재 상태다. 배열 순서를 신뢰하지 않는다. */
export const latestIssue = (issues: readonly DocumentIssue[] | undefined): DocumentIssue | null =>
  issues?.reduce<DocumentIssue | null>(
    (latest, issue) => (latest === null || issue.issueSeq > latest.issueSeq ? issue : latest),
    null,
  ) ?? null;
