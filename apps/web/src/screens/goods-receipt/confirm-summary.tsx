import { messages } from '@omf-mes/i18n';

import type { GoodsReceiptCodeKey } from './types';

const t = messages.goodsReceipt;

export interface SubmitSummary {
  inboundReceiptNo: string;
  lineNo: number;
  itemName: string;
  lotName: string;
  receiptQty: string;
  warehouseName: string;
  locationName: string;
  receiptTypeCode: string;
  sourceDocumentTypeCode: string;
  qualityStatusCode: string;
  inventoryStatusCode: string;
  reasonCode: string;
  receiptDatetime: string;
  remarks: string;
}

export interface ConfirmSummaryProps {
  summary: SubmitSummary;
  /**
   * 코드의 표시 이름 — 공통코드 조회가 준 이름(`nameKo`·`codeName`)을 화면이 넘긴다. 이름이 없으면
   * 코드 그대로다(지어내지 않는다). 보내는 값은 코드 그대로다.
   */
  codeLabel?: (key: GoodsReceiptCodeKey, code: string) => string;
}

interface SummaryRow {
  key: string;
  label: string;
  value: string;
}

const orEmpty = (value: string): string => (value === '' ? t.values.empty : value);

/**
 * 처리 화면 「확정 확인」 단계의 저장될 값 요약(T-W-C 확인 단계 · C-9). 확인 대화상자를 대신한다.
 *
 * 세 묶음으로 가른다: **입고 대상**(입하번호·줄·품목·수량·자재 LOT) → **입고 위치**(창고·위치 — 목적지라
 * 나란히) → **입고 조건**(유형·상태·일시 등 — 보조라 작게). 반영 사항과 되돌릴 수 없다는 안내는
 * 공용 `EffectList`가 맡는다.
 */
export const ConfirmSummary = ({
  summary,
  codeLabel = (_key, code) => code,
}: ConfirmSummaryProps) => {
  const what: SummaryRow[] = [
    { key: 'inboundReceiptNo', label: t.summary.inboundReceiptNo, value: summary.inboundReceiptNo },
    { key: 'lineNo', label: t.lineSummary.lineNo, value: String(summary.lineNo) },
    { key: 'item', label: t.lineSummary.item, value: summary.itemName },
    { key: 'receiptQty', label: t.lineSummary.receivedQty, value: summary.receiptQty },
    { key: 'lot', label: t.lineSummary.lot, value: summary.lotName },
  ];
  const where: SummaryRow[] = [
    { key: 'warehouse', label: t.fields.warehouse, value: summary.warehouseName },
    { key: 'location', label: t.fields.location, value: summary.locationName },
  ];
  const how: SummaryRow[] = [
    {
      key: 'receiptType',
      label: t.fields.receiptType,
      value: codeLabel('receiptType', summary.receiptTypeCode),
    },
    {
      key: 'sourceDocumentType',
      label: t.fields.sourceDocumentType,
      value: codeLabel('sourceDocumentType', summary.sourceDocumentTypeCode),
    },
    {
      key: 'qualityStatus',
      label: t.fields.qualityStatus,
      value: codeLabel('qualityStatus', summary.qualityStatusCode),
    },
    {
      key: 'inventoryStatus',
      label: t.fields.inventoryStatus,
      value: codeLabel('inventoryStatus', summary.inventoryStatusCode),
    },
    { key: 'reason', label: t.fields.reason, value: codeLabel('reason', summary.reasonCode) },
    { key: 'receiptDatetime', label: t.fields.receiptDatetime, value: summary.receiptDatetime },
    { key: 'remarks', label: t.fields.remarks, value: summary.remarks },
  ];

  const group = (title: string, rows: SummaryRow[], tone: 'key' | 'minor') => (
    <section className="goods-receipt-confirm-group" aria-label={title}>
      <h3 className="goods-receipt-confirm-group-title">{title}</h3>
      <dl className={`goods-receipt-confirm-grid goods-receipt-confirm-${tone}`}>
        {rows.map((row) => (
          <div
            className={`goods-receipt-confirm-item goods-receipt-confirm-${row.key}`}
            key={row.key}
          >
            <dt>{row.label}</dt>
            {/* 값이 없는 칸은 비워 두지 않는다 — 빠뜨린 것인지 없는 것인지 구분되지 않는다. */}
            <dd>{orEmpty(row.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  return (
    <div className="goods-receipt-confirm">
      {group(t.dialog.submitGroupWhat, what, 'key')}
      {group(t.dialog.submitGroupWhere, where, 'key')}
      {group(t.dialog.submitGroupHow, how, 'minor')}
    </div>
  );
};
