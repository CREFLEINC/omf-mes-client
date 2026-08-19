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

export interface ProgressColumnsInput {
  /** 지금 고른 문서. 같은 줄의 손잡이가 「선택 해제」로 바뀐다. */
  selectedDocumentId: number | null;
  onToggleSelect: (documentId: number) => void;
}

/**
 * 목록의 열 구성 — **열 개**다.
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
 * ⭐ **열째 열이 「선택」이다.** 고른 문서의 상세가 목록 **아래**에 선다 — 드로어도 창도 아니다
 * (디자인 시스템에 드로어가 없고, 창이면 목록이 가려져 「고르고 다시 목록으로 돌아가는」 이
 * 화면의 반복 조회가 매번 열고 닫는 일이 된다).
 *
 * 열 폭의 도출(자폭 약 **7.5px** · 셀 좌우 여백 **32px** · `sm` 버튼 88px):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 문서번호 | 152px | 문서번호 16자 120px + 여백 32px |
 * | 문서일자 | 112px | `YYYY-MM-DD` 10자 75px + 여백 32px = 107px → 112 |
 * | 세부구분 | 88px | 머리글 4자 30px + 여백 32px = 62px. ⚠ 아래 주 |
 * | 상태 | 88px | 같은 위 |
 * | 계획 수량 | 80px | 머리글 4자 30px + 여백 32px = 62px. 수량 자릿수 여유 포함. 우측 정렬 |
 * | 처리 수량 | 80px | 같은 위 |
 * | 잔여 수량 | 80px | 같은 위 |
 * | 후속 | 56px | 머리글 2자 15px + 여백 32px = 47px → 56. 우측 정렬 |
 * | **취소 가능** | **192px** | ⭐ 아래 주 |
 * | 선택 | 88px | `sm` 버튼 하나(전례 `gr-table`·`balance-table`의 선택 열과 같은 값) |
 * | **합** | **1,016px** | 표 하한(928px)을 **넘는다** — 아래 주 |
 *
 * ⚠ **세부구분·상태는 폭을 보장할 수 없다.** 그 칸에 서는 것은 **서버가 정하는 코드 문자열**이라
 * 길이에 상한이 없다 — 어떤 폭을 잡아도 더 긴 코드가 올 수 있으므로, 이 두 예산은 **머리글이
 * 접히지 않는 하한**(62px)에 짧은 코드 몫을 더한 값이고 그보다 긴 코드는 접힌다. 지어낸 상한으로
 * 「보장한다」고 적지 않는다.
 *
 * ⭐ **취소 가능 열의 예산 기준은 「이 화면이 소유한 문구 중 가장 긴 것」이다.** 이 칸은 두 조각
 * (「취소 불가」와 사유)이 **일부러 위아래로 쌓이므로** 기준이 두 조각의 합이 아니라 긴 쪽 하나이고,
 * 그 긴 쪽은 취소 불가 사유 넷 중 최장인 `STATE_LOCKED`의 문면이다 — **19자 142.5px + 여백 32px
 * = 174.5px**. 192px가 그보다 17.5px 넓다.
 *
 * ⛔ **코드 문자열과 달리 이 값은 상한이 있다** — 문면을 우리가 소유하기 때문이다. 그래서 감지기가
 * 리터럴이 아니라 **i18n의 실제 문면에서 최장값을 계산해** 예산과 견준다. 문면이 길어지거나 열이
 * 좁아지면 그 자리에서 깨진다.
 *
 * ⚠ **선택 열이 생기면서 흡수 열을 없앴다.** 선택 열(88px)을 더하면 흡수 열에 남는 폭이 104px로
 * 줄어 위 예산(174.5px)을 담지 못한다. 그래서 **취소 가능 열의 폭을 그 예산 그대로 못 박고**
 * 미지정 열을 두지 않는다 — 합이 표 하한을 넘는 것은 문제가 아니다. `.wide-table`의 `58rem`은
 * **바닥이지 천장이 아니어서**, 합이 하한 이상이면 각 열이 선언한 폭 그대로 렌더되고 모자란 폭은
 * 디자인 시스템의 가로 스크롤 상자가 처리한다. ⛔ 반대로 **합을 하한 아래로 누르면** 고정 배치가
 * 남는 폭을 미지정 열에 몰아넣어 선언과 실렌더가 어긋난다(전례 `stock-status/balance-table.tsx`가
 * 브라우저 확인으로 실측한 자리이며, 그 표도 같은 이유로 모든 열이 폭을 지정한다).
 */
export const buildProgressColumns = ({
  selectedDocumentId,
  onToggleSelect,
}: ProgressColumnsInput): Column<DocumentProgressView>[] => [
  { key: 'documentNo', header: t.table.documentNo, width: '152px' },
  { key: 'documentDate', header: t.table.documentDate, width: '112px' },
  {
    key: 'documentSubTypeCode',
    header: t.table.subType,
    width: '88px',
    /*
     * 계약이 선택으로 두어 **없이 오는 문서가 실재한다.** 빈 칸으로 두면 값이 없는 것인지
     * 화면이 못 그린 것인지 구분되지 않는다 — 코드를 지어내지 않고 없음을 표식으로 낸다.
     */
    render: (row) => row.documentSubTypeCode ?? t.values.empty,
  },
  { key: 'statusCode', header: t.table.status, width: '88px' },
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
    width: '56px',
    align: 'end',
    /* **서버가 센 값을 그대로 낸다.** 0도 그대로 낸다 — 0건은 정상이고 이 표의 좋은 소식이다. */
    render: (row) => String(row.successorCount),
  },
  {
    key: 'cancelAvailability',
    header: t.table.cancelAvailability,
    width: '192px',
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
  {
    key: 'select',
    header: t.table.select,
    width: '88px',
    /*
     * 접근 이름에 **문서번호**를 넣는다 — 「선택」이 줄마다 되풀이되면 어느 문서를 여는지
     * 보조기술로 알 수 없다. ⛔ **내부 번호는 넣지 않는다**(omf-mes#44): 눈으로 읽는 값과
     * 보조기술이 읽는 값이 어긋나면 안 된다.
     */
    render: (row) => {
      const isSelected = row.documentId === selectedDocumentId;

      return (
        <Button
          variant="outlined"
          size="sm"
          aria-label={
            isSelected ? t.actions.deselectRow(row.documentNo) : t.actions.selectRow(row.documentNo)
          }
          onClick={() => {
            onToggleSelect(row.documentId);
          }}
        >
          {isSelected ? t.actions.deselect : t.actions.select}
        </Button>
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

export interface ProgressTableProps extends EmptyReasonInput, ProgressColumnsInput {
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
  selectedDocumentId,
  onToggleSelect,
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
        columns={buildProgressColumns({ selectedDocumentId, onToggleSelect })}
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
