import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  Select,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatDotDate, OneLine } from '../../patterns/po-board';
import type { LotDraft } from './line-draft';
import {
  describeReference,
  toReference,
  type ItemNameLookup,
  type ReferenceSource,
} from './lookups';
import type { SplitLineView } from './split-calc';
import type { PoView, SelectOption } from './types';

const t = messages.overReceiptSplit;

export const formatQty = (value: number): string => value.toLocaleString();

/**
 * 표의 한 줄 — 발주 라인이거나, 그 아래 붙는 LOT 줄이다.
 *
 * **LOT 줄은 수량을 넣은 뒤에만 선다** — 줄 하나에 LOT 하나다(서버 장부 P-100). 발주보다 많이 와도
 * LOT 은 하나이고, 초과 몫은 같은 줄의 「초과분」 칸이 말한다. 받지 않는 줄은 한 줄로 남아 표가 길어지지 않는다.
 * 표 부품에 하위 줄이 없어 같은 열에 평평하게 편다.
 */
export type LineTableRow =
  { kind: 'line'; view: SplitLineView } | { kind: 'lot'; view: SplitLineView };

export const toLineTableRows = (rows: readonly SplitLineView[]): LineTableRow[] =>
  rows.flatMap((view): LineTableRow[] =>
    view.split === null
      ? [{ kind: 'line', view }]
      : [
          { kind: 'line', view },
          { kind: 'lot', view },
        ],
  );

/** React key — 화면에 나오지 않는다. */
export const lineTableRowId = (row: LineTableRow): string =>
  row.kind === 'line'
    ? String(row.view.line.purchaseOrderLineId)
    : `${String(row.view.line.purchaseOrderLineId)}:lot`;

export interface SplitLineColumnsInput {
  itemNames: ItemNameLookup;
  uomLookup: ReferenceSource;
  /** 대체 LOT 사유 선택지(`SUBSTITUTE_LOT_REASON`). */
  lotReasonOptions: SelectOption[];
  /** 보내는 중 — 수량·LOT 입력을 잠근다. */
  isLocked: boolean;
  /**
   * LOT 사유를 칸에 붙일지. **등록을 누른 뒤에만** 붙인다 — 수량을 치는 순간 LOT 칸이 붉어지면
   * 아직 넣지도 않은 칸이 잘못된 것처럼 보인다(머리 입력과 같은 규칙). 기본은 붙인다.
   */
  showLotErrors?: boolean;
  onChangeQty: (purchaseOrderLineId: number, text: string) => void;
  onChangeLot: (purchaseOrderLineId: number, patch: Partial<LotDraft>) => void;
}

interface LotEditorProps {
  lineNo: number;
  lot: LotDraft;
  error: string | null;
  reasonOptions: SelectOption[];
  isLocked: boolean;
  onChange: (patch: Partial<LotDraft>) => void;
}

/**
 * 한 전표 줄의 LOT 입력 — 번호 칸 · 「라벨 없음」 · (번호가 없을 때만) 대체 사유.
 * 세 상태의 뜻은 `lot-format.ts` 의 표에 있다.
 */
const LotEditor = ({ lineNo, lot, error, reasonOptions, isLocked, onChange }: LotEditorProps) => (
  <div className="ors-lot-editor">
    <TextField
      size="sm"
      aria-label={t.lineTable.lotNoLabel(lineNo)}
      placeholder={t.lineTable.lotNoPlaceholder}
      value={lot.lotNo}
      error={error ?? undefined}
      disabled={isLocked}
      autoComplete="off"
      onChange={(event) => {
        onChange({ lotNo: event.target.value });
      }}
    />
    <Checkbox
      checked={lot.labelMissing}
      disabled={isLocked}
      aria-label={t.lineTable.lotMissingLabel(lineNo)}
      onChange={(event) => {
        onChange({
          labelMissing: event.target.checked,
          ...(event.target.checked ? {} : { reasonCode: '' }),
        });
      }}
    >
      {t.lineTable.lotMissing}
    </Checkbox>
    {lot.labelMissing && lot.lotNo.trim() === '' && (
      <Select
        size="sm"
        aria-label={t.lineTable.lotReasonLabel(lineNo)}
        options={reasonOptions}
        value={lot.reasonCode === '' ? null : lot.reasonCode}
        placeholder={t.lineTable.lotReasonPlaceholder}
        disabled={isLocked}
        onChange={(value) => {
          onChange({ reasonCode: value });
        }}
      />
    )}
  </div>
);

