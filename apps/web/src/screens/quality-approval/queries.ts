import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { RequestListQuery } from './filters';
import type { ApprovalRequest, PageMeta } from './types';

export interface RequestListResponse {
  items: ApprovalRequest[];
  page: PageMeta;
}

export const qualityApprovalKeys = {
  list: (query: RequestListQuery) => ['quality-approval', 'list', { ...query }] as const,
};

export const useApprovalRequests = (
  query: RequestListQuery,
): UseQueryResult<RequestListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: qualityApprovalKeys.list(query),
    queryFn: () => runRequest(() => client.GET('/app/approval-requests', { params: { query } })),
  });
};
