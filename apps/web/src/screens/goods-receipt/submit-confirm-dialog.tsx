import { Button, Dialog, Icon } from '@crefle/web-ui';
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

export interface SubmitConfirmDialogProps {
  summary: SubmitSummary;
  /**
   * 코드의 표시 이름 — 공통코드 조회가 준 이름(`nameKo`·`codeName`)을 화면이 넘긴다. 이름이 없으면
   * 코드 그대로다(지어내지 않는다). 보내는 값은 코드 그대로다.
   */
  codeLabel?: (key: GoodsReceiptCodeKey, code: string) => string;
  onConfirm: () => void;
  onClose: () => void;
}

interface SummaryRow {
  key: string;
  label: string;
  value: string;
}

const orEmpty = (value: string): string => (value === '' ? t.values.empty : value);

/**
 * 입고 처리 확인 창 — 실행 직전에 2~3초 안에 확인하는 화면이다(사용자 지시).
 *
 * 세 묶음으로 가른다: **입고 대상**(입하번호·줄·품목·수량·자재 LOT) → **입고 위치**(창고·위치 — 목적지라
 * 나란히) → **입고 조건**(유형·상태·일시 등 — 보조라 작게). 되돌릴 수 없다는 경고는 한 줄로 앞세우고,
 * 함께 처리되는 일(이슈 §6)은 그 아래 보조 설명으로 둔다.
 */
export const SubmitConfirmDialog = ({
  summary,
  codeLabel = (_key, code) => code,
  onConfirm,
  onClose,
}: SubmitConfirmDialogProps) => {
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
    <Dialog
      open
      onClose={onClose}
      size="md"
      closeOnBackdropClick={false}
      /* 닫기(X)는 「입력으로 돌아가기」와 같은 동작이라 두지 않는다(사용자 지시). Esc 로도 닫힌다. */
      showCloseButton={false}
      title={t.dialog.submitTitle}
      footer={
        <>
          {/*
           * 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다.
           * 창이 열리면 초점이 되돌아가기(안전한 쪽)에 간다 — 되돌릴 수 없는 실행이 엔터 한 번에 눌리지 않는다.
           */}
          <Button variant="outlined" autoFocus onClick={onClose}>
            {t.actions.cancelPost}
          </Button>
          <Button onClick={onConfirm}>{t.actions.confirmPost}</Button>
        </>
      }
    >
      <div className="goods-receipt-confirm">
        <p className="goods-receipt-confirm-lead">{t.dialog.submitLead}</p>

        {group(t.dialog.submitGroupWhat, what, 'key')}
        {group(t.dialog.submitGroupWhere, where, 'key')}
        {group(t.dialog.submitGroupHow, how, 'minor')}

        <div className="goods-receipt-confirm-warning">
          <p>
            <Icon name="warning" size={18} />
            <strong>{t.dialog.submitIrreversible}</strong>
          </p>
          <p className="goods-receipt-confirm-effects">{t.dialog.submitEffects}</p>
        </div>
      </div>
    </Dialog>
  );
};
