import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type ItemBuItemMapListResponse = components['schemas']['ItemBuItemMapListResponse'];
type ItemUomConversionListResponse = components['schemas']['ItemUomConversionListResponse'];

/**
 * 부속 행 세 종류의 조회와 캐시 키.
 *
 * ## 낙관적 잠금 — **셋 다 `etagPath`가 `null`이다**(§5.3 표 2~4행)
 *
 * | 쓰기 | `Idempotency-Key` | `If-Match` | `etagPath` |
 * | --- | :-: | :-: | --- |
 * | `PUT …/bu-item-maps` | 필수 | **없음** | **`null`** |
 * | `PUT …/uom-conversions` | 필수 | **없음** | **`null`** |
 * | `PUT …/external-codes` | 필수 | **없음** | **`null`** |
 *
 * 계약에 이 쓰기들의 `If-Match` 파라미터 자체가 없고, **목록 조회가 `ETag`를 주지도 않는다.**
 * 그 자리에 상세 경로를 주면 토큰을 찾지 못해 `useMasterWrite`가 **요청을 보내지 않고 멈춘다** —
 * 「저장을 눌러도 아무 일이 없다」가 된다(M17).
 *
 * **쪽 나눔이 없다**(`items`만 오고 `page`가 없다). 계약이 「한 번에 다 받을 수 있는 양」으로
 * 본다는 뜻이라 쪽 이동을 두지 않는다.
 */

/**
 * 부속 자원의 캐시 키.
 *
 * 자원마다 나눠 둔다 — 하나를 저장했을 때 나머지 둘까지 다시 받을 이유가 없고,
 * 함께 무효화하면 편집 중이던 다른 초안이 서버 응답으로 되감긴다.
 */
export const subsidiaryKeys = {
  buMaps: (itemId: number) => ['item-extended-attrs-bu-maps', itemId] as const,
  uomConversions: (itemId: number) => ['item-extended-attrs-uom-conversions', itemId] as const,
};

/**
 * 사업부 매핑 목록.
 *
 * **품목을 고르기 전에는 조회하지 않는다.** 계약이 경로에 `itemId`를 요구하므로
 * `enabled` 없이 부르면 `0`을 실은 요청이 나간다(M11).
 *
 * 부속 정보 탭에 들어왔을 때 켠다 — 하위 탭마다 켜면 하위 탭을 옮길 때마다 새로 받아
 * 편집 중이던 초안이 서버 응답으로 되감길 여지가 생긴다(§5.4 「세 초안은 함께 산다」).
 */
export const useBuMaps = (
  itemId: number | null,
  enabled: boolean,
): UseQueryResult<ItemBuItemMapListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: subsidiaryKeys.buMaps(itemId ?? 0),
    enabled: enabled && itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 사업부 매핑을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/items/{itemId}/bu-item-maps', { params: { path: { itemId } } }),
      );
    },
  });
};

/**
 * 단위 환산 목록. 사업부 매핑과 **같은 조건에서 켜고 끈다** —
 * 세 부속 자원은 함께 살아야 하고(§5.4), 하위 탭마다 켜면 옮길 때마다 새로 받는다.
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
