import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeCancelBlockReason, readCancelAvailability } from './cancel-availability';
import type { DocumentProgressView } from './types';

const t = messages.documentProgress;

/**
 * `.wide-table`이 표에 주는 최소 폭(`58rem`).
 *
 * 열 폭 예산을 재는 감지기가 이 값을 읽는다 — 숫자를 테스트가 따로 적으면 배치 규범이 바뀔 때
 * 둘이 갈린다. 이 표가 자기 상수를 갖는 이유는 열 구성이 바뀌어 최소 폭을 올려야 할 때
 * 다른 표까지 함께 끌려가면 안 되기 때문이다.
 */
export const PROGRESS_TABLE_MIN_WIDTH_PX = 928;

/**
 * 목록의 열 구성 — **아홉 열**이다.
 *
 * ⛔ **문서 유형 열이 없다.** 계약이 `documentTypeCode`를 목록 조회의 **필수** 질의값으로 두어
 * 한 응답의 모든 행이 같은 유형이다 — 값이 하나뿐인 열은 폭만 먹고 아무것도 말하지 않으며,
 * 지금 무슨 유형을 보고 있는지는 조건 줄의 선택칸이 이미 말한다. 유형 **안의** 구분
 * (`documentSubTypeCode`)은 행마다 다르므로 열로 남는다.
 *
 * ⭐ **후속 건수와 취소 가능이 열로 있는 것이 이 표의 요점이다.** 상세를 열어야 취소 가능 여부를
 * 알면 실무자가 목록에서 대상을 고르지 못한다(착수 이슈 §6). 그리고 **둘 다 서버가 판정해
 * 내려준 값**이다 — 화면이 유형↔후속 관계표를 만들어 다시 세지 않는다(공유계약 A-10 보강).
 *
 * **정렬을 열지 않는다.** 계약의 이 조회에 정렬 파라미터가 없고(실측) 화면 안에서만 정렬하면
 * 「지금 쪽 안에서만 정렬됐다」는 사정을 매번 설명해야 한다.
 *
 * 열 폭의 도출(흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 문서번호 | 168px | 16자(자폭 약 7.5px) 120px + 셀 여백 32px |
 * | 문서일자 | 112px | `YYYY-MM-DD` 10자 75px + 여백 32px |
 * | 세부구분 | 96px | 코드 문자열 |
 * | 상태 | 96px | 코드 문자열 |
 * | 계획 수량 | 80px | 머리글 5자 40px + 여백 32px. 우측 정렬 |
 * | 처리 수량 | 80px | 같은 위 |
 * | 잔여 수량 | 80px | 같은 위 |
 * | 후속 | 64px | 머리글 2자 20px + 여백 32px. 우측 정렬 |
 * | **취소 가능** | **미지정** | 남는 폭을 흡수한다 |
 * | **지정 폭 합** | **776px** | |
 * | 흡수 열이 받는 폭 | **152px** | 928 − 776 |
 *
 * **흡수 열의 예산이 다른 표보다 작은 이유**: 이 칸은 두 조각(「취소 불가」와 사유)이
 * **일부러 위아래로 쌓인다** — 한 줄에 이어 붙이면 사유가 상태처럼 읽힌다. 그래서 예산의
 * 기준이 두 조각의 합이 아니라 **긴 쪽 하나**이며, 가장 긴 사유 문면(「후속 문서가 있습니다」
 * 10자 75px + 여백 32px = 107px)이 들어가면 된다. 152px는 그보다 45px 넓다.
 */
export const buildProgressColumns = (): Column<DocumentProgressView>[] => [
  { key: 'documentNo', header: t.table.documentNo, width: '168px' },
  { key: 'documentDate', header: t.table.documentDate, width: '112px' },
  {
    key: 'documentSubTypeCode',
    header: t.table.subType,
    width: '96px',
    /*
     * 계약이 선택으로 두어 **없이 오는 문서가 실재한다.** 빈 칸으로 두면 값이 없는 것인지
     * 화면이 못 그린 것인지 구분되지 않는다 — 코드를 지어내지 않고 없음을 표식으로 낸다.
     */
    render: (row) => row.documentSubTypeCode ?? t.values.empty,
  },
  { key: 'statusCode', header: t.table.status, width: '96px' },
  {
    key: 'plannedQty',
    header: t.table.plannedQty,
    width: '80px',
    align: 'end',
    render: (row) => String(row.plannedQty),
  },
  {
    key: 'processedQty',
    header: t.table.processedQty,
    width: '80px',
    align: 'end',
    render: (row) => String(row.processedQty),
  },
  {
    key: 'remainingQty',
    header: t.table.remainingQty,
    width: '80px',
    align: 'end',
    render: (row) => String(row.remainingQty),
  },
  {
    key: 'successorCount',
    header: t.table.successorCount,
    width: '64px',
    align: 'end',
    /* **서버가 센 값을 그대로 낸다.** 0도 그대로 낸다 — 0건은 정상이고 이 표의 좋은 소식이다. */
    render: (row) => String(row.successorCount),
  },
  {
    key: 'cancelAvailability',
    header: t.table.cancelAvailability,
    /*
     * **색만으로 말하지 않는다** — 글자로 낸다. 그리고 막힌 이유를 같은 칸에 함께 낸다:
     * 「취소 불가」만 있으면 사용자가 왜 안 되는지 알려고 결국 상세를 열어야 한다.
     */
    render: (row) => {
      const availability = readCancelAvailability(row);

      if (availability.kind === 'available') {
        return <span className="field-note">{t.cancel.available}</span>;
      }

      return (
        <>
          {t.cancel.blocked}
          <span className="field-note">{describeCancelBlockReason(availability)}</span>
        </>
      );
    },
  },
];

