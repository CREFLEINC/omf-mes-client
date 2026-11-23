import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { RequestListQuery } from './filters';
import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  PageMeta,
  ShipmentRequest,
  Uom,
} from './types';

export interface RequestListResponse {
  items: ApprovalRequest[];
  page: PageMeta;
}

export interface UomListResponse {
  items: Uom[];
  page: PageMeta;
}

export const qualityApprovalKeys = {
  all: ['quality-approval'] as const,
  list: (query: RequestListQuery) => ['quality-approval', 'list', { ...query }] as const,
  detail: (approvalRequestId: number | null) =>
    ['quality-approval', 'detail', approvalRequestId] as const,
  uoms: ['quality-approval', 'condition-uoms'] as const,
  oqcShipment: (shipmentRequestId: number | null) =>
    ['quality-approval', 'oqc-shipment', shipmentRequestId] as const,
};

export const requestDetailPath = (approvalRequestId: number): string =>
  `/app/approval-requests/${String(approvalRequestId)}`;

export const UOM_REFERENCE_PATH = '/mdm/uoms';

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

/**
 * OQC 생략의 대상 출하작업지시(#193) — 번호 · 출하 예정일 · 피킹 LOT 과 출하검사 상태(실행 여부)를 이 한 조회로 읽는다.
 * 생략을 실행하면 서버가 열린 OQC 의뢰를 SKIPPED 로 닫아 출하검사 상태가 PASSED 가 된다.
 */
export const useOqcSkipShipment = (
  shipmentRequestId: number | null,
): UseQueryResult<ShipmentRequest> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: qualityApprovalKeys.oqcShipment(shipmentRequestId),
    enabled: shipmentRequestId !== null,
    queryFn: () => {
      if (shipmentRequestId === null) throw new Error('OQC 생략 대상이 없습니다.');

      return runRequest(() =>
        client.GET('/logistics/shipment-requests/{shipmentRequestId}', {
          params: { path: { shipmentRequestId } },
        }),
      );
    },
  });
};

export const useConditionUoms = (enabled: boolean): UseQueryResult<UomListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: qualityApprovalKeys.uoms,
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });
};
