import { Button, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { ManagedTable } from '../../patterns/managed-table';
import { PageNav, type PageNavMeta, type PageSize } from '../../patterns/page-nav';
import { approvalTypeLabelOf, requestStatusLabelOf } from './code-options';
import type { PageView } from './pagination';
import type { RequestRow } from './types';

const t = messages.approvalInbox;

/**
 * 표의 열 폭.
 *
 * **흡수 열은 사유 하나뿐이고 나머지 다섯은 폭을 지정한다.** 흡수 열이 둘이면 좁은 화면에서
 * 둘 다 짓눌린다. 지정 폭의 합은 **690px**이고(요청번호 170px · #361), 사유에 **238px**을 예산으로 잡으면 합이
 * `.wide-table`의 최소 폭(58rem = 928px)에 딱 맞는다 — 앞선 화면들이 쓴 방법과 같다
 * (흡수 열에도 예산을 주고 그 합으로 하한을 맞춘다).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 요청번호 | 170px | `SYNTH-REQ-001` 형식 한 줄 |
 * | 승인 유형 | 160px | 코드 문자열 그대로. 밑줄 낀 긴 코드가 한 줄에 들어가는 폭 |
 * | 상신자 | 96px | 사람 이름 |
 * | **상신 일시** | **160px** | `2026-08-06 09:12` 한 줄. **일시 열의 저장소 전례 값 그대로다** |
 * | 상태 | 104px | 코드 문자열 그대로 |
 * | **사유 첫 줄** | **미지정(예산 238px)** | 남는 폭을 흡수하는 유일한 열 |
 *
 * **열 여섯은 설계 스펙이 확정한 필드 목록 그대로다.** 대상 표시명을 여기 두지 않는다 —
 * 대상은 상세 구획 소관이다. 진행 단계도 두지 않는다. 값 목록이 확정돼 유형이 사람이 읽는
 * 이름이 되면 라벨만 바뀌고 열 구성은 그대로다.
 */
export const REQUEST_COLUMN_WIDTH = {
  approvalRequestNo: '170px',
  approvalTypeCode: '160px',
  requester: '96px',
  requestedAt: '160px',
  status: '104px',
} as const;

/** 흡수 열(사유)의 예산. 지정 폭 합과 더해 최소 폭에 맞춘다 — 이 값이 곧 그 열의 하한이다. */
export const REASON_COLUMN_BUDGET_PX = 238;

/** `.wide-table`이 주는 표 최소 폭(58rem). 배치 규범 문서가 근거를 갖는다. */
export const WIDE_TABLE_MIN_WIDTH_PX = 928;

export interface RequestListPaneProps {
  rows: RequestRow[];
  isLoading: boolean;
  pageView: PageView;
  /** 목록 아래 쪽 이동 줄(공용 `PageNav`)이 읽는 쪽 정보 — 서버 응답의 `page` 그대로다. */
  pageMeta: PageNavMeta;
  onChangePage: (page: number) => void;
  onChangeSize: (size: PageSize) => void;
  selectedRequestId: number | null;
  onSelect: (approvalRequestId: number) => void;
  /**
   * 조회 실패 표시. 비어 있지 않으면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「승인 요청이 없습니다」로 보이면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   */
  loadError: ReactNode;
}

/**
 * 요청 목록 — 결재할 것을 찾아 고르는 자리.
 *
 * **열은 여섯이다**(요청번호·승인 유형·상신자·상신일·상태·사유 첫 줄). 계약이 이 리소스의
 * 업무 값을 **사유 하나**로 두었고 수량·금액 컬럼이 아예 없어, 사유의 첫 줄이 곧 요약 자리다 —
 * 별도의 요약 열을 만들지 않는다(`omf-mes#87`).
 *
 * **필드 목록은 설계가 확정한 것이고 화면이 바꾸지 않는다.** 대상 표시명·진행 단계는 응답에
 * 실려 오지만 이 표의 값이 아니다 — 대상과 결재 진행은 상세 구획 소관이다.
 *
 * **정렬 가능한 열도 선택 열도 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없고
 * 일괄로 할 쓰기가 없다 — 눌러도 아무 일이 없는 칸이 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RequestListPane = ({
  rows,
  isLoading,
  pageView,
  pageMeta,
  onChangePage,
  onChangeSize,
  selectedRequestId,
  onSelect,
  loadError,
}: RequestListPaneProps) => {
  const columns: Column<RequestRow>[] = [
    {
      key: 'approvalRequestNo',
      header: t.fields.approvalRequestNo,
      width: REQUEST_COLUMN_WIDTH.approvalRequestNo,
      /* 요청번호는 글자만 — 줄 아무 곳이나 눌러 고르고, 고른 줄을 한 번 더 누르면 푼다(#361). */
      render: (row) => (
        <span data-selected={row.approvalRequestId === selectedRequestId ? 'true' : undefined}>
          {row.approvalRequestNo}
        </span>
      ),
    },
    {
      key: 'approvalTypeCode',
      header: t.fields.approvalTypeCode,
      width: REQUEST_COLUMN_WIDTH.approvalTypeCode,
      render: (row) => approvalTypeLabelOf(row.approvalTypeCode),
    },
    {
      key: 'requester',
      header: t.fields.requestedByName,
      width: REQUEST_COLUMN_WIDTH.requester,
      render: (row) => row.requesterName,
    },
    {
      key: 'requestedAt',
      header: t.fields.requestedAt,
      width: REQUEST_COLUMN_WIDTH.requestedAt,
      /* **시각까지 낸다** — 같은 날 올라온 요청들의 앞뒤가 결재 차례를 읽는 단서다. */
      render: (row) => row.requestedAtText,
    },
    {
      key: 'status',
      header: t.fields.status,
      width: REQUEST_COLUMN_WIDTH.status,
      render: (row) => requestStatusLabelOf(row.statusCode),
    },
    {
      key: 'reason',
      header: t.fields.reason,
      /* 남는 폭을 흡수하는 유일한 열. 예산은 `REASON_COLUMN_BUDGET_PX`가 갖는다. */
      render: (row) => row.reasonFirstLine,
    },
  ];

  /**
   * 빈 상태는 두 갈래다 — 사용자가 할 조치가 다르다.
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다(주소 조작·조건 변경으로 생긴다).
   * ② 결과 없음: 조건을 줄이거나 다른 탭에서 다시 조회하면 나올 수 있다.
   *
   * ①을 먼저 본다. 범위 밖은 `total > 0`일 때만 참이라 ②와 겹치지 않는다.
   * (셋째 갈래 「요청 안 고름」은 이 표가 아니라 아래 구획이 맡는다.)
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

  /** 조회 실패 → 로딩 → 표 차례로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
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
      {/*
       * 여섯 열의 폭 예산이 최소 928px이라 좁은 화면에서는 짓누르는 대신 가로로 넘긴다
       * (배치 규범 문서의 `.wide-table`). 넘침이 곧 가로 스크롤이 되는 상자는 디자인 시스템
       * `Table`이 이미 갖고 있다 — 우리가 만들지 않는다.
       */}
      {/* 0건이면 표 최소 폭을 풀어 빈 안내가 잘리지 않게 한다(#361). */}
      {/* 열 폭 끌기 · 순서 바꾸기(#361) — 다른 목록과 같은 공용 표. */}
      <ManagedTable
        storageKey="omf-mes:approval-inbox:list"
        scrollX
        className={
          rows.length === 0
            ? 'approval-inbox-table approval-inbox-table-empty'
            : 'approval-inbox-table'
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.approvalRequestId)}
        caption={t.panes.list}
        onRowClick={(row) => {
          onSelect(row.approvalRequestId);
        }}
        /* 0건을 바깥에서 가르지 않는다 — 가르면 표의 빈 자리가 닿을 수 없는 가지가 된다. */
        empty={emptySlot}
      />
      {/* 0건이면 쪽 이동 줄을 내지 않는다 — 넘길 쪽이 없다(#361). */}
      {pageMeta.total > 0 && (
        <PageNav
          buttonSize="md"
          meta={pageMeta}
          onChangePage={onChangePage}
          onChangeSize={onChangeSize}
        />
      )}
    </>
  );
};
