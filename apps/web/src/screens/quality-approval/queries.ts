import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { RequestListQuery } from './filters';
import type { ApprovalRequest, ApprovalRequestDetail, PageMeta } from './types';

export interface RequestListResponse {
  items: ApprovalRequest[];
  page: PageMeta;
}

export const qualityApprovalKeys = {
  all: ['quality-approval'] as const,
  list: (query: RequestListQuery) => ['quality-approval', 'list', { ...query }] as const,
  detail: (approvalRequestId: number | null) =>
    ['quality-approval', 'detail', approvalRequestId] as const,
};

export const requestDetailPath = (approvalRequestId: number): string =>
  `/app/approval-requests/${String(approvalRequestId)}`;

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
