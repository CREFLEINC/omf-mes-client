import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toPartnerListQuery } from './filters';
import type { PartnerRoleRow } from './partner-role-draft';
import type { PageMeta, Partner, PartnerFilters } from './types';

/**
 * 거래처의 조회와 캐시 키.
 *
 * ⚠ **거래처 단건 조회가 계약에 생겼다**(#173 — `GET /mdm/partners/{partnerId}`).
 * **아직 쓰지 않는다.** 기본 정보는 여전히 **지금 목록에 있는 행**에서 오며, 그래서 목록 밖
 * 거래처를 주소로 가리키면 채울 자료가 없다 — 그 한계가 남아 있다. 출처를 바꾸는 것은
 * 관찰 가능한 동작 변경이라 별도 회차의 일이고, 급하지 않다는 것도 #173이 함께 적었다.
 * 옮길 때 고칠 자리는 여기와 `screen.tsx`의 `selectedPartner` 두 곳이다.
 *
 * ⚠ **역할 치환에 `If-Match`가 필수가 됐다**(계약 재동기화 #173). 그런데 `/mdm/partners*`의
 * 어느 응답도 `ETag`를 선언하지 않아 **토큰을 얻을 자리가 없다** — 대조로, 창고·위치·계정 같은
 * 다른 자원은 상세 GET·PUT 200에 `ETag`를 선언한다. 질문이 **#174**로 올라가 있고 답변을
 * 기다린다. 그동안 아래 `partnerRolesPath`가 토큰을 찾을 자리를 가리키며, 토큰이 없으면 공통
 * 훅이 요청을 만들지 않고 안내를 세운다 — **토큰을 지어내지 않는다.** 서버가 `ETag`를 주기
 * 시작하면 코드 변경 없이 저장이 살아난다.
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
 * 잠금 토큰을 꺼내는 자리 — **늘 역할 목록 경로다.**
 *
 * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
 * 치환(`PUT`)이 요구하는 `If-Match`의 짝은 같은 자원의 `GET`이며, 거래처 본체 경로로 꺼내면
 * 언제나 비어 있다.
 *
 * ⚠ **지금은 이 경로도 비어 있다** — 계약이 이 자원의 어느 응답에도 `ETag`를 선언하지 않았다
 * (#174 답변 대기). 그동안 저장은 요청을 만들지 못하고 안내에서 멈춘다. 빈 토큰을 지어내
 * 보내는 것은 계약 위반이라 하지 않는다.
 */
export const partnerRolesPath = (partnerId: number): string =>
  `/mdm/partners/${String(partnerId)}/roles`;

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
 *
 * **계약보다 넓은 타입으로 낸다**(`PartnerRoleRow` — 결정 D-4). 계약은 역할 코드를 다섯으로
 * 좁혔지만 계약은 구현보다 앞서며, 서버가 다섯 밖의 값을 아직 들고 있을 수 있다. 좁게 받으면
 * 그 값이 타입상 없는 것이 되어 화면에서 사라지고, 통째 교체 저장에서 조용히 해제된다.
 */
export const usePartnerRoles = (partnerId: number | null): UseQueryResult<PartnerRoleRow[]> => {
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