/** 빈 표에 무엇을 낼 것인가. **갈래가 넷이고 사용자가 할 조치가 저마다 다르다.** */
export type ListEmptyReason = 'typesPending' | 'noDocumentType' | 'beyondLast' | 'noResult';

export interface EmptyReasonInput {
  /** 문서 유형 값 목록이 아직 오지 않았다 — 이 화면으로는 아무것도 조회할 수 없다. */
  isTypeListPending: boolean;
  /** 유형을 골랐는가. 고르지 않았으면 조회가 성립하지 않는다. */
  hasDocumentType: boolean;
  /** 결과는 있는데 이 쪽에는 없다. */
  isBeyondLast: boolean;
}

/**
 * 빈 표의 사유를 고른다 — **판정 순서가 곧 사용자에게 알릴 순서다.**
 *
 * 값 목록 미도착이 가장 앞이다. 그 상태에서 「조건에 맞는 문서가 없습니다」를 내면 사용자가
 * 조건을 넓히며 헤매는데, 실제로는 **조회 자체가 시작되지 않은** 것이라 무엇을 해도 결과가 같다.
 */
export const readEmptyReason = ({
  isTypeListPending,
  hasDocumentType,
  isBeyondLast,
}: EmptyReasonInput): ListEmptyReason => {
  if (isTypeListPending) return 'typesPending';
  if (!hasDocumentType) return 'noDocumentType';

  return isBeyondLast ? 'beyondLast' : 'noResult';
};

export interface ProgressTableProps extends EmptyReasonInput {
  rows: DocumentProgressView[];
  isLoading: boolean;
  onFirstPage: () => void;
}

/**
 * 진행현황 목록 표.
 *
 * **빈 상태를 바깥에서 가르지 않는다.** 표를 늘 그리고 `empty`가 0건을 맡는다 —
 * 바깥에서 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ProgressTable = ({
  rows,
  isLoading,
  isTypeListPending,
  hasDocumentType,
  isBeyondLast,
  onFirstPage,
}: ProgressTableProps) => {
  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.list}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const emptySlot = (): ReactNode => {
    switch (readEmptyReason({ isTypeListPending, hasDocumentType, isBeyondLast })) {
      case 'typesPending':
        return (
          <EmptyState
            size="sm"
            title={t.empty.typesPendingTitle}
            description={t.empty.typesPendingDescription}
          />
        );
      case 'noDocumentType':
        return (
          <EmptyState
            size="sm"
            title={t.empty.noDocumentTypeTitle}
            description={t.empty.noDocumentTypeDescription}
          />
        );
      case 'beyondLast':
        return (
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
        );
      case 'noResult':
        return (
          <EmptyState
            size="sm"
            live
            title={t.empty.noResultTitle}
            description={t.empty.noResultDescription}
          />
        );
    }
  };

  return (
    /*
     * `.wide-table`이 표에 최소 폭을 준다 — 폭이 모자라면 짓누르는 대신 가로로 넘긴다.
     * 스크롤 상자는 디자인 시스템 `Table`이 이미 갖고 있어 우리가 만들지 않는다.
     */
    <div className="wide-table">
      <Table
        density="compact"
        columns={buildProgressColumns()}
        rows={rows}
        /*
         * **문서 번호 하나로는 행을 가릴 수 없다.** 같은 번호가 유형이 다르면 다른 문서이고,
         * 계약의 상세 경로도 유형과 번호 **둘**을 열쇠로 쓴다 — 그래서 키도 둘을 잇는다.
         *
         * 미지정이면 인덱스가 React key가 되어, 앞 줄이 사라질 때 치고 있던 칸의 DOM 노드가
         * 대신 지워지고 포커스가 말없이 다른 줄로 옮겨 붙는다.
         *
         * **여기의 문자열은 화면에 나오지 않는다** — React key로만 쓰인다.
         */
        getRowId={(row) => `${row.documentTypeCode}:${String(row.documentId)}`}
        empty={emptySlot()}
      />
    </div>
  );
};
