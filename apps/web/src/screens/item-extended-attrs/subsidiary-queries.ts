import type { components, ItemResourceMap } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type ItemUomConversionListResponse = components['schemas']['ItemUomConversionListResponse'];

/**
 * 부속 정보(단위 환산 · 설비·금형)의 조회와 캐시 키. 사업부 매핑 · 외부 코드는 쓰는 기능이 없어
 * 화면에서 뺐다(사용자 지시 2026-11-24) — 서버 경로는 남아 있다.
 *
 * ## 낙관적 잠금 — 단위 환산 저장은 `If-Match`가 필수다(client#602 · §5.3)
 *
 * | 쓰기 | `Idempotency-Key` | `If-Match` | `etagPath` |
 * | --- | :-: | :-: | --- |
 * | `PUT …/uom-conversions` | 필수 | **필수** | `uomConversionsPath(itemId)` |
 *
 * ⭐ **client#602 — 목록 조회의 `GET` 200 응답에 `ETag`가 있다.** 헤더 없이 보내면 400, 남이 먼저
 * 고쳤으면 409다.
 *
 * **쪽 나눔이 없다**(`items`만 오고 `page`가 없다). 계약이 「한 번에 다 받을 수 있는 양」으로
 * 본다는 뜻이라 쪽 이동을 두지 않는다.
 */

/**
 * 부속 자원의 캐시 키.
 *
 * 자원마다 나눠 둔다 — 하나를 저장했을 때 다른 것까지 다시 받을 이유가 없다.
 */
export const subsidiaryKeys = {
  uomConversions: (itemId: number) => ['item-extended-attrs-uom-conversions', itemId] as const,
  itemResourceMaps: (itemId: number, plantId: number) =>
    ['item-extended-attrs-item-resource-maps', itemId, plantId] as const,
  /** 무효화용 앞부분 — 공장을 바꿔 가며 본 목록까지 함께 낡는다. */
  itemResourceMapsOfItem: (itemId: number) =>
    ['item-extended-attrs-item-resource-maps', itemId] as const,
};

/**
 * 단위 환산 목록의 조회 경로. `PUT` 저장의 `etagPath`가 이 문자열과 정확히 같아야
 * `useMasterWrite`가 이 조회로 잡힌 토큰을 찾는다(client#602).
 */
export const uomConversionsPath = (itemId: number): string =>
  `/mdm/items/${String(itemId)}/uom-conversions`;

/**
 * 단위 환산 목록.
 *
 * **품목을 고르기 전에는 조회하지 않는다.** 계약이 경로에 `itemId`를 요구하므로
 * `enabled` 없이 부르면 `0`을 실은 요청이 나간다(M11). 부속 정보 탭에 들어왔을 때 켠다 — 하위 탭마다
 * 켜면 하위 탭을 옮길 때마다 새로 받아 편집 중이던 초안이 서버 응답으로 되감길 여지가 생긴다(§5.4).
 */
export const useUomConversions = (
  itemId: number | null,
  enabled: boolean,
): UseQueryResult<ItemUomConversionListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: subsidiaryKeys.uomConversions(itemId ?? 0),
    enabled: enabled && itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 단위 환산을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/items/{itemId}/uom-conversions', { params: { path: { itemId } } }),
      );
    },
  });
};

/**
 * 설비·금형 매핑 목록.
 *
 * **사용 중지한 줄도 받는다.** 유일 제약이 사용 중지한 줄까지 세므로, 감추면 같은 조합을 다시
 * 등록하려다 이유를 모른 채 막힌다 — 그 줄을 「다시 사용」으로 되살리는 것이 정상 경로다.
 *
 * 다른 부속 자원과 달리 **이 하위 탭을 볼 때만** 켠다. 줄마다 바로 저장해 되감길 초안이 없다.
 * 줄마다 `versionNo`가 와서 `If-Match`를 목록에서 바로 만든다 — 응답에 `ETag`가 없다.
 */
export const useItemResourceMaps = (
  itemId: number | null,
  plantId: number | null,
  enabled: boolean,
): UseQueryResult<{ items: ItemResourceMap[] }> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: subsidiaryKeys.itemResourceMaps(itemId ?? 0, plantId ?? 0),
    enabled: enabled && itemId !== null && plantId !== null,
    queryFn: () => {
      if (itemId === null || plantId === null) {
        throw new Error('품목과 공장을 고르기 전에는 설비·금형 매핑을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/item-resource-maps', {
          params: { query: { itemId, plantId, includeInactive: true } },
        }),
      );
    },
  });
};