/**
 * 열 — 수량은 열마다 따로 선다(천 단위 구분이 있는 두 수를 한 칸에 두지 않는다).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | No. | 48px | 세 자리 + 여백 |
 * | 품목코드 | 120px | 13자 ASCII + 여백. LOT 줄에서는 「공급사 LOT」 머리다 |
 * | **품목명** | **미지정** | 남는 폭을 흡수한다. LOT 줄에서는 LOT 입력이 이 칸에서 시작해 빈 수량 칸 위로 이어진다 |
 * | 발주 · 기입하 | 88px × 2 | 천 단위 7자 + 여백 |
 * | 잔량 (+허용) | 104px | 「5,000 (+0)」 |
 * | 이번 도착 | 112px | 입력칸 + 인라인 사유 |
 * | 단위 | 88px | 「EA · 개」 + 여백 |
 * | P/O 반영 · 초과분 | 88px × 2 | 천 단위 7자 + 여백. 둘의 합이 이번 도착이다 |
 * | 합 | 824px + 흡수 ≥ 160px | `.ors-lines` 최소 폭 `62rem`(992px) |
 */
export const buildSplitLineColumns = ({
  itemNames,
  uomLookup,
  lotReasonOptions,
  isLocked,
  showLotErrors = true,
  onChangeQty,
  onChangeLot,
}: SplitLineColumnsInput): Column<LineTableRow>[] => [
  {
    key: 'lineNo',
    header: t.lineTable.lineNo,
    align: 'end',
    width: '48px',
    render: (row) => (row.kind === 'line' ? row.view.line.lineNo : ''),
  },
  {
    key: 'itemCode',
    header: t.lineTable.itemCode,
    width: '120px',
    render: (row) => {
      if (row.kind === 'lot') return <span className="ors-lot-part">{t.lineTable.lotHead}</span>;
      const detail = itemNames.detail(row.view.line.itemId);

      /* 상세가 아직이면 그 사정(불러오는 중 · 실패 · 없음)을 코드 자리에 낸다 — 번호는 내지 않는다. */
      return detail === null
        ? describeReference(itemNames.of(row.view.line.itemId))
        : detail.itemCode;
    },
  },
  {
    key: 'itemName',
    header: t.lineTable.itemName,
    render: (row) => {
      if (row.kind === 'lot') {
        return (
          <LotEditor
            lineNo={row.view.line.lineNo}
            lot={row.view.lot}
            error={showLotErrors ? row.view.lotError : null}
            reasonOptions={lotReasonOptions}
            isLocked={isLocked}
            onChange={(patch) => {
              onChangeLot(row.view.line.purchaseOrderLineId, patch);
            }}
          />
        );
      }
      const detail = itemNames.detail(row.view.line.itemId);

      return (
        <span className="ors-item-name">
          <OneLine text={detail?.itemName ?? ''} />
          {/* 수입검사 대상 — 서버가 품목 기준정보로 정한다. 보내는 값이 아니라 사실의 표식이다. */}
          {detail?.inspectionRequired === true && (
            <Chip variant="status" status="info" size="sm" title={t.lineTable.iqcTitle}>
              {t.lineTable.iqc}
            </Chip>
          )}
        </span>
      );
    },
  },
  {
    key: 'ordered',
    header: t.lineTable.ordered,
    align: 'end',
    width: '88px',
    render: (row) => (row.kind === 'line' ? formatQty(row.view.line.orderedQty) : ''),
  },
  {
    key: 'received',
    header: t.lineTable.received,
    align: 'end',
    width: '88px',
    render: (row) => (row.kind === 'line' ? formatQty(row.view.line.receivedQty) : ''),
  },
  {
    key: 'remaining',
    header: t.lineTable.remaining,
    align: 'end',
    width: '104px',
    /*
     * 잔량은 **화면이 만든 값이다** — 계약이 내려주는 것은 발주 수량과 누적 입하뿐이다. 괄호 안은 **아직 쓸 수 있는
     * 허용치**다(한도 − 잔량) — 허용치 안에서 이미 더 받은 줄에 처음 허용치를 그대로 보이면 받을 수 없는 수량이
     * 받을 수 있는 것처럼 읽힌다.
     */
    render: (row) =>
      row.kind === 'line'
        ? t.lineTable.remainingPair(
            formatQty(row.view.remainingQty),
            formatQty(Math.max(row.view.normalLimit - row.view.remainingQty, 0)),
          )
        : '',
  },
  {
    key: 'arrivedQty',
    header: t.lineTable.arrivedQty,
    width: '112px',
    /*
     * **표 안의 입력칸.** 보이는 라벨을 둘 자리가 없어 `aria-label`로 준다. 자릿수 경고는
     * 막지 않는 안내라 helper 로 붙인다 — 오류가 있으면 디자인 시스템이 오류 문구로 바꾼다.
     */
    render: (row) =>
      row.kind === 'line' ? (
        <TextField
          type="number"
          size="sm"
          fullWidth
          inputMode="decimal"
          aria-label={t.lineTable.arrivedQtyLabel(row.view.line.lineNo)}
          value={row.view.qtyText}
          error={row.view.qtyError ?? undefined}
          helperText={row.view.qtyWarning ?? undefined}
          disabled={isLocked}
          onChange={(event) => {
            onChangeQty(row.view.line.purchaseOrderLineId, event.target.value);
          }}
        />
      ) : (
        ''
      ),
  },
  {
    key: 'uom',
    header: t.lineTable.uom,
    width: '88px',
    render: (row) =>
      row.kind === 'line' ? (
        <OneLine text={describeReference(toReference(uomLookup, row.view.line.uomId))} />
      ) : (
        ''
      ),
  },
  {
    key: 'normal',
    header: t.lineTable.normal,
    align: 'end',
    width: '88px',
    /* **이 칸의 값을 여기서 계산하지 않는다.** `split-calc.ts`가 가른 결과를 그린다. */
    render: (row) => {
      if (row.kind === 'lot') return '';

      return row.view.split === null ? t.values.notSplit : formatQty(row.view.split.normalQty);
    },
  },
  {
    key: 'excess',
    header: t.lineTable.excess,
    align: 'end',
    width: '88px',
    render: (row) => {
      if (row.kind === 'lot') return '';
      if (row.view.split === null) return t.values.notSplit;

      /* 초과 몫이 있는 줄은 눈에 띄어야 한다 — 이 몫은 P/O 에 넣지 않고 추가 P/O 를 기다린다. */
      return row.view.split.excessQty > 0 ? (
        <Chip variant="status" status="warning" size="sm" data-excess="true">
          {formatQty(row.view.split.excessQty)}
        </Chip>
      ) : (
        formatQty(0)
      );
    },
  },
];

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface SplitLineTableProps extends SplitLineColumnsInput {
  /** 받을 발주 — 머리줄의 값. */
  purchaseOrder: PoView;
  /** 공급사 이름. 실패했으면 그 사실(`supplierFailed`)을 함께 받아 아래 안내와 복구 수단에 넣는다. */
  supplierName: string;
  supplierFailed?: boolean;
  rows: readonly SplitLineView[];
  isLoading: boolean;
  /** 공장 — 이름이 이 구획의 제목줄에서만 보여 실패 안내와 다시 시도도 여기가 소유한다. */
  plantLookup: ReferenceSource;
  /** 표 위의 도구 — 라벨 스캔 칸과 「잔량으로 채우기」. 화면이 들고 있는 상태를 쓴다. */
  toolbar?: ReactNode;
  onRetryReferences: () => void;
}

