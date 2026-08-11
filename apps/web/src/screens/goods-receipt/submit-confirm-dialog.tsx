import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.goodsReceipt;

/**
 * 창 본문에 그대로 나열할 값.
 *
 * **이름이 아니라 값이 온다.** 참조 풀이·수량 표기·코드 다듬기는 화면이 이미 끝냈고, 이 창은
 * 받은 것을 그리기만 한다 — 여기서 다시 만들면 **확인한 값과 보내는 값이 갈린다.**
 */
export interface SubmitSummary {
  inboundReceiptNo: string;
  lineNo: number;
  itemName: string;
  lotName: string;
  /** 「100 SAMPLE-EA」 — 단위를 붙인 표기 그대로 */
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
  onConfirm: () => void;
  onClose: () => void;
}

interface SummaryRow {
  key: string;
  label: string;
  value: string;
}

const toRows = (summary: SubmitSummary): SummaryRow[] => [
  { key: 'inboundReceiptNo', label: t.summary.inboundReceiptNo, value: summary.inboundReceiptNo },
  { key: 'lineNo', label: t.lineSummary.lineNo, value: String(summary.lineNo) },
  { key: 'item', label: t.lineSummary.item, value: summary.itemName },
  { key: 'lot', label: t.lineSummary.lot, value: summary.lotName },
  { key: 'receiptQty', label: t.lineSummary.receivedQty, value: summary.receiptQty },
  { key: 'warehouse', label: t.fields.warehouse, value: summary.warehouseName },
  { key: 'location', label: t.fields.location, value: summary.locationName },
  { key: 'receiptType', label: t.fields.receiptType, value: summary.receiptTypeCode },
  {
    key: 'sourceDocumentType',
    label: t.fields.sourceDocumentType,
    value: summary.sourceDocumentTypeCode,
  },
  { key: 'qualityStatus', label: t.fields.qualityStatus, value: summary.qualityStatusCode },
  { key: 'inventoryStatus', label: t.fields.inventoryStatus, value: summary.inventoryStatusCode },
  { key: 'reason', label: t.fields.reason, value: summary.reasonCode },
  { key: 'receiptDatetime', label: t.fields.receiptDatetime, value: summary.receiptDatetime },
  { key: 'remarks', label: t.fields.remarks, value: summary.remarks },
];

/**
 * 제출 확인 — **되돌릴 수 없는 쓰기 앞의 마지막 층이다.**
 *
 * 확정 한 번에 다섯 가지가 함께 움직이고, 사용자가 넣는 값 중 넷이 **값 목록 없는 코드**다.
 * 계약의 입고 취소는 승인을 타므로(실측) 잘못 만들어진 전표를 이 화면이 되돌릴 수 없다 —
 * 보내기 직전에 무엇을 보내는지 한 번 더 보이는 값이 그만큼 크다.
 *
 * **함께 움직이는 다섯 가지를 문장으로 밝힌다.** 번호만 확인시키면 사용자는 「전표 한 장이
 * 생긴다」로 읽는데, 실제로는 재고와 원장과 외부 시스템 대기열이 함께 움직인다.
 *
 * **창 안에 선택칸을 두지 않는다**(#45 · DS `design-system-v2-webui#68`). 이 창은 값을
 * 고치는 자리가 아니라 확인하는 자리다 — 고칠 것이 있으면 닫고 폼에서 고친다.
 *
 * **상태 칩을 쓰지 않는다.** 비활성 표현이 필요해지면 디자인 시스템의 갭(`StatusChip`에
 * `disabled`가 없다 — 실측)에 걸린다. 여기서는 평문으로 낸다.
 *
 * **스크림 클릭으로 닫히는 것을 막는다**(`closeOnBackdropClick={false}`). 실수로 닫혀도
 * 잃는 것은 없지만, 되돌릴 수 없는 조작을 확인하는 창이 스치는 클릭에 사라지면 확인 자체가
 * 형식이 된다 — 파기 확인 창과 갈리는 자리다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const SubmitConfirmDialog = ({ summary, onConfirm, onClose }: SubmitConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    title={t.dialog.submitTitle}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button onClick={onConfirm}>{t.actions.confirmPost}</Button>
      </>
    }
  >
    <p>{t.dialog.submitLead}</p>

    <dl className="filter-bar">
      {toRows(summary).map((row) => (
        <div className="field-cell" key={row.key}>
          <dt className="field-label">{row.label}</dt>
          {/* 값이 없는 칸은 비워 두지 않는다 — 빠뜨린 것인지 없는 것인지 구분되지 않는다. */}
          <dd>{row.value === '' ? t.values.empty : row.value}</dd>
        </div>
      ))}
    </dl>

    <p>{t.dialog.submitEffects}</p>
  </Dialog>
);
