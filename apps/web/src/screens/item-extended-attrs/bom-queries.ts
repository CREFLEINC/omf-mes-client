import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type BomListResponse = components['schemas']['BomListResponse'];

/**
 * 자재 명세서(BOM)의 조회와 캐시 키.
 *
 * ## 낙관적 잠금 — **이 화면 최대의 함정이 여기 있다**(§5.3 표 5·6행)
 *
 * | 쓰기 | `Idempotency-Key` | `If-Match` | `etagPath` | 토큰은 어디서 오나 |
 * | --- | :-: | :-: | --- | --- |
 * | `POST …/{bomId}:set-default` | 필수 | **없음** | **`null`** | — |
 * | `PUT …/{bomId}/components/{id}` | 필수 | **필수** | 행 단위 상세 경로 | **행 단위 상세 조회에서만** |
 *
 * **구성품 목록 조회는 `ETag`를 주지 않는다**(계약 실측 L·M). 편집 창을 열 때 행 상세를
 * 먼저 조회해야 보관소에 토큰이 들어간다 — 목록만 받고 저장하면 `useMasterWrite`가
 * 토큰을 찾지 못해 **요청을 보내지 않고 멈춘다.**
 *
 * 반대로 기본 지정에 상세 경로를 주면 같은 증상이 난다. 계약에 그 쓰기의 `If-Match`
 * 파라미터 자체가 없다.
 *
 * ## 쪽 나눔이 없다
 *
 * 헤더 목록도 구성품 목록도 `items`만 오고 `page`가 없다 — 계약이 「품목당 BOM 헤더는 소수」라
 * 적었고 구성품도 같다. 쪽 이동을 두지 않는다.
 */

/**
 * 자재 명세서의 캐시 키.
 *
 * 구성품 목록 키가 **행 상세 키의 앞부분**이다. 목록을 무효화하면 그 자재 명세서의 행 상세도
 * 함께 무효화되므로, 구성품을 저장한 뒤 낡은 잠금 토큰이 남지 않는다.
 *
 * 기본 지정은 **헤더 목록만** 무효화한다 — 구성품은 달라지지 않는데 함께 받으면
 * 표가 이유 없이 다시 그려진다.
 */
export const bomKeys = {
  all: ['item-extended-attrs-boms'] as const,
  list: (parentItemId: number) => ['item-extended-attrs-boms', 'list', parentItemId] as const,
  components: (bomId: number) => ['item-extended-attrs-boms', 'components', bomId] as const,
  component: (bomId: number, bomComponentId: number) =>
    ['item-extended-attrs-boms', 'components', bomId, bomComponentId] as const,
};

/**
 * 품목의 자재 명세서 헤더 목록.
 *
 * **품목을 고르기 전에는 조회하지 않는다.** 계약이 `parentItemId`를 **필수 쿼리**로 두어
 * `enabled` 없이 부르면 서버가 422로 되돌린다(목 실측).
 *
 * **헤더 상세(`GET /planning/boms/{bomId}`)를 따로 부르지 않는다.** 이 응답이 `Bom` 전 필드를
 * 담고 있어 헤더 구획이 쓸 값이 다 있다. 상세가 더 주는 것은 `editability`뿐인데 원본 구획에
 * 쓰기 경로를 두지 않기로 한 이상(결정 1) 읽을 자리가 없다. 더해 **목록에서 고른 헤더를 쓰면
 * 「주소의 번호가 이 품목의 것이 아니다」가 저절로 걸러진다** — 상세를 따로 부르면
 * 다른 품목의 자재 명세서를 그려 버린다.
 */
export const useBomList = (
  parentItemId: number | null,
  enabled: boolean,
): UseQueryResult<BomListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: bomKeys.list(parentItemId ?? 0),
    enabled: enabled && parentItemId !== null,
    queryFn: () => {
      if (parentItemId === null) {
        throw new Error('품목을 고르기 전에는 자재 명세서를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/boms', { params: { query: { parentItemId } } }),
      );
    },
  });
};
