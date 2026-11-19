import type { components, paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ConfirmListQuery } from './filters';
import { toShipmentDetail, toShipmentRow, type ShipmentDetail, type ShipmentRow } from './types';

type PageMeta = components['schemas']['PageMeta'];
type ApprovalQuery = NonNullable<paths['/app/approval-requests']['get']['parameters']['query']>;

/**
 * 이 화면의 읽기. 쓰기(`:confirm`·`:request-cancel`)는 `mutations.ts`가 갖는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export const shipmentConfirmKeys = {
  all: ['shipment-confirm'] as const,
  list: (query: ConfirmListQuery | null) =>
    ['shipment-confirm', 'list', query === null ? null : { ...query }] as const,
};

export interface ShipmentListResult {
  items: ShipmentRow[];
  page: PageMeta;
  /** ERP 송신 상태별 건수(송신 거르기만 뺀 같은 조건) — 서버가 안 실으면 `null`(칩에 수를 붙이지 않는다). */
  erpSendStatusCounts: Readonly<Record<string, number>> | null;
}

/**
 * 출하 목록(피처 010 — 미확정만이 아니라 모든 출하).
 *
 * ⭐ ERP 송신 거르기는 서버에 싣는다(`erpSendStatus`) — 화면이 받아서 거르면 쪽 단위 목록의
 * 앞쪽만 훑게 된다(공유계약 L-11).
 *
 * ⚠ **기간이 없으면 부르지 않는다**(L-3) — 계약이 출하일 시작을 필수로 표시한다.
 */
export const useShipmentList = (
  query: ConfirmListQuery | null,
): UseQueryResult<ShipmentListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: shipmentConfirmKeys.list(query),
    enabled: query !== null,
    queryFn: async () => {
      if (query === null) throw new Error('기간 없이는 출하를 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/logistics/shipments', { params: { query } }),
      );

      return {
        items: data.items.map(toShipmentRow),
        page: data.page,
        erpSendStatusCounts: data.erpSendStatusCounts ?? null,
      };
    },
  });
};

/**
 * 확정에 실을 낙관적 잠금 토큰을 확보한다.
 *
 * ⭐ **상세 GET 이 ETag 를 내리고 보관소가 그것을 경로로 붙든다** — 계약이 「그 쓰기가 «잠그는
 * 대상»의 조회가 내려주는 ETag」라고 못박았고, 목록 응답에는 건별 ETag 가 없다(HTTP 가 그렇다).
 * 그래서 **확정 한 건마다 상세를 먼저 읽는다.**
 *
 * ⚠ 다건 확정이 요청 2N 번이 되는 이유가 이것이다. 줄이려면 계약이 목록에 판 번호를 실어
 * 주거나 일괄 확정 오퍼레이션을 내야 한다.
 */
export const shipmentDetailPath = (shipmentId: number): string =>
  `/logistics/shipments/${String(shipmentId)}`;

/**
 * 고른 한 건의 상세 — 라인·LOT·출하 관리 코드와, 그 지시서의 목표·OQC 판정·위치 몫·교체 이력.
 *
 * ⭐ 이 조회가 **취소 요청·확정의 잠금 토큰**(ETag)도 받는다 — 그 토큰은 이 조회의 응답 헤더로만
 * 온다(공유계약 B-1). 지시서를 못 받아도 출하 상세는 그린다(목표·판정만 빈다).
 */
export const useShipmentDetail = (shipmentId: number | null): UseQueryResult<ShipmentDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['shipment-confirm', 'detail', shipmentId] as const,
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

/**
 * 이 출하의 마지막 취소 결재(`SHIPMENT_CANCEL`) 상태 — 승인됐으면 상세에 [취소 실행]을 세운다(Q13).
 * OQC 생략(W-04-03 `queue-skip-cell`)과 같은 방식이다: 결재함은 승인만 하고 실행은 대상 화면에서 한다.
 */
export const useCancelApproval = (
  shipmentId: number | null,
): UseQueryResult<CancelApprovalStatus> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['shipment-confirm', 'cancel-approval', shipmentId] as const,
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
 * 결재함 대상 링크(`?approvalRequestId=`) → 그 결재의 출하 id. 결재함이 화면 ID 표(`W-04-12`)로 이 화면을 연다.
 */
export const useApprovalTargetShipment = (
  approvalRequestId: number | null,
): UseQueryResult<number | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['shipment-confirm', 'approval-target', approvalRequestId] as const,
    enabled: approvalRequestId !== null,
    queryFn: async () => {
      if (approvalRequestId === null) throw new Error('결재 번호가 없습니다.');
      const data = await runRequest(() =>
        client.GET('/app/approval-requests/{approvalRequestId}', {
          params: { path: { approvalRequestId } },
        }),
      );
      return data.request.target.targetTypeCode === 'SHIPMENT'
        ? data.request.target.targetId
        : null;
    },
  });
};
