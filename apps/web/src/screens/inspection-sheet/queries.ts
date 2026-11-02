import type { InspectionSheet, InspectionSheetStepCode, paths } from '@omf-mes/api-client';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { sheetDetailPath, sheetKeys } from '../pop-inspection-sheet/queries';

/** 목록 조건 — 생성 타입(서버 계약)에서 꺼낸다(omf-all-around#210 이후 앞선 계약 사본을 걷었다). */
export type InspectionSheetListQuery = NonNullable<
  paths['/quality/inspection-sheets']['get']['parameters']['query']
> & {
  /**
   * 양식(OP향 · PP향)으로 거르기 — 서버 선행(omf-server 브랜치 feat/aa-217-sheet-list-form-layout · omf-all-around#217).
   * 다음 서버 전달본으로 타입을 다시 만들면 생성 타입이 갖게 되니 이 덧붙임을 걷는다.
   */
  formLayoutCode?: 'OP' | 'PP';
};

/** 한 쪽 크기 기본값 — 쪽 이동 줄에서 20 · 50 · 100 으로 바꾼다(#217). */
export const PAGE_SIZE = 50;

export const listKey = (query: InspectionSheetListQuery) =>
  [...sheetKeys.all, 'list', query] as const;

export const useSheetList = (query: InspectionSheetListQuery, enabled = true) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: listKey(query),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-sheets', {
          params: { query: { size: PAGE_SIZE, ...query } },
        }),
      ),
  });
};

/**
 * 스캔 칸 하나로 LOT · 시리얼을 함께 받는다(사용자 지시 2026-11-02 · #217). 그 값으로 거른 LOT 검사표가 있으면 LOT 번호로,
 * 없으면 시리얼 번호로 거른다 — 번호 모양으로 짐작하지 않고 서버에 물어 정한다. 비면 거르지 않는다.
 * 정해지기 전(묻는 중)은 `null` — 목록 · 건수 조회를 그동안 미룬다.
 */
export const useScanFilter = (
  scan: string,
): Pick<InspectionSheetListQuery, 'lotNo' | 'serialNo'> | null => {
  const { client } = useApiClient();
  const value = scan.trim();
  const byLot = useQuery({
    queryKey: [...sheetKeys.all, 'scan-kind', value] as const,
    enabled: value !== '',
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-sheets', {
          params: { query: { lotNo: value, page: 1, size: 1 } },
        }),
      ),
  });
  if (value === '') return {};
  if (byLot.data === undefined) return byLot.isError ? { lotNo: value } : null;
  return byLot.data.page.total > 0 ? { lotNo: value } : { serialNo: value };
};

/**
 * 작업지시 조건 — 목록은 작업지시 번호(id)로만 거르므로, 적은 W/O 번호를 작업지시 목록에서 찾아 번호와 꼭 같은 것의 id 로 바꾼다
 * (사용자 지시 2026-11-02 · #217). 없는 번호면 id 0 으로 걸어 빈 목록이 나온다. 비면 거르지 않는다. 찾는 중은 `null`.
 */
export const useWorkOrderFilter = (
  workOrderNo: string,
): Pick<InspectionSheetListQuery, 'workOrderId'> | null => {
  const { client } = useApiClient();
  const value = workOrderNo.trim();
  const found = useQuery({
    queryKey: [...sheetKeys.all, 'work-order-no', value] as const,
    enabled: value !== '',
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/work-orders', { params: { query: { q: value, size: 50 } } }),
      ),
  });
  if (value === '') return {};
  if (found.data === undefined) return found.isError ? { workOrderId: 0 } : null;
  const match = found.data.items.find(
    (order) => order.workOrderNo.toLowerCase() === value.toLowerCase(),
  );
  return { workOrderId: match?.workOrderId ?? 0 };
};

/**
 * 상태 칩 건수 — 지금 조건에서 상태만 바꿔 한 줄씩 받아 전체 건수만 쓴다(검사 실적 판정 칩과 같은 방식 · #217).
 * 못 센 칩은 `undefined`(숫자 없이 이름만).
 */
export const useSheetCounts = (
  query: InspectionSheetListQuery,
  statuses: readonly (InspectionSheet['statusCode'] | undefined)[],
  enabled = true,
): (number | undefined)[] => {
  const { client } = useApiClient();
  return useQueries({
    queries: statuses.map((statusCode) => {
      const countQuery: InspectionSheetListQuery = { ...query, page: 1, size: 1 };
      if (statusCode === undefined) delete countQuery.statusCode;
      else countQuery.statusCode = statusCode;
      return {
        queryKey: [...sheetKeys.all, 'count', countQuery] as const,
        enabled,
        queryFn: () =>
          runRequest(() =>
            client.GET('/quality/inspection-sheets', { params: { query: countQuery } }),
          ),
      };
    }),
  }).map((result) => result.data?.page.total);
};

/** 관리자 결정 — 단계 서명·승인·확인·승인 취소. 모두 검사표 한 장의 If-Match 로 잠근다. */
export type Decision =
  | { kind: 'sign'; stepCode: InspectionSheetStepCode }
  | { kind: 'approve' }
  | { kind: 'check' }
  | { kind: 'reopen'; reason: string };

/** 성공하면 새 검사표를 넘긴다 — 무엇을 했는지는 부르는 쪽이 보낸 값으로 안다. */
export const useDecision = (id: number | null, onDone: (sheet: InspectionSheet) => void) => {
  const { client } = useApiClient();

  return useMasterWrite<Decision, InspectionSheet>({
    request: (decision, headers) => {
      const header = {
        'Idempotency-Key': headers['Idempotency-Key'],
        'If-Match': requireIfMatch(headers),
      };
      const inspectionSheetId = id ?? 0;
      switch (decision.kind) {
        case 'sign':
          return client.POST(
            '/quality/inspection-sheets/{inspectionSheetId}/steps/{stepCode}:sign',
            {
              params: { path: { inspectionSheetId, stepCode: decision.stepCode }, header },
            },
          );
        case 'approve':
          return client.POST('/quality/inspection-sheets/{inspectionSheetId}:approve', {
            params: { path: { inspectionSheetId }, header },
          });
        case 'check':
          return client.POST('/quality/inspection-sheets/{inspectionSheetId}:check', {
            params: { path: { inspectionSheetId }, header },
          });
        case 'reopen':
          return client.POST('/quality/inspection-sheets/{inspectionSheetId}:reopen', {
            params: { path: { inspectionSheetId }, header },
            body: { reason: decision.reason },
          });
      }
    },
    etagPath: id === null ? null : sheetDetailPath(id),
    invalidateKeys: [sheetKeys.all],
    knownFields: ['reason'],
    onSuccess: onDone,
  });
};
