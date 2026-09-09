import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  DISPOSAL_DISPOSITION_TYPE,
  DISPOSAL_PARTNER_ROLE,
  ISSUE_TYPE_OTHER,
  ROUTE_LOOKUP_APPROVAL_TYPE,
} from './codes';
import type { PlacementEntry } from './placement';
import {
  toDisposalPartner,
  toDisposalTarget,
  toIssueRow,
  type DisposalPartner,
  type DisposalTarget,
  type IssueRow,
} from './types';

type PageMeta = components['schemas']['PageMeta'];
type ApprovalRequestDetail = components['schemas']['ApprovalRequestDetail'];

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
  placement: (lotId: number) => ['product-disposal-request', 'placement', lotId] as const,
  history: (page: number) => ['product-disposal-request', 'history', page] as const,
  approval: (id: number) => ['product-disposal-request', 'approval', id] as const,
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
 * ⭐ **「폐기만」으로 좁힌다** — `dispositionTypeCode=SCRAP`(통지 `#674` §3). 한때 이 축의 값이
 * 확정되지 않아 처분을 열로 보여 사람이 가리게 했는데, 계약이 `REWORK`·`SCRAP`·`NORMAL` 셋으로
 * 닫으면서 **서버 축으로 좁혀졌다.**
 *
 * ⛔ **응답을 화면이 거르지 않는다** — 목록이 쪽 단위라 「이 쪽에서 걸러낸 것」이 되고 총 건수와
 * 어긋난다(L-11). 좁히는 일은 **질의가** 한다.
 *
 * ⚠ **두 축을 함께 건다** — `followUpPending` 은 「아직 처리가 남았는가」이고 `dispositionTypeCode`
 * 는 「무엇으로 판정됐는가」다. 앞의 것만 걸면 재작업·정상 판정까지 폐기 목록에 오고, 뒤의 것만
 * 걸면 **이미 폐기한 건이 계속 남아 같은 건을 두 번 처리한다**(계약 주석이 지목한 사고다).
 */
export const useDisposalTargets = (page: number): UseQueryResult<TargetListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: disposalRequestKeys.targets(page),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/quality/disposition-decisions', {
          params: {
            query: {
              dispositionTypeCode: DISPOSAL_DISPOSITION_TYPE,
              followUpPending: true,
              page,
              size: PAGE_SIZE,
            },
          },
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

/**
 * 고른 LOT 들이 **어디에 있는가** — 출고 줄의 `sourceLocationId` 를 푸는 조회.
 *
 * ⭐ **LOT 마다 한 번씩 부른다.** 잔액 조회는 `groupBy` 축 하나만 채워 내리므로, 위치를 받으려면
 * `LOCATION` 으로 묶어야 하고 그러면 LOT 축이 접힌다. 한 번에 여러 LOT 을 물을 수 없다.
 *
 * ⛔ **`enabled` 로 고른 것만 부른다** — 목록 전체를 미리 부르면 고르지도 않은 LOT 의 재고를
 * 쪽마다 훑게 된다. 판정 목록은 쪽 단위라 그 비용이 쪽 수만큼 는다.
 *
 * ⚠ **재고 상태로 좁히지 않는다.** 폐기 대상은 보류·차단된 재고일 가능성이 크다 — 좁히면
 * 폐기해야 할 것이 「자리를 못 찾았다」로 막힌다(`placement.ts` 가 같은 판단을 적어 두었다).
 */
export const useLotPlacements = (
  lotIds: readonly number[],
): Record<number, readonly PlacementEntry[] | undefined> => {
  const { client } = useApiClient();

  const results = useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: disposalRequestKeys.placement(lotId),
      queryFn: async (): Promise<readonly PlacementEntry[]> => {
        const data = await runRequest(() =>
          client.GET('/inventory/balances', {
            params: { query: { lotId, groupBy: 'LOCATION' as const, page: 1, size: PAGE_SIZE } },
          }),
        );

        return data.items.map((item) => ({
          lotId: item.lotId ?? null,
          warehouseId: item.warehouseId ?? null,
          locationId: item.locationId ?? null,
          onHandQty: item.onHandQty,
        }));
      },
    })),
  });

  /*
   * ⭐ **아직 못 받은 것을 `undefined` 로 둔다** — 빈 배열로 두면 「자리가 없다」가 되어
   * 조회 중인 것이 «없는 것»으로 읽힌다. 그 둘은 사용자에게 다른 말이어야 한다.
   */
  const byLot: Record<number, readonly PlacementEntry[] | undefined> = {};

  lotIds.forEach((lotId, index) => {
    const result = results[index];
    byLot[lotId] = result?.isSuccess === true ? result.data : undefined;
  });

  return byLot;
};

