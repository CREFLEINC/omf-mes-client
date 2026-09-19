import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { describeLineSelect, type LineBlockCause } from './line-select';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import { toStatusTone } from './status-badge';
import { formatDateTime, type IrLineView, type IrView } from './types';

const t = messages.goodsReceipt;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 수량 옆 단위 — **코드만 쓴다**(「1 EA」). 「코드 · 이름」(「EA · 개」)은 같은 뜻을 두 번 적는다.
 * 코드를 모르는 갈래(불러오는 중·목록에 없음·실패)는 참조 풀이의 문구를 그대로 낸다.
 */
const uomCodeOf = (lookup: ReferenceSource, uomId: number): string =>
  lookup.entries.find((entry) => entry.value === String(uomId))?.code ??
  describeReference(toReference(lookup, uomId));

/**
 * 고를 수 없는 줄의 사유 — **원인이 된 칸 안에** 짧은 보조 글자로 둔다(사용자 지시). 비활성 「선택」 단추가
 * `aria-describedby` 로 이 글자를 잇는다(배치 규범 4-1 — 사유는 늘 보이는 DOM 텍스트. 비활성 단추는 초점을
 * 못 받아 툴팁으로는 닿을 수 없다). 경고색을 쓰지 않는다 — 오류가 아니라 아직 조건이 안 된 상태다.
 */
const blockedReasonIn = (
  row: IrLineView,
  cause: LineBlockCause,
  reasonIdPrefix: string,
): ReactNode => {
  const state = describeLineSelect(row);

  return state.kind === 'blocked' && state.cause === cause ? (
    <span id={`${reasonIdPrefix}-${String(row.lineNo)}`} className="goods-receipt-line-cell-reason">
      {state.reason}
    </span>
  ) : null;
};

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
  /**
   * 입고 처리를 보내는 중인가. 참이면 **줄을 바꾸는 길을 닫는다** — 보내는 중에 다른 줄로
   * 옮기면 앞 줄의 처리 결과가 지금 보는 줄의 맥락에 나타난다.
   */
  isLocked: boolean;
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
 * | 줄번호 | 72px | 두 자리 수 |
 * | **품목** | **24%** | 「코드 · 이름」— 가장 넓은 열 |
 * | 입하 수량 | 120px | 수 + 단위 코드(「100 EA」) |
 * | **자재 LOT** | **30%** | (가장 넓다 · 고를 수 없는 사유도 이 칸에 선다) 자재 LOT 번호(`품목|수량|날짜|공급사|번호`) 한 줄 |
 * | 유효기한 | 128px | `YYYY-MM-DD` |
 * | 선택 | 128px | 버튼 + **고를 수 없는 줄의 사유**가 들어간다 |
 *
 * px 합 448px + 비율 54% 가 표 하한 `64rem`(1024px) 안에 든다(448 ≤ 1024 × 0.46).
 * 긴 두 열(품목·자재 LOT)만 비율로 두어 남는 폭이 짧은 열로 몰리지 않게 한다 — 목록 표와 같은 풀이.
 * 모든 칸은 가운데 정렬이다(`app.css` 의 `.goods-receipt-line-table`).
 */
