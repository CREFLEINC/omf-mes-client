import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toShipmentRequestCandidate, type ShipmentRequestCandidate } from './types';

type PageMeta = components['schemas']['PageMeta'];

/**
 * 이 화면의 읽기 — 후보 목록과 선택한 건의 상세. 쓰기(`POST /logistics/shipments`)는
 * `mutations.ts`가 갖는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ShipmentProcessingCandidateFilters {
  /** null이면 아직 조회 조건이 갖춰지지 않았다(출하일 시작 필수 — 공유계약 L-3). */
  shipDateFrom: string | null;
  shipDateTo: string | null;
  page: number;
}

export interface ShipmentProcessingCandidatesResult {
  items: ShipmentRequestCandidate[];
  page: PageMeta;
}

export const shipmentProcessingKeys = {
  all: ['shipment-processing'] as const,
  candidates: (filters: ShipmentProcessingCandidateFilters) =>
    [
      'shipment-processing',
      'candidates',
      filters.shipDateFrom,
      filters.shipDateTo,
      filters.page,
    ] as const,
  detail: (shipmentRequestId: number | null) =>
    ['shipment-processing', 'detail', shipmentRequestId] as const,
};

/**
 * 후보 목록. **출하일 시작이 없으면 부르지 않는다**(공유계약 L-3, 계약이 `shipDateFrom`을
 * 필수로 표시). `pickingCompleteOnly`·`shippableRemainderOnly` 쿼리는 baseline에 없어
 * 싣지 않는다 — 클라이언트가 `candidate-gate.ts`로 같은 판정을 재현한다(계획서 미결 항목).
 */
export const useShipmentRequestCandidates = (
  filters: ShipmentProcessingCandidateFilters,
): UseQueryResult<ShipmentProcessingCandidatesResult> => {
  const { client } = useApiClient();
  const shipDateFrom = filters.shipDateFrom;

  return useQuery({
    queryKey: shipmentProcessingKeys.candidates(filters),
    enabled: shipDateFrom !== null,
    queryFn: async () => {
      if (shipDateFrom === null) {
        throw new Error('출하일 시작 없이는 후보 목록을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/shipment-requests', {
          params: {
            query: {
              shipDateFrom,
              ...(filters.shipDateTo === null ? {} : { shipDateTo: filters.shipDateTo }),
              page: filters.page,
            },
          },
        }),
      );

      return { items: data.items.map(toShipmentRequestCandidate), page: data.page };
    },
  });
};

/** 상세 — 라인을 함께 내린다. 목록 응답의 라인은 참고용일 뿐, 제출 payload는 이 상세를 정본으로 쓴다. */
export const useShipmentRequestDetail = (
  shipmentRequestId: number | null,
): UseQueryResult<ShipmentRequestCandidate> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: shipmentProcessingKeys.detail(shipmentRequestId),
    enabled: shipmentRequestId !== null,
    queryFn: async () => {
      if (shipmentRequestId === null) {
        throw new Error('출하작업지시를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return toShipmentRequestCandidate(
        await runRequest(() =>
          client.GET('/logistics/shipment-requests/{shipmentRequestId}', {
            params: { path: { shipmentRequestId } },
          }),
        ),
      );
    },
  });
};
