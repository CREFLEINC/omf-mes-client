import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { LayoutView, LocationView } from './types';
import { toLayoutView, toLocationView } from './types';

/**
 * 이 화면의 오퍼레이션 — 배치도 하나, 위치 목록 하나, 쓰기 하나.
 *
 * ⭐ **잠금 토큰은 배치도 조회가 준 것이다.** 바꾸는 자원이 스스로 판 번호를 갖고, 빠진 점이
 * 지워지는 저장이라 「내가 본 배치 위에 적는다」가 반드시 참이어야 한다.
 *
 * ⛔ **도면 파일을 올리는 경로를 부르지 않는다.** 첨부를 어떤 대상 유형으로 붙일지가 아직
 * 정해지지 않았다 — 값을 지어내면 서버가 거부하거나, 더 나쁘게는 엉뚱한 대상에 붙는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type WarehouseLayout = components['schemas']['WarehouseLayout'];
type WarehouseLayoutReplace = components['schemas']['WarehouseLayoutReplace'];

export const LOCATION_PAGE_SIZE = 200;

export const layoutKeys = {
  all: ['warehouse-layout'] as const,
  layout: (warehouseId: number | null) => ['warehouse-layout', 'layout', warehouseId ?? 0] as const,
  locations: (warehouseId: number | null, includeInactive: boolean) =>
    ['warehouse-layout', 'locations', warehouseId ?? 0, includeInactive] as const,
};

/** 배치도 경로 — **저장의 잠금 토큰이 여기 보관된다.** */
export const layoutPath = (warehouseId: number): string =>
  `/mdm/warehouses/${String(warehouseId)}/layout`;

/** 도면 이미지 주소. 화면이 `<img>` 로 그대로 건다. */
export const drawingUrl = (baseUrl: string, attachmentId: number): string =>
  `${baseUrl}/app/attachments/${String(attachmentId)}/content`;

export const useLayout = (warehouseId: number | null): UseQueryResult<LayoutView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: layoutKeys.layout(warehouseId),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) throw new Error('창고를 고르기 전에는 배치도를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/warehouses/{warehouseId}/layout', {
          params: { path: { warehouseId } },
        }),
      ).then(toLayoutView);
    },
  });
};

/**
 * 이 창고의 위치들.
 *
 * ⭐ **한 쪽에 다 담는다.** 창고 하나의 위치는 목록이자 지도의 범례라, 쪽을 나누면 2쪽의
 * 위치를 도면에서 고를 수 없다.
 */
export const useLocations = (
  warehouseId: number | null,
  includeInactive: boolean,
): UseQueryResult<LocationView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: layoutKeys.locations(warehouseId, includeInactive),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) throw new Error('창고를 고르기 전에는 위치를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/locations', {
          params: {
            query: {
              warehouseId,
              ...(includeInactive ? { includeInactive: true } : {}),
              page: 1,
              size: LOCATION_PAGE_SIZE,
            },
          },
        }),
      ).then((data) => data.items.map(toLocationView));
    },
  });
};

/**
 * 배치도 저장 — **도면과 점을 통째로 바꾼다.**
 *
 * ⭐ 멱등 키 수명이 `until-applied` 다. 빠진 점이 지워지고 화면이 되살릴 수 없는 쓰기라,
 * 통신이 끊긴 뒤 다시 눌렀을 때 같은 저장이 두 번 적용되지 않도록 키를 붙들어 둔다.
 */
export const useLayoutReplace = (
  warehouseId: number | null,
  onSuccess: () => void,
): MasterWriteResult<WarehouseLayoutReplace> => {
  const { client } = useApiClient();

  return useMasterWrite<WarehouseLayoutReplace, WarehouseLayout>({
    request: (body, headers) =>
      client.PUT('/mdm/warehouses/{warehouseId}/layout', {
        params: {
          path: { warehouseId: warehouseId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: warehouseId === null ? null : layoutPath(warehouseId),
    invalidateKeys: [layoutKeys.all],
    knownFields: ['markers', 'drawingAttachmentId'],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
