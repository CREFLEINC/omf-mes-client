import type {
  InspectionSheet,
  InspectionSheetListQuery,
  InspectionSheetStepCode,
} from '@omf-mes/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { sheetDetailPath, sheetKeys } from '../pop-inspection-sheet/queries';

/** 한 쪽 크기. */
export const PAGE_SIZE = 50;

export const listKey = (query: InspectionSheetListQuery) =>
  [...sheetKeys.all, 'list', query] as const;

export const useSheetList = (query: InspectionSheetListQuery) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: listKey(query),
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-sheets', {
          params: { query: { ...query, size: PAGE_SIZE } },
        }),
      ),
  });
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
