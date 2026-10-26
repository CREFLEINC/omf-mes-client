import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-order';
import { useColumnWidths } from '../../patterns/column-resize';

import { statusBadgeOf } from './labels';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { RequestRow } from './types';

const t = messages.iqcSkipApproval;

/**
 * 표의 열 폭(omf-all-around#134).
 *
 * **흡수 열은 사유 하나뿐이고 나머지 여섯은 폭을 지정한다.** 긴 값(대상·사유·상신자)은 한 줄
 * 말줄임이고 전체 값은 마우스를 올리면 보인다(`title`). 그래서 표가 1024 폭 창에서도 가로로
 * 넘치지 않는다 — 지정 폭 합 **612px** + 사유 하한 **74px** = `TABLE_MIN_WIDTH_PX`(686px, 1024 폭
 * 창에서 사이드바를 연 채 표가 받는 폭 실측). 칸 좌우 여백은 8px씩이다(CSS).
 *
 * | 열 | 폭 | 근거(실측 글자 폭 + 여백 16px) |
 * | --- | ---: | --- |
 * | 요청번호 | 148px | `AP-20261021-0001` 굵게 131px |
 * | 승인 유형 | 72px | 「IQC 생략」 56px |
 * | 대상 | 100px | 「입하 LOT #16」 83px |
 * | **사유 첫 줄** | **미지정** | 남는 폭을 흡수하는 유일한 열 |
 * | 상신자 | 72px | 사람 이름 — 길면 말줄임 |
 * | 상태 | 84px | 배지 「결재 대기」 |
 * | 상신 일시 | 136px | `2026-08-06 14:20` 119px |
 *
 * **상태 열을 둔다.** 「결재 대기만 보기」를 끄면 대기·승인·반려가 섞이는데 상태가 없으면
 * 고르기 전에는 구분할 수 없다. 진행 단계는 여전히 상세가 말한다.
 */
export const REQUEST_COLUMN_WIDTH = {
  approvalRequestNo: '148px',
  approvalTypeCode: '72px',
  target: '100px',
  requester: '72px',
  status: '84px',
  requestedAt: '136px',
} as const;

/** 흡수 열(사유)의 하한. 지정 폭 합과 더해 표 최소 폭이 된다. */
export const REASON_COLUMN_MIN_PX = 74;

/** 표 최소 폭 — 이보다 좁으면 그때만 가로로 넘긴다. CSS(`.iqc-skip-approval-table`)와 같은 값. */
export const TABLE_MIN_WIDTH_PX = 686;

/** 한 줄 말줄임 칸 — 전체 값은 `title`로 보인다. */
const Ellipsis = ({ text }: { text: string }) => (
  <span className="iqc-skip-approval-ellipsis" title={text}>
    {text}
  </span>
);

export interface RequestListPaneProps {
  rows: RequestRow[];
  isLoading: boolean;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedRequestId: number | null;
  onSelect: (approvalRequestId: number) => void;
  /**
   * 승인 유형 코드가 주입되지 않은 예외 상태의 방어 안내. **화면이 넘긴다** —
   * 부품이 고정값을 직접 읽지 않게 해 전환을 화면 수준에서 검증한다.
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
 * **열은 일곱이다**(요청번호·승인 유형·대상·사유 첫 줄·상신자·상태·상신 일시). 계약이 이 리소스의
 * 업무 값을 **사유 하나**로 두어 수량·금액 컬럼이 아예 없으므로, 사유의 첫 줄이 곧 요약
 * 자리다 — 별도의 요약 열을 만들지 않는다(`omf-mes#87`).
 *
 * **승인 유형·대상·상태는 사용자 용어로 낸다**(`labels.ts`) — 표에 없는 코드는 그대로다.
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
          className="link-cell iqc-skip-approval-request-no"
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
      render: (row) => <Ellipsis text={row.approvalTypeCode} />,
    },
    {
      key: 'target',
      header: t.fields.target,
      width: REQUEST_COLUMN_WIDTH.target,
      render: (row) => <Ellipsis text={row.targetName} />,
    },
    {
      key: 'reason',
      header: t.fields.reason,
      /* 남는 폭을 흡수하는 유일한 열. */
      render: (row) => <Ellipsis text={row.reasonFirstLine} />,
    },
    {
      key: 'requester',
      header: t.fields.requestedByName,
      width: REQUEST_COLUMN_WIDTH.requester,
      render: (row) => <Ellipsis text={row.requesterName} />,
    },
    {
      key: 'status',
      header: t.fields.status,
      width: REQUEST_COLUMN_WIDTH.status,
      align: 'center',
      render: (row) => {
        const badge = statusBadgeOf(row.statusCode);
        return (
          <Chip variant="status" size="sm" status={badge.tone}>
            {badge.label}
          </Chip>
        );
      },
    },
    {
      key: 'requestedAt',
      header: t.fields.requestedAt,
      width: REQUEST_COLUMN_WIDTH.requestedAt,
      align: 'end',
      /* **시각까지 낸다** — 같은 날 올라온 요청들의 앞뒤가 결재 차례를 읽는 단서다. */
      render: (row) => row.requestedAtText,
    },
  ];
  /* 머리칸을 끌어 순서를 바꾸고, 오른쪽 끝을 끌어 폭을 바꾼다(#186) — 둘 다 이 브라우저에 남는다. */
  const ordered = useColumnOrder('omf-mes:iqc-skip-approval:column-order', columns);
  const resizable = useColumnWidths('omf-mes:iqc-skip-approval:columns', ordered);

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
         * 표가 `TABLE_MIN_WIDTH_PX`보다 좁아질 때만 가로로 넘긴다. 넘침이 곧 가로 스크롤이 되는
         * 상자는 디자인 시스템 `Table`이 이미 갖고 있다 — 우리가 만들지 않는다.
         */}
        {/*
         * 줄 아무 곳이나 눌러도 고른다(#186, 품질 승인 처리와 같은 방식) — DS 표에 줄 클릭이 없어 눌린 줄의 요청 단추로
         * 넘긴다. 키보드·화면 낭독기는 종전처럼 그 단추 하나로 고른다.
         */}
        <div
          className="wide-table iqc-skip-approval-table"
          style={resizable.style}
          onClick={(event) => {
            const target = event.target as Element;
            if (target.closest('button, a, input, select, textarea') !== null) return;
            target
              .closest('tbody tr')
              ?.querySelector<HTMLButtonElement>('.iqc-skip-approval-request-no')
              ?.click();
          }}
        >
          <Table
            density="compact"
            columns={resizable.columns}
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
