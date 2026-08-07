import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { isOverdue } from './arrival';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { AsnView } from './types';

const t = messages.inboundSchedule;

export interface AsnTableProps {
  rows: AsnView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  /** 「오늘」은 화면이 인자로 준다 — 표가 직접 읽으면 테스트가 실행 환경의 시각을 검사하게 된다. */
  today: Date;
  selectedId: number | null;
  supplierLookup: ReferenceSource;
  onFirstPage: () => void;
  onToggleSelect: (asnId: number) => void;
  onRetryReferences: () => void;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 입하 예정 목록 표.
 *
 * **열이 여섯이다.** 계약의 `Asn`에는 필드가 여덟 있으나 공장·비고는 고른 건의 제목줄로 보냈다 —
 * 전부 열로 만들면 표가 짓눌려 셀이 낱말 단위로 쪼개진다(앞 화면에서 「표를 읽을 수 없다」로
 * 보고된 결함이다). 거래명세서번호는 표에 남긴다. 문서번호 검색의 대상이라
 * 검색해 놓고 무엇이 걸렸는지 보이지 않으면 검색이 반쪽이 된다.
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 입하예정번호 | 160px | 15자 ASCII(`--type-body-sm` 14px · 자폭 약 7.5px) 113px + 셀 여백 32px |
 * | 공급사 | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 도착 예정일 | 168px | 날짜 아래에 경과 칩이 쌓인다. 칩(한글 8자 112px + 안쪽 여백 24px) 136px + 32px |
 * | 거래명세서번호 | 148px | 14자 ASCII 105px + 32px |
 * | 상태 | 152px | 코드 13자 98px + 칩 안쪽 여백 24px + 32px |
 * | 선택 | 88px | `sm` 버튼 하나. W-06-10 「재처리」 열과 같은 근거 |
 * | 지정 폭 합 | 716px | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한(W-06-05 구성품 열과 같다) |
 * | **합** | **916px** | `.wide-table`의 최소 폭 `58rem`(928px) 안에 들어간다 |
 *
 * **진행 열과 P/O 라인 열을 만들지 않는다**(계획 결정 5·6). 계약의 `Asn`·`AsnLine`에
 * 진행률·입고 수량·발주 수량 필드가 하나도 없고, 발주 라인을 부를 경로도 조립할 수 없다
 * (`AsnLine`에 `purchaseOrderId`가 없다). 지어낸 값을 그리는 것보다 없는 것이 낫다.
 */
export const AsnTable = ({
  rows,
  isLoading,
  isBeyondLast,
  today,
  selectedId,
  supplierLookup,
  onFirstPage,
  onToggleSelect,
  onRetryReferences,
}: AsnTableProps) => {
  const columns: Column<AsnView>[] = [
    {
      key: 'asnNo',
      header: t.table.asnNo,
      width: '160px',
      sortable: true,
    },
    {
      key: 'supplier',
      header: t.table.supplier,
      /*
       * **번호를 문자열로 바꾸는 자리가 없다**(#44). 이름으로 풀 수 없는 세 갈래(미도착·목록에
       * 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
       */
      render: (row) => describeReference(toReference(supplierLookup, row.supplierId)),
    },
    {
      key: 'expectedArrivalDate',
      header: t.table.expectedArrivalDate,
      width: '168px',
      sortable: true,
      /* 표시가 날짜 + 칩이라 정렬 기준을 명시한다 — 렌더된 노드로 정렬할 수는 없다. */
      sortAccessor: (row) => row.expectedArrivalDate,
      render: (row) => (
        <div className="field-cell">
          <span>{row.expectedArrivalDate}</span>
          {/* 「미입하」라고 쓰지 않는다 — 상태 값 집합을 몰라 입하 여부를 화면이 판정할 수 없다. */}
          {isOverdue(row.expectedArrivalDate, today) && (
            <Chip variant="status" status="warning" size="sm">
              {t.values.overdue}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'deliveryNoteNo',
      header: t.summary.deliveryNoteNo,
      width: '148px',
      render: (row) => orEmptyMark(row.deliveryNoteNo),
    },
    {
      key: 'statusCode',
      header: t.table.status,
      width: '152px',
      /*
       * **값에 따라 변형을 가르지 않는다.** 값 집합이 확정되지 않아(omf-mes#64) 색을 가르면
       * 뜻을 지어내는 것이 된다. 코드는 번역하지 않고 그대로 낸다.
       */
      render: (row) => (
        <Chip variant="status" size="sm">
          {row.statusCode}
        </Chip>
      ),
    },
    {
      key: 'select',
      header: t.table.select,
      width: '88px',
      render: (row) => {
        const selected = row.asnId === selectedId;

        return (
          /*
           * 접근 이름에 **입하예정번호**를 넣는다 — 「선택」이 행마다 되풀이되면 어느 건인지 알 수 없다.
           * 내부 번호를 넣지 않는 이유는 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
           */
          <Button
            variant="outlined"
            size="sm"
            aria-label={
              selected ? t.actions.deselectRow(row.asnNo) : t.actions.selectRow(row.asnNo)
            }
            onClick={() => {
              onToggleSelect(row.asnId);
            }}
          >
            {selected ? t.actions.deselect : t.actions.select}
          </Button>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.asns}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  /** 범위 밖 쪽 → 결과 없음 순서로 하나만 낸다. 둘은 사용자가 할 조치가 서로 다르다. */
  const emptySlot = (): ReactNode =>
    isBeyondLast ? (
      <EmptyState
        size="sm"
        live
        title={t.empty.beyondLastTitle}
        description={t.empty.beyondLastDescription}
        action={
          <Button variant="outlined" onClick={onFirstPage}>
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

  return (
    <>
      {/*
       * `.wide-table`이 표에 최소 폭을 준다 — 폭이 모자라면 짓누르는 대신 가로로 넘긴다.
       * 스크롤 상자는 디자인 시스템 `Table`이 이미 갖고 있어 우리가 만들지 않는다.
       */}
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          /*
           * 선택 열을 쓰지 않아도 지정한다 — 미지정이면 인덱스가 React key가 되어
           * 쪽이 바뀔 때 앞 쪽의 행이 남아 보일 수 있다.
           *
           * **여기의 `String()`은 화면에 나오지 않는다** — React key로만 쓰이며 셀 텍스트가 되지 않는다.
           * 표시되는 값으로 번호를 옮기는 자리는 이 슬라이스에 없다(#44).
           */
          getRowId={(row) => String(row.asnId)}
          /*
           * **비제어 내부 정렬이다.** 계약의 조회 쿼리에 정렬 파라미터가 없어 서버로 보낼 수 없다
           * (이슈 #20 §6). `sort`·`onSortChange`를 주면 디자인 시스템이 내부 재정렬을 멈추므로
           * 둘 다 주지 않는다 — 정렬 범위가 현재 쪽뿐이라는 사실은 아래 안내가 밝힌다.
           */
          defaultSort={{ key: 'expectedArrivalDate', direction: 'ascending' }}
          empty={emptySlot()}
        />
      </div>

      {/* 밝히지 않으면 사용자가 「전체가 정렬된 것」으로 읽는다 — 서버가 쪽을 나눠 준다. */}
      <p className="field-note">{t.notes.sortScope}</p>

      {supplierLookup.isError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.referencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
