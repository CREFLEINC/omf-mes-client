import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { terminalPrinters } from '../../patterns/pop-terminal-printers';
import { runRequest } from '../../patterns/request';

export type Lot = components['schemas']['Lot'];
export type Item = components['schemas']['Item'];
export type SerialNumber = components['schemas']['SerialNumber'];
export type Printer = components['schemas']['Printer'];
export type DocumentIssue = components['schemas']['DocumentIssue'];
export type DocumentIssueSummary = components['schemas']['DocumentIssueSummary'];
export type CodeValue = components['schemas']['CodeValue'];

export const productionFlowKeys = {
  all: ['production-flow'] as const,
  currentLot: (workOrderId: number) => ['production-flow', 'current-lot', workOrderId] as const,
  completedLots: (workOrderId: number) =>
    ['production-flow', 'completed-lots', workOrderId] as const,
  item: (itemId: number) => ['production-flow', 'item', itemId] as const,
  serials: (lotId: number) => ['production-flow', 'serials', lotId] as const,
  printers: ['production-flow', 'printers'] as const,
  lotIssues: (lotId: number) => ['production-flow', 'lot-issues', lotId] as const,
  tagIssueSummary: (serialIds: readonly number[]) =>
    ['production-flow', 'tag-issue-summary', ...serialIds] as const,
  reissueReasons: ['production-flow', 'reissue-reasons'] as const,
};

/** 서버가 정한 순서의 첫 미마감 LOT 한 건. 화면이 목록 첫 줄을 현재 LOT으로 추측하지 않는다. */
export const useCurrentLot = (workOrderId: number | null): UseQueryResult<Lot | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.currentLot(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async (): Promise<Lot | null> => {
      if (workOrderId === null) throw new Error('작업지시가 없으면 현재 LOT을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: { query: { workOrderId, currentOnly: true, withProgress: true } },
        }),
      );

      return data.items[0] ?? null;
    },
  });
};

/** 마감된 LOT 팝업은 확인 전용이다. 서버의 완료 축을 그대로 사용한다. */
export const useCompletedLots = (
  workOrderId: number | null,
  enabled: boolean,
): UseQueryResult<Lot[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.completedLots(workOrderId ?? 0),
    enabled: enabled && workOrderId !== null,
    queryFn: async (): Promise<Lot[]> => {
      if (workOrderId === null) throw new Error('작업지시가 없으면 마감 LOT을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: { query: { workOrderId, completed: true, page: 1, size: 100 } },
        }),
      );

      return data.items;
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

/** 출력한 인식표 목록과 전체 개체 수를 한 응답에서 얻는다. */
export const useSerials = (lotId: number | null, enabled: boolean) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.serials(lotId ?? 0),
    enabled: enabled && lotId !== null,
    queryFn: async () => {
      if (lotId === null) throw new Error('LOT이 없으면 인식표 개체를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/trace/serial-numbers', { params: { query: { lotId, page: 1, size: 1000 } } }),
      );
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
      const data = await runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode: 'SERIAL_NUMBER',
              targetIds: serialIds,
              documentTypeCode: 'IDENTIFICATION_TAG',
            },
          },
        }),
      );

      return data.items;
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

/** 생산 LOT 라벨을 지원하는 현재 단말 프린터. Electron 셸 값이 있으면 그것이 우선한다. */
export const usePrinters = (): UseQueryResult<Printer[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionFlowKeys.printers,
    queryFn: async (): Promise<Printer[]> => {
      const local = await terminalPrinters();
      if (local !== null) return local;

      const data = await runRequest(() =>
        client.GET('/app/printers', {
          params: { query: { documentTypeCode: 'PRODUCTION_LOT_LABEL' } },
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
