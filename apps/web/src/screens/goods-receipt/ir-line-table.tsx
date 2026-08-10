import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { describeLineSelect } from './line-select';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import { formatDateTime, type IrLineView, type IrView } from './types';

const t = messages.goodsReceipt;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 자재 LOT 칸.
 *
 * **「없다」와 「이름을 못 풀었다」를 가른다.** `lotId`가 `null`인 것은 *아직 LOT이 만들어지지
 * 않았다*는 사실이고, 그것을 참조 풀이에 넘기면 「알 수 없음」으로 나온다 — 그 문구는
 * *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다(#47과 같은 갈래의 오해다).
 * 없는 것은 빈 값 표기로 내고, 왜 고를 수 없는지는 선택 칸의 사유가 말한다.
 */
const lotCell = (lookup: ReferenceSource, lotId: number | null): ReactNode =>
  lotId === null ? t.values.empty : describeReference(toReference(lookup, lotId));

export interface IrLineColumnsInput {
  selectedLineId: number | null;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  lotLookup: ReferenceSource;
  /** 사유 텍스트의 `id` 앞머리. 비활성 버튼과 사유를 `aria-describedby`로 잇는 데 쓴다 */
  reasonIdPrefix: string;
  onToggleSelect: (inboundReceiptLineId: number) => void;
}

/**
 * 입하 라인 표의 열 구성.
 *
 * **단위 열을 따로 두지 않고 수량 표기에 붙인다**(「100 SAMPLE-EA」 — W-01-03이 세운 처리).
 * 열로 만들면 폭이 130px 더 드는데, 단위는 수량을 읽는 순간에만 필요하다.
 *
 * **수입검사 대상·상태는 열이 아니다.** 고른 한 줄에서만 필요한 값이라 표 전체에 열을 낼
 * 이유가 없다 — 열을 늘리는 것보다 줄이는 것이 먼저다(`docs/layout-conventions.md`).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 줄번호 | 64px | 두 자리 수 + 우측정렬 여백 |
 * | **품목** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 입하 수량 | 136px | 수 + 단위 표기(「100 SAMPLE-EA」) |
 * | **자재 LOT** | 176px | LOT 번호 15자 113px + 4갈래 표기(「이름 불러오는 중」)가 들어가는 폭 |
 * | 유효기한 | 120px | `YYYY-MM-DD` 75px + 셀 여백 32px |
 * | 선택 | 128px | `sm` 버튼 + **고를 수 없는 줄의 사유**가 들어간다 |
 * | **지정 폭 합** | **624px** | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **824px** | `58rem`(928px) 안에 들어간다 |
 *
 * 흡수 열이 실제로 받는 폭은 304px(928 − 624)로 예산 200px보다 넓다.
 */
export const buildIrLineColumns = ({
  selectedLineId,
  itemLookup,
  uomLookup,
  lotLookup,
  reasonIdPrefix,
  onToggleSelect,
}: IrLineColumnsInput): Column<IrLineView>[] => [
  {
    key: 'lineNo',
    header: t.lineTable.lineNo,
    align: 'end',
    width: '64px',
  },
  {
    key: 'item',
    header: t.lineTable.item,
    render: (row) => describeReference(toReference(itemLookup, row.itemId)),
  },
  {
    key: 'receivedQty',
    header: t.lineTable.receivedQty,
    align: 'end',
    width: '136px',
    /* **수량을 화면이 고치지 않는다**(계획 결정 4 — 전량 입고라 입력칸이 없다). 그대로 보인다. */
    render: (row) =>
      t.lineTable.receivedQtyPair(
        row.receivedQty,
        describeReference(toReference(uomLookup, row.uomId)),
      ),
  },
  {
    key: 'lot',
    header: t.lineTable.lot,
    width: '176px',
    render: (row) => lotCell(lotLookup, row.lotId),
  },
  {
    key: 'expiryDate',
    header: t.lineTable.expiryDate,
    width: '120px',
    render: (row) => orEmptyMark(row.expiryDate),
  },
  {
    key: 'select',
    header: t.lineTable.select,
    width: '128px',
    /*
     * **고를 수 없는 줄의 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더하고
     * `aria-describedby`로 그 버튼에 잇는다**(배치 규범 4-1). 비활성 버튼은 포커스를 받지 못해
     * 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
     *
     * 사유가 붙는 비활성 버튼은 **테두리가 남는 표현**을 쓴다(규범 4-4) — `outlined`.
     */
    render: (row) => {
      const state = describeLineSelect(row);
      const selected = row.inboundReceiptLineId === selectedLineId;
      /* 줄번호는 한 전표 안에서 유일하다. 내부 번호를 DOM에 남기지 않으려고 이것을 쓴다. */
      const reasonId = `${reasonIdPrefix}-${String(row.lineNo)}`;

      if (state.kind === 'blocked') {
        return (
          <div className="field-cell">
            <Button
              variant="outlined"
              size="sm"
              disabled
              aria-describedby={reasonId}
              aria-label={t.actions.selectLine(row.lineNo)}
            >
              {t.actions.select}
            </Button>
            <span id={reasonId} className="field-note">
              {state.reason}
            </span>
          </div>
        );
      }

      return (
        <Button
          variant="outlined"
          size="sm"
          aria-label={
            selected ? t.actions.deselectLine(row.lineNo) : t.actions.selectLine(row.lineNo)
          }
          onClick={() => {
            onToggleSelect(row.inboundReceiptLineId);
          }}
        >
          {selected ? t.actions.deselect : t.actions.select}
        </Button>
      );
    },
  },
];

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface IrLineTableProps
  extends Omit<IrLineColumnsInput, 'reasonIdPrefix' | 'itemLookup'> {
  /** 고른 입하 전표. 제목줄의 자료는 목록 응답의 행에 이미 있어 상세 경로를 부르지 않는다. */
  inboundReceipt: IrView;
  /**
   * 공급사는 **위 구획이 실패 안내와 복구를 소유**하므로 이름만 받는다.
   * 이 부품에 번호를 문자열로 만드는 자리는 어느 쪽에도 없다.
   */
  supplierName: string;
  rows: IrLineView[];
  isLoading: boolean;
  /**
   * 공장 — **이름이 이 구획의 제목줄에서만 보인다.** 그래서 실패 안내와 다시 시도도
   * 여기가 소유하고, 그러려면 이름이 아니라 참조 자체를 받아 실패 여부를 알아야 한다.
   */
  plantLookup: ReferenceSource;
  itemLookup: ReferenceSource;
  /** 고른 줄. 없으면 아래 제목줄을 그리지 않는다 — 닿을 수 없는 가지를 만들지 않는다. */
  selectedLine: IrLineView | null;
  onRetryReferences: () => void;
}

/**
 * 고른 입하 전표의 제목줄과 라인 표, 그리고 고른 줄의 제목줄.
 *
 * **상세 경로를 부르지 않는다.** 제목줄에 필요한 값은 전부 목록 응답의 행에 들어 있다.
 *
 * **한 줄만 고른다**(계획 결정 3). 그 사실을 표 아래 안내가 밝힌다 — 밝히지 않으면 둘째 줄을
 * 골랐을 때 앞 선택이 풀리는 것이 고장으로 읽힌다.
 *
 * **고를 수 없는 줄이 있다**(계획 결정 5) — 이 화면에서 처음 생긴 형태다. 자재 LOT이 없거나
 * 입하 수량이 0 이하인 줄은 계약이 요구하는 값을 만들 수 없다. 판정은 `line-select.ts`
 * 한 곳이 하고, 표는 그 결과를 그리기만 한다.
 */
export const IrLineTable = ({
  inboundReceipt,
  supplierName,
  rows,
  isLoading,
  plantLookup,
  itemLookup,
  uomLookup,
  lotLookup,
  selectedLineId,
  selectedLine,
  onToggleSelect,
  onRetryReferences,
}: IrLineTableProps) => {
  const reasonIdPrefix = `${useId()}-reason`;

  const columns = buildIrLineColumns({
    selectedLineId,
    itemLookup,
    uomLookup,
    lotLookup,
    reasonIdPrefix,
    onToggleSelect,
  });

  const summary: SummaryItem[] = [
    {
      key: 'inboundReceiptNo',
      label: t.summary.inboundReceiptNo,
      value: inboundReceipt.inboundReceiptNo,
    },
    { key: 'supplier', label: t.summary.supplier, value: supplierName },
    {
      key: 'plant',
      label: t.summary.plant,
      value: describeReference(toReference(plantLookup, inboundReceipt.plantId)),
    },
    {
      key: 'receiptDatetime',
      label: t.summary.receiptDatetime,
      value: formatDateTime(inboundReceipt.receiptDatetime),
    },
    {
      key: 'deliveryNoteNo',
      label: t.summary.deliveryNoteNo,
      value: orEmptyMark(inboundReceipt.deliveryNoteNo),
    },
    {
      key: 'status',
      label: t.summary.status,
      value: (
        <Chip variant="status" size="sm">
          {inboundReceipt.statusCode}
        </Chip>
      ),
    },
  ];

  /**
   * 고른 줄의 제목줄. **수입검사 대상과 상태가 여기서만 보인다** — 표의 열로 내면
   * 지정 폭 합이 표 하한을 넘긴다(계획 §5.5).
   */
  const lineSummary = (line: IrLineView): SummaryItem[] => [
    { key: 'lineNo', label: t.lineSummary.lineNo, value: line.lineNo },
    {
      key: 'item',
      label: t.lineSummary.item,
      value: describeReference(toReference(itemLookup, line.itemId)),
    },
    {
      key: 'receivedQty',
      label: t.lineSummary.receivedQty,
      value: t.lineTable.receivedQtyPair(
        line.receivedQty,
        describeReference(toReference(uomLookup, line.uomId)),
      ),
    },
    { key: 'lot', label: t.lineSummary.lot, value: lotCell(lotLookup, line.lotId) },
    {
      key: 'expiryDate',
      label: t.lineSummary.expiryDate,
      value: orEmptyMark(line.expiryDate),
    },
    {
      key: 'inspectionRequired',
      label: t.lineSummary.inspectionRequired,
      /* 참·거짓을 그대로 낸다 — 「대상 아님」을 빈 칸으로 두면 빠뜨린 것으로 읽힌다. */
      value: line.inspectionRequired ? t.lineSummary.inspectionYes : t.lineSummary.inspectionNo,
    },
    {
      key: 'status',
      label: t.lineSummary.status,
      value: (
        <Chip variant="status" size="sm">
          {line.statusCode}
        </Chip>
      ),
    },
  ];

  /* 이 구획이 이름을 내는 참조 넷 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError =
    itemLookup.isError || uomLookup.isError || lotLookup.isError || plantLookup.isError;

  return (
    <>
      {/*
       * 값 표기다 — 폼 컨트롤을 잠그지 않는다(배치 규범 3). `role="group"`을 명시해
       * 제목줄 전체가 하나의 이름을 갖게 한다.
       */}
      <div role="group" aria-label={t.summary.label}>
        <dl className="filter-bar">
          {summary.map((item) => (
            <div className="field-cell" key={item.key}>
              <dt className="field-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {isLoading ? (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={2} />
        </div>
      ) : (
        <>
          <div className="wide-table">
            <Table
              density="compact"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.inboundReceiptLineId)}
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

          <p className="field-note">{t.notes.singleLineSelect}</p>
        </>
      )}

      {selectedLine !== null && (
        <div role="group" aria-label={t.lineSummary.label}>
          <dl className="filter-bar">
            {lineSummary(selectedLine).map((item) => (
              <div className="field-cell" key={item.key}>
                <dt className="field-label">{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
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