/**
 * 고른 발주의 머리와 라인 표. **이 화면이 파생값을 그리는 자리다** — 잔량·정량·초과는 화면이 만든 값이다.
 *
 * **상세 경로를 부르지 않는다.** 제목줄에 필요한 값은 전부 목록 응답의 행에 들어 있다.
 */
export const SplitLineTable = ({
  purchaseOrder,
  supplierName,
  supplierFailed = false,
  rows,
  isLoading,
  plantLookup,
  itemNames,
  uomLookup,
  lotReasonOptions,
  isLocked,
  showLotErrors,
  toolbar,
  onChangeQty,
  onChangeLot,
  onRetryReferences,
}: SplitLineTableProps) => {
  const columns = buildSplitLineColumns({
    itemNames,
    uomLookup,
    lotReasonOptions,
    isLocked,
    showLotErrors,
    onChangeQty,
    onChangeLot,
  });

  const summary: SummaryItem[] = [
    { key: 'supplier', label: t.summary.supplier, value: supplierName },
    {
      key: 'plant',
      label: t.summary.plant,
      value: describeReference(toReference(plantLookup, purchaseOrder.plantId)),
    },
    { key: 'orderDate', label: t.summary.orderDate, value: formatDotDate(purchaseOrder.orderDate) },
    {
      key: 'expectedReceiptDate',
      label: t.summary.expectedReceiptDate,
      value:
        purchaseOrder.expectedReceiptDate === null
          ? t.values.empty
          : formatDotDate(purchaseOrder.expectedReceiptDate),
    },
  ];

  /* 이 구획이 이름을 내는 참조 넷 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError =
    supplierFailed || itemNames.isError || uomLookup.isError || plantLookup.isError;

  return (
    <>
      {/*
       * 발주 머리 — 입하 예정 조회의 상세 카드와 같은 모양. 값 표기다 — 폼 컨트롤을 잠그지 않는다
       * (배치 규범 3). `role="group"`으로 머리 전체가 하나의 이름을 갖게 한다.
       */}
      <header className="po-board-order-head" role="group" aria-label={t.summary.label}>
        <div className="po-board-order-title">
          <span className="po-board-order-eyebrow">{t.summary.purchaseOrderNo}</span>
          <span className="po-board-order-no">{purchaseOrder.purchaseOrderNo}</span>
        </div>
        <dl className="po-board-order-facts">
          {summary.map((item) => (
            <div key={item.key}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="ors-section-head">
        <h3 className="ors-section-title">{t.form.linesTitle}</h3>
      </div>

      {toolbar}

      {isLoading ? (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={2} />
        </div>
      ) : (
        <div className="wide-table po-board-table ors-lines">
          <Table
            density="compact"
            columns={columns}
            rows={toLineTableRows(rows)}
            getRowId={lineTableRowId}
            empty={
              <EmptyState
                size="sm"
                live
                title={t.empty.noLinesTitle}
                description={t.empty.noLinesDescription}
              />
            }
          />
        </div>
      )}

      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.lineReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
