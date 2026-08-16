import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toPartnerListQuery } from './filters';
import type { PageMeta, Partner, PartnerFilters, PartnerRole } from './types';

/**
 * 거래처의 조회와 캐시 키.
 *
 * **거래처 상세 경로가 계약에 없다** — `GET /mdm/partners`(목록)와
 * `GET /mdm/partners/{partnerId}/roles`(역할) 둘뿐이다. 그래서 기본 정보는 **지금 목록에 있는
 * 행**에서 오며, 목록 밖 거래처를 주소로 가리켜도 상세를 조회할 방법이 없다.
 *
 * **`etagPath`를 만드는 함수를 두지 않는다.** 이 자원의 쓰기(역할 통째 교체)에 `If-Match`가
 * 없고 응답에 `ETag`도 없다(계약 실측) — 상세 경로를 주면 토큰을 찾지 못해 요청이
 * **나가지 않고 멈춘다**(「저장을 눌러도 아무 일이 없다」).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface PartnerListResponse {
  items: Partner[];
  page: PageMeta;
}

/**
 * 거래처의 캐시 키.
 *
 * **뿌리 하나를 통째로 무효화하는 열쇠를 두지 않는다.** 이 화면의 쓰기는 역할 치환 하나뿐이고
 * 그것으로 거래처 본체는 바뀌지 않는다 — 목록까지 무효화하면 아무것도 달라지지 않을 조회를
 * 다시 낸다. 필요해지는 회차에 그 소비처와 함께 만든다.
 */
export const partnerKeys = {
  list: (filters: PartnerFilters, page: number) =>
    ['common-code-partners', 'list', filters, page] as const,
  roles: (partnerId: number) => ['common-code-partners', 'roles', partnerId] as const,
};

/**
 * 거래처 목록. 조건은 서버로 보낸다.
 *
 * **역할로 좁히지 않는다** — 쿼리 구성 규칙은 `filters.ts`의 `toPartnerListQuery`가 갖는다.
 */
export const usePartnerList = (
  filters: PartnerFilters,
  page: number,
  enabled: boolean,
): UseQueryResult<PartnerListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: partnerKeys.list(filters, page),
    /*
     * 다른 탭에 있는 동안에는 조회하지 않는다. 주소 키(`q`·`inactive`·`page`)를 탭이
     * 공유하므로 손으로 고친 주소에서 「부서를 찾던 말」로 거래처를 조회하는 일이 생긴다.
     */
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', { params: { query: toPartnerListQuery(filters, page) } }),
      ),
  });
};

/**
 * 고른 거래처의 역할 전부. **쪽 나눔이 없다**(배열만 온다 — 계약 실측).
 * 그래서 역할 구획에 쪽 이동을 두지 않는다.
 */
export const usePartnerRoles = (partnerId: number | null): UseQueryResult<PartnerRole[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: partnerKeys.roles(partnerId ?? 0),
    enabled: partnerId !== null,
    queryFn: () => {
      if (partnerId === null) {
        throw new Error('거래처를 고르기 전에는 역할을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/partners/{partnerId}/roles', { params: { path: { partnerId } } }),
      );
    },
  });
};
