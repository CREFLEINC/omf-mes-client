import { AlertBanner, Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { RequestRow } from './types';

const t = messages.iqcSkipApproval;

/**
 * 표의 열 폭.
 *
 * **흡수 열은 사유 하나뿐이고 나머지 다섯은 폭을 지정한다.** 흡수 열이 둘이면 좁은 화면에서
 * 둘 다 짓눌린다. 지정 폭의 합은 **728px**이고, 사유에 **192px**을 예산으로 잡으면 합이
 * `.wide-table`의 최소 폭(58rem = 928px) 안에 든다.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 요청번호 | 132px | `SYNTH-REQ-001` 형식 한 줄 |
 * | 승인 유형 | 152px | 코드 문자열 그대로. **값 미확정이라 더 긴 코드는 접힌다** |
 * | 대상 | 200px | 서버가 만든 표시명. 접혀도 읽힌다 |
 * | **사유 첫 줄** | **미지정(예산 192px)** | 남는 폭을 흡수하는 유일한 열 |
 * | 상신자 | 96px | 사람 이름 |
 * | 상신 일시 | 148px | `2026-08-06 14:20` 한 줄 |
 *
 * **「단계」 열도 「상태」 열도 두지 않는다.** 열을 늘리는 것보다 줄이는 것이 먼저다 —
 * 이름 칸이 이미 둘(대상·사유)이라 여기서 더 늘리면 어느 칸도 읽히지 않는다.
 * 진행은 뒤 회차의 상세가 말한다.
 */
export const REQUEST_COLUMN_WIDTH = {
  approvalRequestNo: '132px',
  approvalTypeCode: '152px',
  target: '200px',
  requester: '96px',
  requestedAt: '148px',
} as const;

/** 흡수 열(사유)의 예산. 지정 폭 합과 더해 최소 폭 안에 든다 — 이 값이 곧 그 열의 하한이다. */
export const REASON_COLUMN_BUDGET_PX = 192;

/** `.wide-table`이 주는 표 최소 폭(58rem). 배치 규범 문서가 근거를 갖는다. */
export const WIDE_TABLE_MIN_WIDTH_PX = 928;

export interface RequestListPaneProps {
  rows: RequestRow[];
  isLoading: boolean;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedRequestId: number | null;
  onSelect: (approvalRequestId: number) => void;
  /**
   * 승인 유형 코드가 확정되기 전까지 서는 안내. **화면이 넘긴다** — 부품이 자리표시 상수를
   * 직접 읽으면 「값이 오면 안내가 사라진다」는 전환을 화면 수준에서 잴 수 없다.
   */
  typeNote?: string;
  /**
   * 조회 실패 표시. 비어 있지 않으면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「승인 요청이 없습니다」로 보이면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   */
  loadError: ReactNode;
}

/**
 * 요청 목록 — 판정할 것을 찾아 고르는 자리.
 *
 * **열은 여섯이다**(요청번호·승인 유형·대상·사유 첫 줄·상신자·상신 일시). 계약이 이 리소스의
 * 업무 값을 **사유 하나**로 두어 수량·금액 컬럼이 아예 없으므로, 사유의 첫 줄이 곧 요약
 * 자리다 — 별도의 요약 열을 만들지 않는다(`omf-mes#87`).
 *
 * **승인 유형 열은 코드 그대로다.** 값 목록이 확정되기 전이라 이 화면에는 다른 유형의 요청도
 * 섞여 들어오고(위 안내가 그 사실을 말한다), 그때 **무엇을 결재하려는지 가릴 마지막 단서**가
 * 이 열이다. 화면이 이름을 지어내면 그 단서가 지어낸 것이 된다.
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
  onChangePage,
  selectedRequestId,
  onSelect,
  typeNote,
  loadError,
}: RequestListPaneProps) => {
  const columns: Column<RequestRow>[] = [
    {
      key: 'approvalRequestNo',
      header: t.fields.approvalRequestNo,
      width: REQUEST_COLUMN_WIDTH.approvalRequestNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          /*
           * 보이는 글자(요청번호)를 그대로 담아 음성 조작이 그 말로 이 버튼을 부를 수 있게 한다.
           * 계약이 요청번호를 UNIQUE로 두어 행마다 이름이 갈린다 — 대상 표시명은 갈리지 않는다
           * (한 문서에 요청이 두 번 오를 수 있다). **내부 번호는 접근 이름에도 넣지 않는다.**
           */
          aria-label={t.actions.selectRow(row.approvalRequestNo)}
          aria-current={row.approvalRequestId === selectedRequestId ? 'true' : undefined}
          onClick={() => {
            onSelect(row.approvalRequestId);
          }}
        >
          {row.approvalRequestNo}
        </button>
      ),
    },
    {
      key: 'approvalTypeCode',
      header: t.fields.approvalTypeCode,
      width: REQUEST_COLUMN_WIDTH.approvalTypeCode,
      /* 코드 문자열 그대로다 — 값 목록이 확정되기 전에 화면이 이름을 지어내지 않는다. */
      render: (row) => row.approvalTypeCode,
    },
    {
      key: 'target',
      header: t.fields.target,
      width: REQUEST_COLUMN_WIDTH.target,
      /* 서버가 만든 표시명 그대로다. 유형 코드로 이름을 지어내지 않는다. */
      render: (row) => row.targetName,
    },
    {
      key: 'reason',
      header: t.fields.reason,
      /* 남는 폭을 흡수하는 유일한 열. 예산은 `REASON_COLUMN_BUDGET_PX`가 갖는다. */
      render: (row) => row.reasonFirstLine,
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
  ];

  /**
   * 빈 상태는 두 갈래다 — 사용자가 할 조치가 다르다.
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다(주소 조작·조건 변경으로 생긴다).
   * ② 결과 없음: 조건을 줄이거나 확인칸을 끄면 나올 수 있다.
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
  const body = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

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
        <div className="wide-table">
          <Table
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.approvalRequestId)}
            /* 0건을 바깥에서 가르지 않는다 — 가르면 표의 빈 자리가 닿을 수 없는 가지가 된다. */
            empty={emptySlot}
          />
        </div>
        <PageNav view={pageView} onChange={onChangePage} />
      </>
    );
  };

  return (
    <>
      {/*
       * **상시 안내다**(G1). 불러오는 중이든 실패했든 이 사실은 참이라 본문보다 먼저,
       * 갈래 밖에 둔다 — 표가 서는 자리에만 두면 실패했을 때 「무엇이 보이는 목록인지」를
       * 말할 자리가 사라진다.
       *
       * 목록 **위에 한 번만** 낸다. 행마다 되풀이하면 표를 읽을 수 없다.
       */}
      {typeNote !== undefined && (
        <div className="banner-slot">
          <AlertBanner variant="info">{typeNote}</AlertBanner>
        </div>
      )}
      {body()}
    </>
  );
};
