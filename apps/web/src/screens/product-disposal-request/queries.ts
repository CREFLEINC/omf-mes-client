import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { DISPOSAL_APPROVAL_TYPE_CODE, DISPOSAL_PARTNER_ROLE } from './codes';
import {
  toDisposalPartner,
  toDisposalTarget,
  type DisposalPartner,
  type DisposalTarget,
} from './types';

type PageMeta = components['schemas']['PageMeta'];

/**
 * 이 화면의 읽기. 쓰기는 `mutations.ts`가 갖는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const PAGE_SIZE = 50;

export const disposalRequestKeys = {
  all: ['product-disposal-request'] as const,
  targets: (page: number) => ['product-disposal-request', 'targets', page] as const,
  partners: () => ['product-disposal-request', 'partners'] as const,
  route: () => ['product-disposal-request', 'route'] as const,
};

export interface TargetListResult {
  items: DisposalTarget[];
  page: PageMeta;
}

/**
 * ① 폐기 대상 — **후속 처리가 남은 처분 결정.**
 *
 * ⭐ **계약이 이 축을 이 화면의 진입 목록으로 지목했다** — 「후속 처리가 남은 결정만. ⭐
 * W-04-10(폐기 요청)·W-04-11의 진입 목록이 이 오퍼레이션이다 — **처리한 건이 계속 남으면 같은
 * 건을 두 번 처리한다**」.
 *
 * ⚠ **「폐기만」으로 좁히지 못한다.** 처분 유형의 코드 값이 아직 확정되지 않아(G-2) 그 축을
 * 실을 수 없다. ⛔ **응답을 화면이 거르지도 않는다** — 목록이 쪽 단위라 「이 쪽에서 걸러낸 것」이
 * 되고 총 건수와 어긋난다(L-11). 대신 **처분을 열로 보여 사람이 가리게 하고** 그 사실을 적는다.
 */
export const useDisposalTargets = (page: number): UseQueryResult<TargetListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: disposalRequestKeys.targets(page),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/quality/disposition-decisions', {
          params: { query: { followUpPending: true, page, size: PAGE_SIZE } },
        }),
      );

      return { items: data.items.map(toDisposalTarget), page: data.page };
    },
  });
};

/**
 * 폐기 거래처 — **계약이 역할을 좁혀 두었다**(`roleTypeCode=DISPOSAL`).
 *
 * ⭐ 계약 주석이 이 화면을 이름으로 지목한다 — 「폐기 출고 화면이 폐기처리 거래처만 고를 때
 * 쓴다(W-01-06 · **W-04-10** · DR-013)」. 자리표시를 기다리는 공통코드가 아니라 **조회로 오는
 * 마스터**라, 비어 있어도 자체 폐기로는 출고할 수 있다(§6).
 */
export const useDisposalPartners = (): UseQueryResult<DisposalPartner[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: disposalRequestKeys.partners(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/partners', {
          params: { query: { roleTypeCode: DISPOSAL_PARTNER_ROLE, page: 1, size: PAGE_SIZE } },
        }),
      );

      return data.items.map(toDisposalPartner);
    },
  });
};

export type RouteState =
  | { kind: 'pending' }
  | { kind: 'unavailable' }
  | { kind: 'missing' }
  | { kind: 'failed' }
  | { kind: 'found' };

/**
 * 결재선 확인 — **상신할 곳이 있는가.**
 *
 * ⛔ 승인 유형 코드가 아직 없어(G-2) **조회 자체를 열지 않는다.** 빈 값으로 부르면 서버가
 * 400을 돌려주고 화면은 「결재선이 없다」와 「물어보지 못했다」를 구분하지 못하게 된다 —
 * 사용자가 결재선 관리에 가서 없는 문제를 찾는다.
 */
export const useApprovalRoute = (): RouteState => {
  const { client } = useApiClient();
  const isAskable = DISPOSAL_APPROVAL_TYPE_CODE !== '';

  const query = useQuery({
    queryKey: disposalRequestKeys.route(),
    enabled: isAskable,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-routes', {
          params: { query: { approvalTypeCode: DISPOSAL_APPROVAL_TYPE_CODE } },
        }),
      ),
  });

  if (!isAskable) return { kind: 'unavailable' };
  if (query.isPending) return { kind: 'pending' };
  if (query.isError) return { kind: 'failed' };

  const [route] = query.data?.items ?? [];
  /* ⚠ 단계 수는 목록 응답에 없다 — 「몇 단계인가」를 지어내지 않고 «있다»까지만 말한다. */
  return route === undefined ? { kind: 'missing' } : { kind: 'found' };
};
