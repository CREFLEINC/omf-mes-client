import type { paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toShipmentDetail, type ShipmentDetail } from './shipment-types';

type ApprovalQuery = NonNullable<paths['/app/approval-requests']['get']['parameters']['query']>;

/**
 * 「출하」 칸의 조회 — 출하 내역(W-04-12)에서 옮겼다(피처 012 T059 · D-9).
 *
 * 출하 상세(`GET /logistics/shipments/{id}`)가 취소 요청 · 실행 · 확정의 잠금 토큰(ETag)도 내린다.
 * 지시서 목록 · 상세와 한 열쇠 묶음(`shipment-schedule`)을 써서, 쓰기 뒤 목록의 ERP 칩 · 상세가 함께 새로 온다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const shipmentConfirmKeys = {
  all: ['shipment-schedule'] as const,
};

export const shipmentDetailPath = (shipmentId: number): string =>
  `/logistics/shipments/${String(shipmentId)}`;

export const useShipmentDetail = (shipmentId: number | null): UseQueryResult<ShipmentDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['shipment-schedule', 'shipment', shipmentId] as const,
    enabled: shipmentId !== null,
    queryFn: async () => {
      if (shipmentId === null) throw new Error('출하를 고르기 전에는 상세를 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/logistics/shipments/{shipmentId}', { params: { path: { shipmentId } } }),
      );
      const request = await client.GET('/logistics/shipment-requests/{shipmentRequestId}', {
        params: { path: { shipmentRequestId: data.shipmentRequestId } },
      });

      return toShipmentDetail(
        data,
        request.data === undefined
          ? null
          : { shipmentRequestNo: request.data.shipmentRequestNo, lines: request.data.lines },
      );
    },
  });
};

export type CancelApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | null;

/** 그 출하의 가장 최근 취소 결재 — 승인됐으면 [취소 실행]을 연다(010 Q13 그대로). */
export const useCancelApproval = (
  shipmentId: number | null,
): UseQueryResult<CancelApprovalStatus> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['shipment-schedule', 'cancel-approval', shipmentId] as const,
    enabled: shipmentId !== null,
    queryFn: async () => {
      if (shipmentId === null) throw new Error('출하를 고르기 전에는 결재를 조회하지 않습니다.');
      const data = await runRequest(() =>
        client.GET('/app/approval-requests', {
          params: {
            query: {
              approvalTypeCode: 'SHIPMENT_CANCEL' as ApprovalQuery['approvalTypeCode'],
              targetTypeCode: 'SHIPMENT' as ApprovalQuery['targetTypeCode'],
              targetId: shipmentId,
              page: 1,
              size: 20,
            },
          },
        }),
      );
      const latest = [...data.items].sort((a, b) => b.approvalRequestId - a.approvalRequestId)[0];
      return (latest?.statusCode ?? null) as CancelApprovalStatus;
    },
  });
};

/**
 * 주소로 들어온 지시서 — 결재(`approvalRequestId` → 출하) 또는 출하(`shipmentId`)에서 그 지시서 번호를 찾는다
 * (피처 012 FR-021 · R-7). 결재함 [열기]와 옛 주소 `/shipment/shipment-confirm` 이 이 길로 온다.
 */
export interface LinkedRequest {
  shipmentRequestId: number;
  shipmentId: number;
}

export const useLinkedRequest = (link: {
  approvalRequestId: number | null;
  shipmentId: number | null;
}): UseQueryResult<LinkedRequest | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['shipment-schedule', 'linked', link.approvalRequestId, link.shipmentId] as const,
    enabled: link.approvalRequestId !== null || link.shipmentId !== null,
    queryFn: async () => {
      let shipmentId = link.shipmentId;

      if (link.approvalRequestId !== null) {
        const approval = await runRequest(() =>
          client.GET('/app/approval-requests/{approvalRequestId}', {
            params: { path: { approvalRequestId: link.approvalRequestId as number } },
          }),
        );
        if (approval.request.target.targetTypeCode === 'SHIPMENT') {
          shipmentId = approval.request.target.targetId;
        }
      }

      if (shipmentId === null) return null;

      const shipment = await runRequest(() =>
        client.GET('/logistics/shipments/{shipmentId}', {
          params: { path: { shipmentId: shipmentId as number } },
        }),
      );

      return { shipmentRequestId: shipment.shipmentRequestId, shipmentId: shipment.shipmentId };
    },
  });
};
