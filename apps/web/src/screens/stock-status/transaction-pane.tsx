import {
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { formatTransactionAt } from './as-of';
import { resolveBusinessPeriod, type BusinessPeriod } from './business-period';
import { LoadErrorBanner } from './load-error-banner';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import { toTransactionRowKey, type TransactionRef, type TransactionView } from './types';

const t = messages.stockStatus;

/**
 * 열 폭 예산. **모든 열이 폭을 지정한다** — 디자인 시스템 `Table`은 `table-layout: fixed`라
 * 폭을 지정하지 않은 열이 남는 폭의 잔여분을 받아 선언과 실렌더가 어긋난다(브라우저 확인 F-B2).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 거래 번호 | **200px** | 이 표의 축 열이다. 번호 아래에 「역처리」 칩이 쌓인다 |
 * | 영업일 | 120px | `YYYY-MM-DD` 10자 75 + 셀 여백 32 |
 * | 거래 유형 · 상태 | 각 140·120px | 코드 배지 하나 |
 * | 원천 전표 | 160px | 코드 배지가 길다(`GOODS_RECEIPT` 13자 98 + 칩 여백 24 + 32) |
 * | 발생 시각 | 124px | **`MM-DD HH:mm`**(`as-of.ts`가 그 형태로 줄인다) |
 * | 라인 | 88px | 「닫기」 버튼 하나 |
 *
 * 합은 **952px**로 `.wide-table` 하한(928px) 위다 — 아래로 누르면 고정 배치가 남는 폭을
 * 나눠 넣어 선언과 실렌더가 어긋난다.
 */
const WIDTH = {
  businessDate: '120px',
  transactionNo: '200px',
  transactionType: '140px',
  sourceDocumentType: '160px',
  status: '120px',
  occurredAt: '124px',
  select: '88px',
} as const;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 값 목록이 확정되지 않은 코드의 배지. **중립 변형 하나로만 쓴다**(계획 결정 12) —
 * 거래 유형·원천 전표 유형·상태 셋 다 값 집합이 아직 없다(omf-mes#64).
 */
const codeChip = (code: string): ReactNode => (
  <Chip variant="status" size="sm">
    {code}
  </Chip>
);

export interface TransactionColumnDeps {
  /** 지금 라인을 열어 둔 거래. 주소가 소유하므로 표는 받아 쓰기만 한다. */
  selected: TransactionRef | null;
  onToggleSelect: (row: TransactionView) => void;
}

/**
 * 이력 표의 열 구성. **부품 밖으로 내보내 열 폭과 열 구성을 값으로 검사한다.**
 *
 * **수량 열이 없다.** 계약의 이 목록은 헤더라 수량을 주지 않는다 — 만들면 라인을 훑어
 * 더해야 하고, 라인마다 단위가 달라 그 합은 틀린 값이다(계획 결정 7과 같은 근거).
 *
 * **원천 전표의 번호(`sourceDocumentId`)를 내지 않는다**(#44). 유형 코드만 낸다 —
 * 번호를 이름으로 풀 참조가 이 화면에 없어 내면 내부 번호가 그대로 화면에 선다.
 */
export const buildTransactionColumns = ({
  selected,
  onToggleSelect,
}: TransactionColumnDeps): Column<TransactionView>[] => [
  {
    key: 'businessDate',
    header: t.history.table.businessDate,
    width: WIDTH.businessDate,
    /* 계약이 준 `YYYY-MM-DD` 그대로다 — 식별자의 일부라 줄여 적지 않는다. */
    render: (row) => row.businessDate,
  },
  {
    key: 'transactionNo',
    header: t.history.table.transactionNo,
    width: WIDTH.transactionNo,
    render: (row) => (
      <div className="field-cell">
        <span>{row.transactionNo}</span>
        {/*
         * **취소는 행을 지우지 않고 역처리 행을 더한다**(계약). 표식이 없으면 사용자가
         * 같은 수량이 두 번 움직인 것으로 읽는다. **대상 거래의 번호는 내지 않는다**(#44).
         */}
        {row.isReversal && (
          <Chip variant="status" status="warning" size="sm">
            {t.history.reversal}
          </Chip>
        )}
      </div>
    ),
  },
  {
    key: 'transactionTypeCode',
    header: t.history.table.transactionType,
    width: WIDTH.transactionType,
    render: (row) => codeChip(row.transactionTypeCode),
  },
  {
    key: 'sourceDocumentTypeCode',
    header: t.history.table.sourceDocumentType,
    width: WIDTH.sourceDocumentType,
    render: (row) => codeChip(row.sourceDocumentTypeCode),
  },
  {
    key: 'statusCode',
    header: t.history.table.status,
    width: WIDTH.status,
    render: (row) => codeChip(row.statusCode),
  },
  {
    key: 'occurredAt',
    header: t.history.table.occurredAt,
    width: WIDTH.occurredAt,
    render: (row) => orEmptyMark(formatTransactionAt(row.occurredAt)),
  },
  {
    key: 'select',
    header: t.history.table.select,
    width: WIDTH.select,
    render: (row) => {
      /*
       * **영업일과 번호가 둘 다 같아야 같은 거래다** — 계약이 영업일을 식별자의 일부로 둔다.
       * 번호만 견주면 다른 영업일의 같은 번호가 열린 것으로 보인다.
       */
      const isSelected =
        selected !== null &&
        selected.transactionId === row.inventoryTransactionId &&
        selected.businessDate === row.businessDate;

      return (
        <Button
          variant="outlined"
          size="sm"
          aria-label={
            isSelected
              ? t.history.hideLinesRow(row.transactionNo)
              : t.history.showLinesRow(row.transactionNo)
          }
          onClick={() => {
            onToggleSelect(row);
          }}
        >
          {isSelected ? t.history.hideLines : t.history.showLines}
        </Button>
      );
    },
  },
];

export interface TransactionPaneProps extends TransactionColumnDeps {
  /** 주소에 반영된(= 조회에 쓰인) 기간. 고치는 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: BusinessPeriod;
  rows: TransactionView[];
  isLoading: boolean;
  /**
   * 조회가 실제로 나갔는가. **거짓이면 「없습니다」로 말하지 않는다** —
   * 기간이 없으면 요청 자체가 나가지 않는데 그때 결과 없음을 내면 사용자가 이 LOT이
   * 움직인 적 없다고 읽는다(무엇을 해도 결과가 같다).
   */
  hasQuery: boolean;
  pageView: PageView;
  /**
   * 조회가 실패했는가. **표 자리만 배너로 바뀌고 조건 줄은 남는다** —
   * 사유와 복구는 아래 둘이 나른다.
   */
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onSearch: (period: BusinessPeriod) => void;
  onChangePage: (page: number) => void;
}

/**
 * 수불 이력 구획 — **기간 두 칸 + 조회 + 이력 목록 + 쪽.**
 *
 * **영업일 범위 없이는 조회하지 않는다**(계획 결정 14). 계약이 기간을 필수로 두어 빼면 400이고,
 * 그것은 성능이 아니라 **가능·불가능**의 문제다. 형식만 보고 통과시키면 400이 돌아와
 * 사용자에게는 「조회가 늘 실패한다」로만 보이므로, 없는 날짜(`2026-02-31`)와 뒤집힌 기간까지
 * `business-period.ts`가 미리 가르고 그 판정이 곧 잠긴 버튼의 사유가 된다.
 *
 * **선택칸(`Select`)을 두지 않는다.** 거래 유형·원천 전표 유형 조건은 값 목록이 확정되지
 * 않아 자리표시가 비고, 「조회해야 선택지가 생긴다」는 순환이 된다. 조건이 날짜 두 칸뿐이라
 * 이 구획을 나중에 창으로 옮기더라도 #45(창 안 선택칸이 잘린다)가 걸릴 자리가 없다.
 *
 * **표 자리에 오는 것이 넷이고 이 부품이 그 넷을 다 정한다** — 실패 배너 · 조회 중 표기 ·
 * 빈 상태 세 갈래 · 표. 바깥에서 실패를 먼저 갈라 구획을 통째로 감추면 **조건 줄까지 사라져**
 * 사용자가 기간을 고칠 수단을 잃는다(같은 화면 잔액 구획의 「조건을 고칠 수단이 사라지면
 * 안 된다」와 반대가 된다). 실패가 권한 없음이면 「다시 시도」도 없어 그 구획에서 할 수 있는
 * 조치가 0이 된다 — 조건 줄이 남아야 기간을 좁혀 다시 부를 수 있다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const TransactionPane = ({
  appliedPeriod,
  rows,
  isLoading,
  hasQuery,
  pageView,
  isError,
  error,
  selected,
  onRetry,
  onSearch,
  onToggleSelect,
  onChangePage,
}: TransactionPaneProps) => {
  const reasonId = useId();

  const [period, setPeriod] = useState<BusinessPeriod>(appliedPeriod);

  /*
   * 주소가 정본이다 — 뒤로가기·LOT 바꾸기로 주소가 **바뀌면** 고치던 값도 그 값으로 돌아간다.
   *
   * **되돌림을 참조가 아니라 값으로 판정한다**(#43). 부모는 렌더할 때마다 주소에서 값을 새로
   * 읽으므로 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 날짜가 사라진다. 그래서 의존성에 **원시 필드 둘을
   * 풀어 둔다.**
   */
  const { from: appliedFrom, to: appliedTo } = appliedPeriod;

  useEffect(() => {
    setPeriod({ from: appliedFrom, to: appliedTo });
  }, [appliedFrom, appliedTo]);

  /*
   * **잠그는 판정과 보낼 쿼리를 만드는 판정이 같은 함수다.** 화면이 조건을 다시 계산하면
   * 두 곳이 어긋나 — 잠기지 않았는데 요청이 안 나가거나, 잠겼는데 사유가 다른 상태가 된다.
   */
  const resolved = resolveBusinessPeriod(period);
  const searchReason = resolved.kind === 'blocked' ? resolved.reason : null;

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(period);
  };

  /**
   * 조회 전 → 범위 밖 쪽 → 결과 없음 순서로 하나만 낸다. 셋은 사용자가 할 조치가 서로 다르다.
   *
   * **조회 전이 맨 앞이다.** 요청을 보내지 않은 상태를 「기록이 없다」로 말하면 안내가 시키는
   * 조치(기간을 넓혀라)가 실제 원인(기간을 안 넣었다)과 어긋난다. 사유는 잠긴 조회 버튼이
   * 이미 밝히고 있으므로 여기서는 `live`를 붙이지 않는다 — 붙이면 같은 사정이 두 번 읽힌다.
   */
  const emptySlot = (): ReactNode => {
    if (!hasQuery) {
      return (
        <EmptyState
          size="sm"
          title={t.history.empty.notQueriedTitle}
          description={t.history.empty.notQueriedDescription}
        />
      );
    }

    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.history.empty.beyondLastTitle}
          description={t.history.empty.beyondLastDescription}
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
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.history.empty.noResultTitle}
        description={t.history.empty.noResultDescription}
      />
    );
  };

  return (
    <>
      <div className="filter-bar">
        {/*
         * 네이티브 날짜 입력이다 — 달력이 브라우저의 것이라 구획이 잘라 낼 펼침 목록이 없다.
         * 이 구획에 `Select`를 두지 않는 것과 함께 #45가 걸릴 자리를 없앤다.
         */}
        <TextField
          type="date"
          label={t.history.periodFrom}
          value={period.from}
          onChange={(event) => {
            setPeriod((prev) => ({ ...prev, from: event.target.value }));
          }}
        />
        <TextField
          type="date"
          label={t.history.periodTo}
          value={period.to}
          onChange={(event) => {
            setPeriod((prev) => ({ ...prev, to: event.target.value }));
          }}
        />

        {/*
         * 비활성 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다 —
         * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·보조기술 사용자가 닿을 수 없다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              disabled={searchReason !== null}
              aria-describedby={searchReason === null ? undefined : reasonId}
              onClick={search}
            >
              {messages.common.search}
            </Button>
          </div>
          {searchReason !== null && (
            <span id={reasonId} className="field-note">
              {searchReason}
            </span>
          )}
        </div>
      </div>

      {/* 기간이 왜 필요한지와 기본값을 밝힌다 — 성능이 아니라 가능·불가능의 문제다. */}
      <p className="field-note">{t.history.periodNote}</p>

      {/*
       * 표 자리에 오는 넷. 순서가 뜻을 정한다 — **실패가 맨 앞이다.**
       * 실패를 빈 상태로 말하면 사용자가 기록이 없는 줄 알고 기간을 넓히는데,
       * 무엇을 해도 결과가 같다. 조건 줄은 이 갈래 **밖에** 있어 어느 경우에도 남는다.
       */}
      {isError ? (
        <LoadErrorBanner error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <div role="status" aria-label={t.loading.history}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          <div className="wide-table">
            <Table
              density="compact"
              caption={t.panes.history}
              columns={buildTransactionColumns({ selected, onToggleSelect })}
              rows={rows}
              /*
               * **영업일과 번호를 함께 잇는다** — 계약이 둘을 함께 식별자로 두어 번호만으로는
               * 행이 겹칠 수 있다. 그 판정은 `types.ts`가 소유한다 — 여기 인라인으로 두면
               * 키를 한 조각으로 줄여도 아무 단언도 깨지지 않는다(리뷰 M13).
               * **이 문자열은 화면에 나오지 않는다**(#44).
               */
              getRowId={toTransactionRowKey}
              empty={emptySlot()}
            />
          </div>

          {hasQuery && <PageNav view={pageView} onChange={onChangePage} />}
        </>
      )}
    </>
  );
};
