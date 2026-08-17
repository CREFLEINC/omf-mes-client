import { Button, Chip, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { SourceLineView, SourceReceiptView } from './types';

const t = messages.poRegister;

export interface SourceReceiptPaneProps {
  receipt: SourceReceiptView;
  lines: SourceLineView[];
  /** 대상으로 확정된 줄. 라인이 한 줄뿐이면 고르지 않아도 확정된다(계획 결정 4) */
  chosenLineId: number | null;
  supplierLookup: ReferenceSource;
  plantLookup: ReferenceSource;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  onChoose: (inboundReceiptLineId: number) => void;
  onRetryReferences: () => void;
}

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

/**
 * 넘어온 초과분 — **읽기 전용 구획이다.**
 *
 * 여기서 고치는 것은 없다. 무엇을 정산하는지 밝히고, 라인이 여럿이면 **어느 줄을 승계할지만**
 * 고르게 한다. 값을 고칠 수 있게 보이면 사용자가 이 화면에서 입하를 고칠 수 있다고 읽는다.
 *
 * **「이것이 초과분인가」를 판정하지 않는다**(계획 결정 3). 계약이 그 사실을 내려주지 않으므로
 * 표식·거르기·경고 어느 것도 지어내지 않고, 넘어온 전표를 그대로 보인다.
 *
 * **줄을 자동으로 고르지 않는다.** 여러 줄 중 첫 줄을 화면이 고르면 사용자가 확인하지 않은
 * 선택이 되돌릴 수 없는 전표에 실린다.
 */
export const SourceReceiptPane = ({
  receipt,
  lines,
  chosenLineId,
  supplierLookup,
  plantLookup,
  itemLookup,
  uomLookup,
  onChoose,
  onRetryReferences,
}: SourceReceiptPaneProps) => {
  /** 고를 것이 있는가. 한 줄뿐이면 고르는 버튼을 두지 않는다 — 누를 이유가 없는 버튼이다. */
  const isChoosable = lines.length > 1;

  const summary: SummaryItem[] = [
    { key: 'inboundReceiptNo', label: t.source.inboundReceiptNo, value: receipt.inboundReceiptNo },
    {
      key: 'supplier',
      label: t.source.supplier,
      value: describeReference(toReference(supplierLookup, receipt.supplierId)),
    },
    {
      key: 'plant',
      label: t.source.plant,
      value: describeReference(toReference(plantLookup, receipt.plantId)),
    },
    {
      key: 'status',
      label: t.source.status,
      /* 값으로 분기하지 않고 서버가 준 코드를 그대로 보인다(공유계약 G-2). */
      value: (
        <Chip variant="status" size="sm">
          {receipt.statusCode}
        </Chip>
      ),
    },
  ];

  /**
   * 열 폭. 지정 합은 552px이고 흡수 열(품목)이 나머지를 가져간다 —
   * `.wide-table`의 하한(58rem = 928px) 안에서 품목이 376px을 받는다.
   */
  const columns: Column<SourceLineView>[] = [
    {
      key: 'lineNo',
      header: t.source.lineNo,
      align: 'end',
      width: '72px',
      render: (row) => row.lineNo,
    },
    {
      key: 'item',
      header: t.source.item,
      render: (row) => describeReference(toReference(itemLookup, row.itemId)),
    },
    {
      key: 'receivedQty',
      header: t.source.receivedQty,
      align: 'end',
      width: '160px',
      render: (row) => row.receivedQty,
    },
    {
      key: 'uom',
      header: t.source.uom,
      width: '160px',
      render: (row) => describeReference(toReference(uomLookup, row.uomId)),
    },
    {
      key: 'choose',
      header: t.source.choose,
      width: '160px',
      /*
       * 고른 줄에는 버튼 대신 표식을 둔다 — 이미 대상인 줄을 다시 누르는 조작에는 뜻이 없고,
       * 무엇이 대상인지는 표식이 더 곧게 말한다.
       */
      render: (row) =>
        row.inboundReceiptLineId === chosenLineId || !isChoosable ? (
          <Chip variant="status" status="info" size="sm">
            {t.source.chosen}
          </Chip>
        ) : (
          <Button
            variant="outlined"
            size="sm"
            aria-label={t.source.chooseRow(row.lineNo)}
            onClick={() => {
              onChoose(row.inboundReceiptLineId);
            }}
          >
            {t.source.choose}
          </Button>
        ),
    },
  ];

  const hasReferenceError =
    supplierLookup.isError || plantLookup.isError || itemLookup.isError || uomLookup.isError;

  return (
    <>
      {/* 값 표기다 — 폼 컨트롤을 잠그지 않는다(배치 규범 3). */}
      <div role="group" aria-label={t.source.label}>
        <dl className="filter-bar">
          {summary.map((item) => (
            <div className="field-cell" key={item.key}>
              <dt className="field-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={lines}
          getRowId={(row) => String(row.inboundReceiptLineId)}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.noSourceLinesTitle}
              description={t.empty.noSourceLinesDescription}
            />
          }
        />
      </div>

      {lines.length > 0 && (
        <p className="field-note">{isChoosable ? t.source.inheritNote : t.source.singleLineNote}</p>
      )}

      {hasReferenceError && (
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
