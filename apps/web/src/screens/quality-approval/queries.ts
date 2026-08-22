import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { RequestListQuery } from './filters';
import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  Concession,
  ConcessionListResponse,
  PageMeta,
} from './types';

export interface RequestListResponse {
  items: ApprovalRequest[];
  page: PageMeta;
}

export const qualityApprovalKeys = {
  all: ['quality-approval'] as const,
  list: (query: RequestListQuery) => ['quality-approval', 'list', { ...query }] as const,
  detail: (approvalRequestId: number | null) =>
    ['quality-approval', 'detail', approvalRequestId] as const,
  candidates: (approvalRequestId: number | null) =>
    ['quality-approval', 'condition-candidates', approvalRequestId] as const,
  condition: (concessionId: number | null) =>
    ['quality-approval', 'condition', concessionId] as const,
};

export const requestDetailPath = (approvalRequestId: number): string =>
  `/app/approval-requests/${String(approvalRequestId)}`;

export const concessionDetailPath = (concessionId: number): string =>
  `/quality/concessions/${String(concessionId)}`;

export const useApprovalRequests = (
  query: RequestListQuery,
): UseQueryResult<RequestListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: qualityApprovalKeys.list(query),
    queryFn: () => runRequest(() => client.GET('/app/approval-requests', { params: { query } })),
  });
};

export const useApprovalRequestDetail = (
  approvalRequestId: number | null,
): UseQueryResult<ApprovalRequestDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: qualityApprovalKeys.detail(approvalRequestId),
    enabled: approvalRequestId !== null,
    queryFn: () => {
      if (approvalRequestId === null) {
        throw new Error('요청을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/approval-requests/{approvalRequestId}', {
          params: { path: { approvalRequestId } },
        }),
      );
    },
  });
};

export const useConcessionCandidates = (
  approvalRequestId: number | null,
): UseQueryResult<ConcessionListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: qualityApprovalKeys.candidates(approvalRequestId),
    enabled: approvalRequestId !== null,
    queryFn: () => {
      if (approvalRequestId === null) throw new Error('승인 요청 상세가 준비되지 않았습니다.');

      return runRequest(() =>
        client.GET('/quality/concessions', {
          params: { query: { approvalRequestId, page: 1, size: 2 } },
        }),
      );
    },
  });
};

export const useConcessionDetail = (concessionId: number | null): UseQueryResult<Concession> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: qualityApprovalKeys.condition(concessionId),
    enabled: concessionId !== null,
    queryFn: () => {
      if (concessionId === null) throw new Error('연결된 조건이 특정되지 않았습니다.');

      return runRequest(() =>
        client.GET('/quality/concessions/{concessionId}', {
          params: { path: { concessionId } },
        }),
      );
    },
  });
};
