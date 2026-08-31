import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type ItemBuItemMapListResponse = components['schemas']['ItemBuItemMapListResponse'];
type ItemUomConversionListResponse = components['schemas']['ItemUomConversionListResponse'];
type ItemExternalCodeListResponse = components['schemas']['ItemExternalCodeListResponse'];

/**
 * 부속 행 세 종류의 조회와 캐시 키.
 *
 * ## 낙관적 잠금 — **셋 다 `If-Match`가 필수다**(client#602 · §5.3 표 2~4행 갱신)
 *
 * | 쓰기 | `Idempotency-Key` | `If-Match` | `etagPath` |
 * | --- | :-: | :-: | --- |
 * | `PUT …/bu-item-maps` | 필수 | **필수** | `buMapsPath(itemId)` |
 * | `PUT …/uom-conversions` | 필수 | **필수** | `uomConversionsPath(itemId)` |
 * | `PUT …/external-codes` | 필수 | **필수** | `externalCodesPath(itemId)` |
 *
 * ⭐ **client#602 — 이 세 목록 조회의 `GET` 200 응답에 `ETag`가 새로 생겼다.** 예전에는
 * 계약에 `If-Match` 파라미터 자체가 없고 목록 조회도 토큰을 주지 않아 셋 다 `etagPath: null`
 * 이었다 — 지금은 각 목록 조회 자체가 토큰을 준다. 헤더 없이 보내면 400, 남이 먼저 고쳤으면
 * 409다.
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
  externalCodes: (itemId: number) => ['item-extended-attrs-external-codes', itemId] as const,
};

/**
 * 부속 목록 세 종류의 조회 경로. 각 `PUT` 저장의 `etagPath`가 이 문자열과 정확히 같아야
 * `useMasterWrite`가 이 조회로 잡힌 토큰을 찾는다(client#602).
 */
export const buMapsPath = (itemId: number): string => `/mdm/items/${String(itemId)}/bu-item-maps`;
export const uomConversionsPath = (itemId: number): string =>
  `/mdm/items/${String(itemId)}/uom-conversions`;
export const externalCodesPath = (itemId: number): string =>
  `/mdm/items/${String(itemId)}/external-codes`;

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

/**
 * 외부 코드 목록. 사업부 매핑·단위 환산과 **같은 조건에서 켜고 끈다** —
 * 세 부속 자원은 함께 살아야 한다(§5.4).
 */
export const useExternalCodes = (
  itemId: number | null,
  enabled: boolean,
): UseQueryResult<ItemExternalCodeListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: subsidiaryKeys.externalCodes(itemId ?? 0),
    enabled: enabled && itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 외부 코드를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/items/{itemId}/external-codes', { params: { path: { itemId } } }),
      );
    },
  });
};