/**
 * 「처리 이력」 탭 — **이 화면이 올린 폐기 출고들.**
 *
 * ⛔ **원천 문서 유형으로 좁히지 못한다.** 목록 질의에 그 축이 없다(`5b3d773` 실측 — 상세와
 * 생성 본문에는 있는데 조회 조건에는 없다). 그래서 **기타출고 전체**가 온다: 자재 폐기
 * (`W-01-06`)가 만든 전표도 같은 유형이라 함께 섞인다.
 *
 * ⚠ **화면이 응답을 거르지 않는다**(L-11) — 쪽 단위 목록을 화면에서 거르면 「이 쪽에서 걸러낸
 * 것」이 되고 총 건수와 어긋난다. 대신 **원천을 열로 보이고 섞인다는 사실을 적는다**(A-11).
 * 좁히는 축이 계약에 생기면 그때 질의로 옮긴다.
 */
export const useIssueHistory = (page: number): UseQueryResult<IssueHistoryResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: disposalRequestKeys.history(page),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/goods-issues', {
          params: { query: { issueTypeCode: ISSUE_TYPE_OTHER, page, size: PAGE_SIZE } },
        }),
      );

      return { items: data.items.map(toIssueRow), page: data.page };
    },
  });
};

export interface IssueHistoryResult {
  items: IssueRow[];
  page: PageMeta;
}

/**
 * 고른 전표의 **결재 진행.**
 *
 * ⭐ **전표가 요청 번호를 싣는다**(통지 `#674`) — `approvalRequestId` 로 바로 상세를 부른다.
 * 역조회(`?targetTypeCode=&targetId=`)를 쓰지 않는 이유가 이것이다: 한 번에 닿는 길이 있다.
 *
 * ⛔ **번호가 없으면 부르지 않는다** — 상신하지 않은 전표다. 「결재가 없다」와 「못 물었다」를
 * 가르려면 조회를 아예 열지 않아야 한다.
 */
export const useApprovalDetail = (
  approvalRequestId: number | null,
): UseQueryResult<ApprovalRequestDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: disposalRequestKeys.approval(approvalRequestId ?? 0),
    enabled: approvalRequestId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests/{approvalRequestId}', {
          params: { path: { approvalRequestId: approvalRequestId ?? 0 } },
        }),
      ),
  });
};

/*
 * ⚠ **`unavailable`(물어보지 못했다) 상태를 두지 않는다.** 승인 유형 값이 없어 조회 자체를
 * 막던 시절의 상태였는데, 통지 `#674` 로 축이 닫히며 사라졌다. 도달하지 못하는 갈래를 남겨
 * 두면 **시험이 덮지 못하는 화면 상태**가 생긴다.
 */
export type RouteState =
  { kind: 'pending' } | { kind: 'missing' } | { kind: 'failed' } | { kind: 'found' };

/**
 * 결재선 확인 — **상신할 곳이 있는가.**
 *
 * ⭐ **조회가 열렸다**(통지 `#674`) — 승인 유형이 `enum` 으로 닫히면서 축이 생겼다. 한때 값이
 * 없어 조회 자체를 막아 두었는데, 그 갈래는 이제 없다.
 *
 * ⚠ **이 조회는 「폐기 결재선이 하나라도 있는가」까지만 답한다.** 서버가 실제로 고를 결재선은
 * 전표의 `reasonCode` 와 사업부 축으로 파생하므로(공유계약 G-31), 여기서 「있다」가 나와도
 * 상신이 400(`ROUTE_NOT_FOUND`)일 수 있다. 그 자리는 §6 의 400 처리가 받는다 — **여기서
 * 「승인 요청」 버튼을 여는 근거**로만 쓰고 「상신이 성공한다」로 읽지 않는다.
 */
export const useApprovalRoute = (): RouteState => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: disposalRequestKeys.route(),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-routes', {
          params: { query: { approvalTypeCode: ROUTE_LOOKUP_APPROVAL_TYPE } },
        }),
      ),
  });

  if (query.isPending) return { kind: 'pending' };
  if (query.isError) return { kind: 'failed' };

  const [route] = query.data?.items ?? [];
  /* ⚠ 단계 수는 목록 응답에 없다 — 「몇 단계인가」를 지어내지 않고 «있다»까지만 말한다. */
  return route === undefined ? { kind: 'missing' } : { kind: 'found' };
};
