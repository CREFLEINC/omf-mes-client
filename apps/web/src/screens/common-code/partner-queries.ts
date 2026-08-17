import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import { toPartnerListQuery } from './filters';
import type { PartnerRoleRow } from './partner-role-draft';
import type { PageMeta, Partner, PartnerFilters } from './types';

/**
 * 거래처의 조회와 캐시 키.
 *
 * **기본 정보는 단건 조회에서 온다**(#173 — `GET /mdm/partners/{partnerId}`). 목록 행에 매여
 * 있던 동안에는 조건을 바꾸거나 쪽을 옮기면 보고 있던 거래처가 목록에서 사라져 채울 자료가
 * 없었고, 주소로 바로 들어온 사용자도 같은 벽을 만났다 — 이 조회는 조건과 무관하다.
 *
 * ⚠ **역할 치환에 `If-Match`가 필수다**(계약 재동기화 #173). 그 잠금 토큰의 **원천은 역할 목록
 * 조회**로 확정됐고(#174) 계약이 그 응답에 `ETag`를 선언한다 — 아래 `partnerRolesPath`가 그
 * 자리다.
 *
 * ⛔ **거래처 본체 쪽이 아니다.** 단건 조회가 생겼으니 그쪽이 자연스러워 보이지만, 본체는
 * 외부에서 받아 오는 자료라 **동기화마다 버전이 바뀐다** — 역할을 고치지 않은 사용자까지 저장
 * 충돌을 보게 된다. 잠그는 대상(역할 집합)과 버전 축을 일치시킨다.
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
  detail: (partnerId: number) => ['common-code-partners', 'detail', partnerId] as const,
  roles: (partnerId: number) => ['common-code-partners', 'roles', partnerId] as const,
};

/**
 * 잠금 토큰을 꺼내는 자리 — **늘 역할 목록 경로다.**
 *
 * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
 * 치환(`PUT`)이 요구하는 `If-Match`의 짝은 같은 자원의 `GET`이며, 거래처 본체 경로로 꺼내면
 * 언제나 비어 있다.
 *
 * ⚠ **계약은 선언했지만 서버 구현이 오기 전에는 이 자리가 비어 있을 수 있다.** 그동안 저장은
 * 요청을 만들지 못하고 안내에서 멈춘다. 빈 토큰을 지어내 보내는 것은 계약 위반이라 하지 않는다.
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
 * 고른 거래처의 기본 정보 — **목록이 아니라 단건 조회에서 온다**(#173).
 *
 * ⛔ **목록 행으로 미리 채우지 않는다**(`initialData`를 두지 않는다). 채우면 기본 정보의
 * 정본이 둘이 되어, 목록 행이 낡았을 때 낡은 값을 조용히 보인다 — 이번에 없애는 매임의
 * 재생산이다. 대가는 고른 직후의 진행 안내 한 번이다.
 *
 * ⛔ **여기서 잠금 토큰을 꺼내지 않는다.** 계약이 이 응답에 `ETag`를 선언하지 않으며, 역할
 * 치환의 토큰 원천은 역할 목록 조회다(위 `partnerRolesPath`).
 *
 * **축이 둘이다** — 고른 거래처가 있는가(`partnerId`)와 지금 그 탭에 있는가(`enabled`).
 * 선택 키는 탭이 공유하지 않지만, 탭 경계를 호출부에서 한 번 더 드러내 두면 선택을 읽는 자리가
 * 느슨해져도 다른 탭에서 조회가 새지 않는다.
 */
export const usePartnerDetail = (
  partnerId: number | null,
  enabled: boolean,
): UseQueryResult<Partner> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: partnerKeys.detail(partnerId ?? 0),
    enabled: enabled && partnerId !== null,
    queryFn: () => {
      if (partnerId === null) {
        throw new Error('거래처를 고르기 전에는 기본 정보를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/partners/{partnerId}', { params: { path: { partnerId } } }),
      );
    },
  });
};

/**
 * 없는 거래처인가 — **다른 조회 실패와 갈라야 하는 이유는 사용자가 할 조치가 다르기 때문이다.**
 * 없는 거래처는 다시 시도해도 나타나지 않으므로 「다시 시도」가 아니라 다시 고르기로 안내한다.
 *
 * **이 오퍼레이션의 계약 응답은 200과 404 둘뿐이다**(실측). 그래도 다른 갈래를 남겨 둔다 —
 * 네트워크 끊김과 게이트웨이 오류는 계약에 적히지 않는다.
 */
export const isPartnerNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
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
