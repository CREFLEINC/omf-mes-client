import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { RouteView } from './types';

const t = messages.approvalRoute;

/**
 * 좌 칸 표의 열 폭.
 *
 * **흡수 열은 승인 유형 하나뿐이고 나머지 넷은 폭을 지정한다.** 흡수 열이 둘이면 좁은 칸에서
 * 둘 다 짓눌린다. `.wide-table`을 붙이지 않는다 — 그 클래스의 최소 폭(928px)이 좌 칸의
 * 최소 폭(320px)보다 커서 언제나 가로 스크롤이 생긴다. 「폭이 모자라 넘치는 것」과
 * 「폭을 강제해 넘치는 것」은 다른 문제이고 후자는 붙여서 만드는 문제다.
 */
export const ROUTE_COLUMN_WIDTH = {
  businessUnit: '140px',
  stepCount: '64px',
  inProgressCount: '72px',
  status: '96px',
} as const;

export interface RouteListPaneProps {
  routes: RouteView[];
  isLoading: boolean;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedRouteId: number | null;
  onSelect: (approvalRouteId: number) => void;
  /**
   * 사업부 이름. **화면이 풀어 넘긴다** — 표가 참조 조회를 알면 이름을 못 풀었을 때의
   * 네 갈래가 표 안으로 흘러 들어오고, 그러면 번호가 새는 자리도 함께 는다.
   */
  businessUnitLabel: (businessUnitId: number | null) => string;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「결재선이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

/**
 * 좌 칸 — 결재선을 찾아 고르는 자리.
 *
 * **열은 다섯이다**(승인 유형·사업부·단계·진행 중·사용). 단계 수와 진행 중 건수는 계약이
 * 목록 응답에 실어 보내는 파생값이라 행마다 따로 조회하지 않는다.
 *
 * **승인 유형만으로는 줄이 갈리지 않는다.** 같은 유형의 사업부 지정본과 전 사업부 공통본이
 * 함께 설 수 있어(계약이 그것을 다른 결재선으로 본다) 고르기 버튼의 접근 이름에 사업부를 함께 담는다.
 *
 * **정렬 가능한 열도 선택 열도 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없고
 * 일괄로 할 쓰기가 없다 — 눌러도 아무 일이 없는 칸이 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RouteListPane = ({
  routes,
  isLoading,
  pageView,
  onChangePage,
  selectedRouteId,
  onSelect,
  businessUnitLabel,
  loadError,
}: RouteListPaneProps) => {
  const columns: Column<RouteView>[] = [
    {
      key: 'approvalTypeCode',
      header: t.fields.approvalTypeCode,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.selectRow(row.approvalTypeCode, businessUnitLabel(row.businessUnitId))}
          aria-current={row.approvalRouteId === selectedRouteId ? 'true' : undefined}
          onClick={() => {
            onSelect(row.approvalRouteId);
          }}
        >
          {row.approvalTypeCode}
        </button>
      ),
    },
    {
      key: 'businessUnit',
      header: t.fields.businessUnit,
      width: ROUTE_COLUMN_WIDTH.businessUnit,
      render: (row) => businessUnitLabel(row.businessUnitId),
    },
    {
      key: 'stepCount',
      header: t.fields.stepCount,
      width: ROUTE_COLUMN_WIDTH.stepCount,
      align: 'end',
      /* 단계가 0이면 그 유형의 상신이 거부된다 — 수치가 아니라 사실로 읽혀야 한다. */
      render: (row) => (row.stepCount === 0 ? t.values.noSteps : String(row.stepCount)),
    },
    {
      key: 'inProgressCount',
      header: t.fields.inProgressCount,
      width: ROUTE_COLUMN_WIDTH.inProgressCount,
      align: 'end',
      render: (row) => String(row.inProgressCount),
    },
    {
      key: 'status',
      header: t.fields.status,
      width: ROUTE_COLUMN_WIDTH.status,
      /* 비활성 표현을 배지로 그리지 않는다 — 설치본의 배지에는 비활성 변형이 없다. */
      render: (row) => (row.isActive ? t.values.active : t.values.inactive),
    },
  ];

  /**
   * 빈 상태는 두 갈래다 — 사용자가 할 조치가 다르다.
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다(주소 조작·조건 변경으로 생긴다).
   * ② 결과 없음: 조건을 줄이거나 「미사용 포함」을 켜면 나올 수 있다.
   *
   * ①을 먼저 본다. 범위 밖은 `total > 0`일 때만 참이라 ②와 겹치지 않는다.
   */
  const emptySlot: ReactNode = pageView.isBeyondLast ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.beyondLastTitle}
      description={t.empty.beyondLastDescription}
      action={
        <Button
          variant="outlined"
          onClick={() => {
            onChangePage(1);
          }}
        >
          {t.actions.goFirstPage}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.empty.noResultTitle}
      description={t.empty.noResultDescription}
    />
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  if (loadError !== null && loadError !== undefined) return <>{loadError}</>;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.list}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  return (
    <>
      <Table
        density="compact"
        columns={columns}
        rows={routes}
        getRowId={(row) => String(row.approvalRouteId)}
        /* 0건을 바깥에서 가르지 않는다 — 가르면 표의 빈 자리가 닿을 수 없는 가지가 된다. */
        empty={emptySlot}
      />
      <PageNav view={pageView} onChange={onChangePage} />
    </>
  );
};
