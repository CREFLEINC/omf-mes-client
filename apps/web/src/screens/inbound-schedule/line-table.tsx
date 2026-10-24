import {
  Button,
  type Column,
  EmptyState,
  SkeletonText,
  type SortState,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { useColumnWidths } from '../../patterns/column-resize';
import type { ExcessEntry } from './excess-entry';
import { lineExcessesOf, type LineExcesses } from './excess-match';
import {
  LotActionCell,
  LotMainCell,
  lotLocation,
  StageChip,
  StageGroupChip,
  TreeGuide,
  TreeToggle,
} from './lot-row';
import { formatDate } from './period';
import { formatQty, OneLine, orEmpty, ReceiptStatusCell } from './receipt-status';
import {
  lineTableRowId,
  linesWithLots,
  presentGroups,
  toLineTableRows,
  type LineTableRow,
} from './stage';
import { checkQty, isCheckable, isEditable, splitReceiveQty } from './receive-entry';
import { sortRows, type SortAccessors } from './table-sort';
import type {
  InboundLotProgress,
  InboundScheduleLine,
  IssuedLotProgress,
  PurchaseOrderSummary,
} from './types';
import type { ReceiveDraft } from './use-receive-draft';

const t = messages.inboundSchedule;

export interface LineTableProps {
  /** 고른 발주. 없으면 「왼쪽에서 고르세요」. */
  order: PurchaseOrderSummary | null;
  rows: InboundScheduleLine[];
  isLoading: boolean;
  storageLocationNameOf: (code: string | null) => string;
  /** 품목 조건으로 찾았으면 그 품목. 그 라인을 강조한다. */
  matchedItemId: number | null;
  /**
   * 라인마다 연결할 수 있는 · 이미 연결된 초과분(`excess-match.ts`). 비었으면 「초과분」 열을 세우지 않는다 —
   * 드문 일이라 늘 칸을 먹지 않는다(사용자 지시 2026-10-21 「자주 쓰지 않는 일은 눈에 띄지 않게」).
   */
  lineExcesses?: ReadonlyMap<number, LineExcesses>;
  /** 초과분 연결 창을 그 초과분·라인을 고른 채로 연다. */
  onOpenExcess?: (entry: Partial<ExcessEntry>) => void;
  /**
   * 라인 표에서 바로 받는 입하(사용자 지시 2026-10-24 · PDA 「라벨 미부착 일괄 입하」와 같은 길). 없으면(등록 권한 없음)
   * 체크 열 · 행 편집 · 등록 단추가 서지 않는다.
   */
  receive?: {
    draft: ReceiveDraft;
    /** 보내는 중 — 단추 · 체크를 잠근다. */
    isSaving: boolean;
    /** 체크한 줄을 확인 창으로. */
    onSubmitChecked: () => void;
    /** 편집 중인 줄을 확인 창으로. */
    onSubmitEdit: () => void;
  };
  /**
   * 라인별 LOT 진행(`stage.ts` `progressByLine` · 계약 대기). **`undefined` 면 앞선 서버거나 조회 전**이라
   * 라인만 선다 — 접기 손잡이·「다음 할 일」 열도 없다. 빈 Map 은 「LOT 이 없다」다.
   */
  lots?: ReadonlyMap<number, InboundLotProgress[]>;
  /** 진행 조회가 실패했다(404·403 은 아님) — 라인은 그대로 두고 한 줄로 알린다. */
  progressFailed?: boolean;
  /** 표 위에 서는 한 줄(IQC 의뢰 결과 · 실패 배너). */
  notice?: ReactNode;
  /** 보내는 중인 IQC 의뢰의 LOT. 그 단추만 돈다. */
  requestingLotId?: number | null;
  /** LOT 줄의 「입고 처리」 — 없으면(권한 없음) 세우지 않는다. */
  onPostReceipt?: (lot: IssuedLotProgress) => void;
  /** LOT 줄의 「IQC 의뢰 요청」. */
  onRequestIqc?: (lot: IssuedLotProgress) => void;
}

const NO_LINE_EXCESSES: ReadonlyMap<number, LineExcesses> = new Map();

/**
 * LOT 줄의 No. ~ 발주 수량 네 칸을 **한 칸으로 합친다**(사용자 지시 2026-10-24 — LOT 번호와 근거가 품목명 칸에서 잘렸다).
 * 표 부품은 본문 칸 병합을 모른다 — 그린 뒤에 LOT 줄 첫 칸에 `colSpan` 을 걸고 나머지 셋을 감춘다(감춘 칸은 표 격자에서
 * 자리를 차지하지 않는다). 줄 열쇠가 라인과 LOT 로 갈려 한 줄 요소가 다른 종류로 바뀌지 않는다. 접기 · 정렬로 줄이 새로
 * 생기므로 그릴 때마다 다시 건다(줄 200개 안팎 — 가볍다).
 */
const useMergedLotCells = (
  boxRef: RefObject<HTMLDivElement | null>,
  first: number,
  last: number,
): void => {
  useLayoutEffect(() => {
    const box = boxRef.current;

    if (box === null || first < 0 || last <= first) return;

    for (const row of box.querySelectorAll<HTMLTableRowElement>('tbody tr')) {
      const isLot = row.querySelector('[data-lot-row]') !== null;
      const head = row.cells.item(first);

      if (head === null) continue;

      head.colSpan = isLot ? last - first + 1 : 1;

      for (let index = first + 1; index <= last; index += 1) {
        const cell = row.cells.item(index);

        if (cell !== null) cell.hidden = isLot;
      }
    }
  });
};

/** 「상태」 열의 정렬 순서 — 입하 흐름 순서(미착수 → 부분 입하 → 입하 완료 → 취소). 모르는 코드는 맨 뒤. */
const RECEIPT_STATUS_ORDER: Readonly<Record<string, number>> = {
  NOT_STARTED: 0,
  PARTIAL: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

/**
 * 정렬할 수 있는 열과 그 비교 값 — **발주 라인으로 정렬한다**(LOT 줄은 제 라인을 따라가고, 한 라인 안은 입하 순 그대로).
 * 계층 열(접기 손잡이)과 「초과분」 열(단추 칸)은 정렬하지 않는다.
 */
const lineSortAccessors = (
  storageLocationNameOf: (code: string | null) => string,
): SortAccessors<InboundScheduleLine> => ({
  receiptStatusCode: (line) => RECEIPT_STATUS_ORDER[line.receiptStatusCode] ?? null,
  lineNo: (line) => line.lineNo,
  itemCode: (line) => line.itemCode,
  itemName: (line) => line.itemName,
  orderedQty: (line) => line.orderedQty,
  receivedQty: (line) => line.receivedQty,
  remainingQty: (line) => line.remainingQty,
  uomCode: (line) => line.uomCode,
  erpStorageLocationCode: (line) =>
    line.erpStorageLocationCode === null
      ? null
      : storageLocationNameOf(line.erpStorageLocationCode),
});
const NO_COLLAPSED: ReadonlySet<number> = new Set();

const te = messages.inboundSchedule.excess;

/**
 * 「초과분」 칸 — 이 줄에 연결할 수 있는 초과분이 있으면 「500 연결」, 이미 연결했으면 「500 연결됨」.
 * 누르면 연결 창이 그 초과분과 이 줄을 고른 채로 열린다 — 사람은 「연결」만 누른다.
 */
const ExcessCell = ({
  row,
  excesses,
  onOpen,
}: {
  row: InboundScheduleLine;
  excesses: LineExcesses;
  onOpen: (entry: Partial<ExcessEntry>) => void;
}) => {
  const first = excesses.linkable[0];
  if (first !== undefined) {
    const qty =
      excesses.linkable.length === 1
        ? `${formatQty(first.excessQty)} ${first.uomCode}`
        : `${String(excesses.linkable.length)}건`;

    return (
      <Button
        variant="outlined"
        size="sm"
        aria-label={te.lineLinkableLabel(row.lineNo, qty)}
        onClick={() => {
          onOpen({
            excessId: excesses.linkable.length === 1 ? first.inboundReceiptExcessId : null,
            purchaseOrderLineId: row.purchaseOrderLineId,
          });
        }}
      >
        {te.lineLinkable(qty)}
      </Button>
    );
  }

  const linked = excesses.linked[0];
  if (linked === undefined) return null;
  const qty = `${formatQty(linked.excessQty)} ${linked.uomCode}`;

  return (
    <Button
      variant="text"
      size="sm"
      aria-label={te.lineLinkedLabel(row.lineNo, qty)}
      onClick={() => {
        onOpen({ tab: 'linked', excessId: linked.inboundReceiptExcessId });
      }}
    >
      {te.lineLinked(qty)}
    </Button>
  );
};

/** 발주 머리의 「진행」 — 수가 있는 묶음을 흐름 순서로. LOT 이 없으면 미착수는 「입하 전」, 아니면 「—」. */
const OrderProgress = ({ order }: { order: PurchaseOrderSummary }) => {
  const counts = order.inboundStageCounts;

  if (counts === undefined) return null;

  const groups = presentGroups(counts);

  if (groups.length === 0) {
    return (
      <div>
        <dt>{t.table.progress}</dt>
        <dd>
          {order.receiptStatusCode === 'NOT_STARTED' ? t.stage.beforeReceipt : t.values.empty}
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt>{t.table.progress}</dt>
      <dd>
        <span className="po-board-progress">
          {groups.map((group) => (
            <StageGroupChip key={group} group={group} count={counts[group]} />
          ))}
        </span>
      </dd>
    </div>
  );
};

/**
 * 오른쪽 표 — **고른 P/O 의 라인 전부**(다 들어온 것·취소된 것 포함 — 상태 칸이 가른다).
 * 이름 칸이 라인에 함께 와(server #762) 품목·단위를 따로 부르지 않는다.
 *
 * **라인 아래에 LOT 줄이 딸린다**(사용자 지시 2026-10-22 · 입고 관리). 서버가 진행 자료를 주면(`lots`) 라인마다 그 라인에서
 * 나온 LOT 이 한 단 낮은 줄로 서고, 첫 칸의 안내선이 계층을 보인다. 라인의 손잡이가 그 라인의 LOT 을, 머리칸의 손잡이가
 * 전부를 접고 편다. 접힘은 이 부품의 상태다 — 발주가 바뀌면 다 펼친 채로 돌아간다(주소에 싣지 않는다 — 접을 때마다 뒤로가기
 * 기록이 늘어서는 안 된다).
 *
 * 「입하 등록」은 **표 위에 한 번만** 둔다 — 발주 단위의 일이라 줄마다 되풀이할 까닭이 없다.
 *
 * 아래는 기본 폭이다 — 머리칸 오른쪽 끝을 끌어 바꿀 수 있다(`patterns/column-resize.tsx`).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 계층 | 48px · 진행 자료가 있을 때만 | 접기 손잡이 24px + 여백. LOT 줄은 안내선. 머리칸은 「LOT 모두 접기」 |
 * | 상태 | 84px | 칩 「부분 입하」 64px + 여백. LOT 줄은 단계 칩. 지연 칩은 두지 않는다(아래 상태 열 주석) |
 * | 라인 | 48px | 세 자리 + 여백. **LOT 줄은 여기부터 발주 수량까지 네 칸을 합쳐** LOT 번호(그대로) + 근거(입하일 · 검사 · 입고 · 적치)를 낸다 |
 * | 품목코드 | 120px | 10자 ASCII + 여백 |
 * | **품목명** | **미지정** | 남는 폭을 흡수한다. 넘치면 말줄임 |
 * | 발주·입하·남은 수량 | 88px × 3 | 천 단위 7자 + 여백. LOT 줄은 입하 수량만 |
 * | 단위 | 56px | 코드 3자 + 여백 |
 * | 창고 | 184px | 「VICT 자재창고_…」 같은 긴 이름 + 여백. 넘치면 말줄임(전체는 마우스를 올리면). **LOT 줄은 적치된 위치, 아직 없으면 다음 할 일**(「입고 처리」·「IQC 의뢰 요청」 단추 · 「PDA에서 적치」) — 열을 하나 더 세우면 1920 폭에서 품목명 칸이 사라진다 |
 * | 합 | 756px + 흡수 (진행 자료가 있으면 804px) | `.po-board-lines` 최소 폭은 `max(48rem + 늘린 폭, 고정 폭 합)` |
 */
export const LineTable = ({
  order,
  rows,
  isLoading,
  storageLocationNameOf,
  matchedItemId,
  lineExcesses = NO_LINE_EXCESSES,
  onOpenExcess,
  receive,
  lots,
  progressFailed = false,
  notice,
  requestingLotId = null,
  onPostReceipt,
  onRequestIqc,
}: LineTableProps) => {
  const isTree = lots !== undefined;

  /**
   * 열 정렬 — 머리칸을 누를 때마다 오름 → 내림 → 해제. 이 부품의 상태다(주소에 싣지 않는다 — 누를 때마다 뒤로가기
   * 기록이 늘어서는 안 된다). 발주를 바꿔도 남는다 — 같은 기준으로 여러 발주를 훑어보는 일이 많다.
   */
  const [sort, setSort] = useState<SortState | null>(null);

  /** 접은 라인(라인 번호). 발주가 바뀌면 비운다 — 앞 발주의 접힘이 다음 발주에 남지 않는다. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(NO_COLLAPSED);
  const orderId = order?.purchaseOrderId ?? null;

  useEffect(() => {
    setCollapsed(NO_COLLAPSED);
  }, [orderId]);

  const withLots = linesWithLots(rows, lots);
  const isAllCollapsed = withLots.length > 0 && withLots.every((id) => collapsed.has(id));

  const toggleAll = (): void => {
    setCollapsed(isAllCollapsed ? NO_COLLAPSED : new Set(withLots));
  };

  const toggleLine = (purchaseOrderLineId: number): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(purchaseOrderLineId)) next.delete(purchaseOrderLineId);
      else next.add(purchaseOrderLineId);

      return next;
    });
  };

  const sortedLines = sortRows(rows, sort, lineSortAccessors(storageLocationNameOf));
  const tableRows = toLineTableRows(sortedLines, lots, collapsed);

  const draft = receive?.draft;
  const editingId = draft?.editing?.purchaseOrderLineId ?? null;
  const isChecked = (line: InboundScheduleLine): boolean =>
    draft !== undefined && draft.checked.has(line.purchaseOrderLineId);
  /** 편집 중인 줄의 이번 수량 — 맞지 않으면 `null`(미리 보기를 내지 않는다). */
  const editingQty =
    draft?.editing == null
      ? null
      : (() => {
          const qty = checkQty(draft.editing.qtyText);

          return qty.kind === 'qty' ? qty.value : null;
        })();

  const columns: Column<LineTableRow>[] = [
    /*
     * 체크 열 — 체크한 품목은 남은 수량 그대로 한꺼번에 받는다(PDA 와 같다). 받을 것이 남은 줄만 체크할 수 있고, 머리칸의
     * 「모두 선택」은 부분 입하 줄을 뺀다. 권한이 없으면 이 열이 없다.
     */
    ...(draft !== undefined
      ? [
          {
            key: 'check',
            header: (
              <input
                type="checkbox"
                className="po-board-check"
                aria-label={t.receive.selectAll}
                checked={draft.allChecked}
                ref={(node) => {
                  if (node !== null) node.indeterminate = draft.someChecked && !draft.allChecked;
                }}
                disabled={receive?.isSaving === true || !rows.some(isCheckable)}
                onChange={draft.toggleAll}
              />
            ),
            width: '40px',
            render: (row: LineTableRow) =>
              row.kind === 'line' ? (
                <input
                  type="checkbox"
                  className="po-board-check"
                  aria-label={t.receive.selectRow(row.line.lineNo)}
                  checked={isChecked(row.line)}
                  disabled={receive?.isSaving === true || !isCheckable(row.line)}
                  onChange={() => {
                    draft.toggle(row.line.purchaseOrderLineId);
                  }}
                />
              ) : null,
          } satisfies Column<LineTableRow>,
        ]
      : []),
    /*
     * 계층 열 — 라인의 접기 손잡이와 LOT 줄의 안내선(사이드바 묶음과 같은 모양). 머리칸에는 「LOT 모두 접기」 손잡이가 선다.
     * 상태 열과 나눴다 — 머리칸이 정렬 단추가 되면 그 안에 손잡이(단추)를 둘 수 없다(사용자 지시 2026-10-24 상태 열 정렬).
     * 진행 자료가 없으면(앞선 서버) 이 열이 없다.
     */
    ...(isTree
      ? [
          {
            key: 'tree',
            header:
              withLots.length > 0 ? (
                <TreeToggle
                  isExpanded={!isAllCollapsed}
                  label={isAllCollapsed ? t.actions.expandAll : t.actions.collapseAll}
                  onToggle={toggleAll}
                />
              ) : null,
            width: '48px',
            render: (row: LineTableRow) =>
              row.kind === 'lot' ? (
                <TreeGuide isLast={row.isLast} />
              ) : row.lots.length > 0 ? (
                <TreeToggle
                  isExpanded={row.isExpanded}
                  label={
                    row.isExpanded
                      ? t.actions.collapseLine(row.line.lineNo)
                      : t.actions.expandLine(row.line.lineNo)
                  }
                  onToggle={() => {
                    toggleLine(row.line.purchaseOrderLineId);
                  }}
                />
              ) : (
                <span className="po-board-tree-spacer" aria-hidden="true" />
              ),
          } satisfies Column<LineTableRow>,
        ]
      : []),
    {
      key: 'receiptStatusCode',
      sortable: true,
      header: t.table.receiptStatus,
      width: '84px',
      /*
       * **지연 칩을 두지 않는다.** 납기는 발주 헤더의 값이라 한 발주의 라인은 모두 같이 늦다 — 줄마다
       * 되풀이하면 뜻 없이 칸만 먹는다. 지연은 왼쪽 표의 발주 줄이 말한다.
       */
      render: (row) =>
        row.kind === 'lot' ? (
          <StageChip code={row.lot.stageCode} />
        ) : (
          <span className="po-board-tree-cell">
            <ReceiptStatusCell code={row.line.receiptStatusCode} overdue={false} />
            {/* 품목으로 찾은 라인 표식 — 줄 배경이 따라간다(app.css `tr:has([data-matched])`). */}
            {matchedItemId === row.line.itemId && (
              <span className="erp-data-table-caption" data-matched="true">
                {t.values.matchedLine}
              </span>
            )}
          </span>
        ),
    },
    {
      key: 'lineNo',
      sortable: true,
      header: t.table.lineNo,
      width: '48px',
      align: 'end',
      /* LOT 줄은 이 칸에서 발주 수량 칸까지 합쳐(`useMergedLotCells`) LOT 번호와 근거를 낸다. */
      render: (row) => (row.kind === 'line' ? row.line.lineNo : <LotMainCell lot={row.lot} />),
    },
    {
      key: 'itemCode',
      sortable: true,
      header: t.table.itemCode,
      width: '120px',
      /*
       * 행을 눌러 그 품목만 받는다(PDA 의 품목 누름과 같다) — 키보드는 이 단추가 받는다. 행 어디를 눌러도 같다(표 상자가
       * 받는다). 편집 중인 줄은 `data-receive-editing` 으로 알려 줄 바탕이 바뀐다.
       */
      render: (row) => {
        if (row.kind !== 'line') return '';
        if (draft === undefined || !isEditable(row.line)) return orEmpty(row.line.itemCode);

        return (
          <button
            type="button"
            className="link-cell"
            aria-label={t.receive.editRow(orEmpty(row.line.itemCode))}
            aria-pressed={editingId === row.line.purchaseOrderLineId}
            data-receive-line={row.line.purchaseOrderLineId}
            {...(editingId === row.line.purchaseOrderLineId
              ? { 'data-receive-editing': 'true' }
              : {})}
            onClick={() => {
              draft.startEdit(row.line);
            }}
          >
            {orEmpty(row.line.itemCode)}
          </button>
        );
      },
    },
    {
      key: 'itemName',
      sortable: true,
      header: t.table.itemName,
      render: (row) => (row.kind === 'line' ? <OneLine text={orEmpty(row.line.itemName)} /> : ''),
    },
    {
      key: 'orderedQty',
      sortable: true,
      header: t.table.orderedQty,
      width: '88px',
      align: 'end',
      render: (row) => (row.kind === 'line' ? formatQty(row.line.orderedQty) : ''),
    },
    {
      key: 'receivedQty',
      sortable: true,
      header: t.table.receivedQty,
      width: '88px',
      align: 'end',
      /*
       * 체크한 줄은 **등록하면 될 수**(누적 + 남은 수량)를 파랗게 미리 보인다(PDA 와 같다). 편집 중인 줄은 이번 수량 입력칸이다.
       */
      render: (row) => {
        if (row.kind === 'lot') return formatQty(row.lot.receivedQty);
        if (draft?.editing != null && editingId === row.line.purchaseOrderLineId) {
          const qty = checkQty(draft.editing.qtyText);

          return (
            <input
              type="text"
              inputMode="decimal"
              className="po-board-receive-qty"
              aria-label={t.receive.qtyLabel(row.line.lineNo)}
              aria-invalid={qty.kind !== 'qty'}
              value={draft.editing.qtyText}
              disabled={receive?.isSaving === true}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- 행을 눌러 연 입력칸이라 바로 친다
              autoFocus
              onChange={(event) => {
                draft.changeQty(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') receive?.onSubmitEdit();
                if (event.key === 'Escape') draft.cancelEdit();
              }}
            />
          );
        }
        if (isChecked(row.line)) {
          return (
            <span className="po-board-filled">
              {formatQty(row.line.receivedQty + row.line.remainingQty)}
            </span>
          );
        }

        return formatQty(row.line.receivedQty);
      },
    },
    {
      key: 'remainingQty',
      sortable: true,
      header: t.table.remainingQty,
      width: '88px',
      align: 'end',
      /* 체크한 줄은 0, 편집 중인 줄은 이번 수량을 받은 뒤의 남은 수량과 초과분을 파랗게 미리 보인다. */
      render: (row) => {
        if (row.kind !== 'line') return '';
        if (editingId === row.line.purchaseOrderLineId) {
          if (editingQty === null) return formatQty(row.line.remainingQty);
          const { normalQty, excessQty } = splitReceiveQty(row.line, editingQty);

          return (
            <span className="po-board-filled">
              {formatQty(Math.max(row.line.remainingQty - normalQty, 0))}
              {excessQty > 0 && (
                <span className="po-board-excess-tag">
                  {t.receive.excessTag(formatQty(excessQty))}
                </span>
              )}
            </span>
          );
        }
        if (isChecked(row.line)) return <span className="po-board-filled">{formatQty(0)}</span>;

        return formatQty(row.line.remainingQty);
      },
    },
    /* 「초과분」은 수량 바로 뒤 — 표가 넓어 끝에 두면 가로 스크롤 밖으로 밀린다. */
    ...(lineExcesses.size > 0 && onOpenExcess !== undefined
      ? [
          {
            key: 'excess',
            header: te.lineColumn,
            width: '120px',
            render: (row: LineTableRow) =>
              row.kind === 'line' ? (
                <ExcessCell
                  row={row.line}
                  excesses={lineExcessesOf(lineExcesses, row.line.purchaseOrderLineId)}
                  onOpen={onOpenExcess}
                />
              ) : null,
          } satisfies Column<LineTableRow>,
        ]
      : []),
    {
      key: 'uomCode',
      sortable: true,
      header: t.table.uom,
      width: '56px',
      render: (row) => (row.kind === 'line' ? orEmpty(row.line.uomCode) : row.lot.uomCode),
    },
    {
      key: 'erpStorageLocationCode',
      sortable: true,
      header: t.table.storageLocation,
      width: '184px',
      /* LOT 줄 — 이미 자리가 있으면(적치·임시 적치) 그 위치, 아직 없으면 다음 할 일(서버가 정한 것만 · C-17). */
      render: (row) => {
        if (row.kind === 'line') {
          /* 편집 중인 줄은 이 칸에 등록 · 취소가 선다 — 같은 줄 끝이라 눈이 따라간다. */
          if (draft !== undefined && editingId === row.line.purchaseOrderLineId) {
            return (
              <span className="po-board-receive-actions">
                <Button
                  size="sm"
                  disabled={editingQty === null}
                  loading={receive?.isSaving === true}
                  onClick={() => {
                    receive?.onSubmitEdit();
                  }}
                >
                  {t.receive.submitRow}
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  disabled={receive?.isSaving === true}
                  onClick={draft.cancelEdit}
                >
                  {t.receive.cancelRow}
                </Button>
              </span>
            );
          }

          return <OneLine text={storageLocationNameOf(row.line.erpStorageLocationCode)} />;
        }

        const location = lotLocation(row.lot);

        return location !== '' ? (
          <OneLine text={location} />
        ) : (
          <LotActionCell
            lot={row.lot}
            requestingLotId={requestingLotId}
            {...(onPostReceipt === undefined ? {} : { onPostReceipt })}
            {...(onRequestIqc === undefined ? {} : { onRequestIqc })}
          />
        );
      },
    },
  ];
  const resizable = useColumnWidths('omf-mes:inbound-schedule:columns:lines', columns);
  const tableBoxRef = useRef<HTMLDivElement>(null);

  useMergedLotCells(
    tableBoxRef,
    columns.findIndex((column) => column.key === 'lineNo'),
    columns.findIndex((column) => column.key === 'orderedQty'),
  );

  if (order === null) {
    return (
      <EmptyState size="sm" title={t.empty.noOrderTitle} description={t.empty.noOrderDescription} />
    );
  }

  return (
    <>
      {/*
       * 발주 머리(사용자 지시 2026-10-21 — 「밋밋하다」). 이름표 + 값의 칸을 구분선으로 나눠 세운다.
       * 발주번호도 다른 값과 같은 글자다 — 상태는 왼쪽 표가 말한다.
       */}
      <header className="po-board-order-head">
        <div className="po-board-order-title">
          <span className="po-board-order-eyebrow">{t.detail.purchaseOrderNo}</span>
          <span className="po-board-order-no">{order.purchaseOrderNo}</span>
        </div>
        <dl className="po-board-order-facts">
          <div>
            <dt>{t.detail.supplierCode}</dt>
            <dd>{orEmpty(order.supplierCode)}</dd>
          </div>
          <div>
            <dt>{t.detail.supplierName}</dt>
            <dd>{orEmpty(order.supplierName)}</dd>
          </div>
          <div>
            <dt>{t.detail.expectedReceiptDate}</dt>
            <dd>
              {order.expectedReceiptDate == null
                ? t.values.noDueDate
                : formatDate(order.expectedReceiptDate)}
            </dd>
          </div>
          <div>
            <dt>{t.detail.orderDate}</dt>
            <dd>{formatDate(order.orderDate)}</dd>
          </div>
          <div>
            <dt>{t.table.openLines}</dt>
            <dd>
              {typeof order.openLineCount === 'number' && typeof order.lineCount === 'number'
                ? t.values.lineRatio(order.openLineCount, order.lineCount)
                : t.values.empty}
            </dd>
          </div>
          <OrderProgress order={order} />
        </dl>
        {/*
         * 체크한 품목을 한꺼번에 받는다 — 옛 「입하 등록」 창을 걷고 이 자리에 섰다(사용자 지시 2026-10-24). 체크한 수는 옆
         * 글자가 말하고, 체크가 없으면 잠긴다. 취소된 발주는 더 받을 것이 없어 세우지 않는다.
         */}
        {receive !== undefined && order.receiptStatusCode !== 'CANCELLED' && (
          <div className="po-board-order-actions">
            <span className="po-board-checked-count" aria-live="polite">
              {t.receive.checkedCount(receive.draft.checked.size)}
            </span>
            <Button
              size="sm"
              disabled={receive.draft.checked.size === 0}
              loading={receive.isSaving && editingId === null}
              onClick={receive.onSubmitChecked}
            >
              {t.receive.submit}
            </Button>
          </div>
        )}
      </header>

      {isLoading ? (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          {notice}
          {draft?.note != null && (
            <p className="field-note" role="status">
              {draft.note}
            </p>
          )}
          {progressFailed && (
            <p className="field-note" role="status">
              {t.lot.loadFailed}
            </p>
          )}
          {/*
           * **행 어디를 눌러도 그 품목을 받기 시작한다**(PDA 의 품목 누름과 같다). 표 부품에 줄 클릭이 없어 감싼 상자가 받는다 —
           * 누른 줄의 품목코드 단추(`data-receive-line`)로 어느 줄인지 안다. 단추 · 입력칸 · 체크를 누른 것은 그쪽이 받는다.
           */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            ref={tableBoxRef}
            className="wide-table po-board-table po-board-lines"
            style={resizable.style}
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('button, input, a, label, select, textarea') !== null) return;
              const marker = target
                .closest('tbody tr')
                ?.querySelector<HTMLElement>('[data-receive-line]');
              const id = Number(marker?.dataset.receiveLine);
              const line = rows.find((each) => each.purchaseOrderLineId === id);
              if (line !== undefined) draft?.startEdit(line);
            }}
          >
            <Table
              density="compact"
              caption={<span className="erp-data-table-caption">{t.panes.lines}</span>}
              columns={resizable.columns}
              rows={tableRows}
              getRowId={lineTableRowId}
              /* 제어 정렬 — 부품은 받은 순서대로 그린다. 정렬은 위에서 라인 단위로 마쳤다(LOT 줄이 제 라인을 따라간다). */
              sort={sort}
              onSortChange={setSort}
              empty={<EmptyState size="sm" title={t.empty.noLinesTitle} />}
            />
          </div>
        </>
      )}
    </>
  );
};