export const buildIrLineColumns = ({
  selectedLineId,
  itemLookup,
  uomLookup,
  lotLookup,
  reasonIdPrefix,
  isLocked,
  onToggleSelect,
}: IrLineColumnsInput): Column<IrLineView>[] => [
  {
    key: 'lineNo',
    header: t.lineTable.lineNo,
    width: '72px',
  },
  {
    key: 'item',
    header: t.lineTable.item,
    width: '24%',
    render: (row) => describeReference(toReference(itemLookup, row.itemId)),
  },
  {
    key: 'receivedQty',
    header: t.lineTable.receivedQty,
    width: '120px',
    /* **수량을 화면이 고치지 않는다**(계획 결정 4 — 전량 입고라 입력칸이 없다). 그대로 보인다. */
    render: (row) => (
      <>
        <span className="goods-receipt-ir-nowrap">
          {t.lineTable.receivedQtyPair(row.receivedQty, uomCodeOf(uomLookup, row.uomId))}
        </span>
        {blockedReasonIn(row, 'qtyNotPositive', reasonIdPrefix)}
      </>
    ),
  },
  {
    key: 'lot',
    header: t.lineTable.lot,
    width: '30%',
    /* 자재 LOT이 없는 줄은 `—` 대신 그 사유 문구만 둔다(사용자 지시). */
    render: (row) => blockedReasonIn(row, 'noLot', reasonIdPrefix) ?? lotCell(lotLookup, row.lotId),
  },
  {
    key: 'expiryDate',
    header: t.lineTable.expiryDate,
    width: '128px',
    render: (row) => <span className="goods-receipt-ir-nowrap">{orEmptyMark(row.expiryDate)}</span>,
  },
  {
    key: 'select',
    /* 머리줄 글자는 화면에서 감춘다(사용자 지시 · 목록 표와 같다). 열 이름은 스크린리더에만 남긴다. */
    header: <span className="goods-receipt-visually-hidden">{t.lineTable.select}</span>,
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
        /* 사유는 표 아래 줄 전체 폭의 라벨로 낸다(사용자 지시) — 칸 안에 두면 행이 여러 줄로 부푼다. */
        return (
          <Button
            variant="outlined"
            disabled
            aria-describedby={reasonId}
            aria-label={t.actions.selectLine(row.lineNo)}
          >
            {t.actions.select}
          </Button>
        );
      }

      return (
        <Button
          variant="outlined"
          disabled={isLocked}
          /* 고른 라인 표시 — 다른 목록 화면과 같은 표식(`aria-current`). `app.css` 가 이 값으로 행을 칠한다. */
          aria-current={selected ? 'true' : undefined}
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

export interface IrLineTableProps extends Omit<
  IrLineColumnsInput,
  'reasonIdPrefix' | 'itemLookup'
> {
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
  isLocked,
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
    isLocked,
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
      /* 목록 표와 같은 색 — 글자는 서버 코드 그대로. */
      value: (
        <Chip variant="status" size="sm" status={toStatusTone(inboundReceipt.statusCode)}>
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
      value: t.lineTable.receivedQtyPair(line.receivedQty, uomCodeOf(uomLookup, line.uomId)),
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

  /*
   * **잘림은 실패와 따로 낸다.** 실패는 「이름을 못 받았다」이고 잘림은 「일부만 받았다」인데,
   * 잘린 목록으로 이름을 풀면 그 뒤의 정상 값이 **「알 수 없음」**으로 찍힌다 —
   * 이 화면 자신이 그 문구를 「값이 잘못됐다는 신호」로 정의해 두었으므로, 밝히지 않으면
   * 사용자가 정상 LOT을 잘못된 값으로 읽는다(#47과 같은 갈래의 오해다).
   *
   * **복구 버튼을 붙이지 않는다** — 다시 불러도 같은 쪽이 온다. 사용자가 할 조치가 없고
   * 알아야 할 사실만 있다.
   */
  const hasTruncatedReference =
    itemLookup.truncated || uomLookup.truncated || lotLookup.truncated || plantLookup.truncated;

  return (
    <>
      {/*
       * 값 표기다 — 폼 컨트롤을 잠그지 않는다(배치 규범 3). `role="group"`을 명시해
       * 제목줄 전체가 하나의 이름을 갖게 한다.
       */}
      <div role="group" aria-label={t.summary.label}>
        <dl className="goods-receipt-summary">
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
          {/* 제목줄(입하 기본정보)과 고르는 자리(라인 표)를 가른다. */}
          <h3 className="goods-receipt-section-title">
            {t.lineTable.title}
            {/* 보조 안내는 제목 옆 같은 줄에 이어 쓴다(사용자 지시) — 한 줄 선택 규칙, 이름 목록 잘림(있을 때만). */}
            <span className="goods-receipt-section-hint">{t.notes.singleLineSelect}</span>
            {hasTruncatedReference && (
              <span className="goods-receipt-section-hint">
                {t.reasons.lineReferencesTruncated}
              </span>
            )}
          </h3>
          <div className="wide-table goods-receipt-line-table">
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
        </>
      )}

      {selectedLine !== null && (
        <div role="group" aria-label={t.lineSummary.label} className="goods-receipt-line-summary">
          {/* 목록이 아니라 선택 결과라는 것을 제목으로 가른다. 이름은 구획의 접근 이름과 같다. */}
          <h3 className="goods-receipt-section-title">
            <span aria-hidden="true">{t.lineSummary.label}</span>
            {/* 이 값들은 폼에서 고치는 것이 아니다 — 선택한 라인 요약 곁에서 밝힌다(사용자 지시). */}
            <span className="goods-receipt-section-hint">{t.notes.qtyFromInboundLine}</span>
          </h3>
          <dl className="goods-receipt-summary goods-receipt-summary-grid">
            {lineSummary(selectedLine).map((item) => (
              <div className={`field-cell goods-receipt-summary-${item.key}`} key={item.key}>
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
