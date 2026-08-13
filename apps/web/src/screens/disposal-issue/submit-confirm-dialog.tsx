import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toVisibleLine } from './approval-progress-pane';
import { toReasonLines } from './types';

const t = messages.disposalIssue;

/**
 * 창이 보이는 줄 하나.
 *
 * **이름이 아니라 값이 온다.** 참조 풀이·수량 표기는 화면이 이미 끝냈고, 이 창은 받은 것을
 * 그리기만 한다 — 여기서 다시 만들면 **확인한 값과 보내는 값이 갈린다.**
 *
 * 줄을 가르는 것은 **표시 순번**이다. 내부 번호를 쓰지 않는다(`omf-mes#44`) — 화면 글자가
 * 아니어도 DOM에 남고, 한 번 쓰기 시작하면 접근 이름으로도 새기 쉽다.
 */
export interface SubmitLineSummary {
  ordinal: number;
  item: string;
  lot: string;
  /** 「30 SAMPLE-UOM-EA」 — 단위를 붙인 표기 그대로 */
  qty: string;
}

export interface SubmitSummary {
  /** 폐기의 근거가 되는 입고 전표. **업무 번호다** — 내부 번호가 아니다 */
  goodsReceiptNo: string;
  warehouseName: string;
  issueTypeCode: string;
  sourceDocumentTypeCode: string;
  destinationTypeCode: string;
  disposalAccount: string;
  reasonCode: string;
  /** 「2026-08-11 09:30」 — 보이는 표기 그대로 */
  issuedAt: string;
  /** **파생값이다.** 사용자가 넣은 적 없는 값이므로 창이 그 사실을 함께 밝힌다 */
  businessDate: string;
  remarks: string;
  lines: readonly SubmitLineSummary[];
  /** 상신 사유 **전문**. 줄바꿈이 유지된다 */
  reason: string;
  /** 결재함 목록에서 요약을 겸할 첫 줄. **전문과 나눠 보인다**(완료 조건 C62) */
  reasonFirstLine: string;
  /** 상한을 확인하지 못한 줄이 **섞여 있는가**. 있으면 그 사실을 창이 밝힌다 */
  hasUnknownOnHand: boolean;
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
  { key: 'goodsReceiptNo', label: t.summary.goodsReceiptNo, value: summary.goodsReceiptNo },
  { key: 'warehouse', label: t.summary.warehouse, value: summary.warehouseName },
  { key: 'issueType', label: t.formFields.issueType, value: summary.issueTypeCode },
  {
    key: 'sourceDocumentType',
    label: t.formFields.sourceDocumentType,
    value: summary.sourceDocumentTypeCode,
  },
  {
    key: 'destinationType',
    label: t.formFields.destinationType,
    value: summary.destinationTypeCode,
  },
  { key: 'disposalAccount', label: t.formFields.disposalAccount, value: summary.disposalAccount },
  { key: 'reasonCode', label: t.formFields.reason, value: summary.reasonCode },
  { key: 'issuedAt', label: t.formFields.issuedDate, value: summary.issuedAt },
  /* 파생값임을 **값 자체가** 밝힌다 — 라벨만으로는 사용자가 자기가 넣은 값으로 읽는다. */
  {
    key: 'businessDate',
    label: t.formFields.businessDate,
    value: t.dialog.businessDateDerived(summary.businessDate),
  },
  { key: 'remarks', label: t.formFields.remarks, value: summary.remarks },
];

/**
 * 품의 상신 확인 — **되돌릴 수 없는 조작 앞의 마지막 층이다.**
 *
 * **이 조작 한 번에 요청이 둘 나간다**(승인 기록 정정 1-1) — 전표를 만들고 이어서 결재에
 * 올린다. 창이 그 사실을 적는 이유는, 「상신했는데 전표만 생겼다」는 중간 실패가 실재하고
 * 그때 사용자가 무슨 일이 일어난 것인지 알아야 하기 때문이다.
 *
 * **재고는 아직 움직이지 않는다.** 이 화면에서 재고가 빠지는 순간은 승인 뒤의 「기타출고 처리」
 * 하나뿐이고, 창이 그 경계를 분명히 한다 — 사용자가 여기서 재고가 빠졌다고 믿으면 승인 뒤의
 * 처리를 잊는다(계약이 「승인은 상태만 바꾼다」라고 못 박은 자리).
 *
 * **상신은 되돌릴 수 없다.** 반려된 뒤 다시 올릴 수는 있으나 그것은 **새 요청**이다(스펙 §6).
 * 「취소할 수 있습니다」로 읽히지 않게 정확히 적는다.
 *
 * **사유 전문과 첫 줄을 나눠 보인다**(완료 조건 C62). 결재함 목록에서 요약을 겸하는 것이
 * 첫 줄이라(공유계약 A-12) 어느 문장이 남들에게 보일지 보내기 전에 확인시킨다.
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45` · 디자인 시스템 갭). 이 창은 값을 고치는
 * 자리가 아니라 확인하는 자리다 — 고칠 것이 있으면 닫고 폼에서 고친다.
 *
 * **스크림 클릭·X로 닫히지 않게 한다**(`closeOnBackdropClick={false}`·`showCloseButton={false}`).
 * 되돌릴 수 없는 조작을 확인하는 창이 스치는 클릭에 사라지면 확인 자체가 형식이 된다 —
 * 파기 확인 창과 갈리는 자리다. Escape는 막을 수 없으므로 그 길의 규율은 화면의 `resetIfIdle`이
 * 갖는다(나가는 중인 쓰기를 끊지 않는다).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const SubmitConfirmDialog = ({ summary, onConfirm, onClose }: SubmitConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.submitTitle}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button onClick={onConfirm}>{t.actions.confirmSubmit}</Button>
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

    {/*
     * **무엇이 얼마나 나가는지를 줄마다 다시 보인다.** 합계만 보이면 어느 줄이 얼마인지
     * 확인할 수 없고, 이 화면에서 잘못 실린 수량은 승인을 거쳐 그대로 재고에서 빠진다.
     */}
    <p>{t.dialog.lineCount(summary.lines.length)}</p>
    <ul>
      {/*
       * `key`가 사실상 배열 인덱스다(순번이 그 자리에서 매겨진다). **여기서는 그 규칙을
       * 지나간다** — 줄이 순수 텍스트이고 지역 상태가 없으며, 이 목록은 제자리에서 재정렬되지
       * 않는다(값이 바뀌면 창째 다시 그려진다). 내부 번호를 키로 쓰지 않기 위한 것이며(#44)
       * 받는 타입에 그 자리조차 두지 않았다.
       */}
      {summary.lines.map((line) => (
        <li key={line.ordinal}>{t.dialog.linePair(line.item, line.lot, line.qty)}</li>
      ))}
    </ul>

    {/*
     * 사유는 **전문과 첫 줄을 나눠** 보인다. 첫 줄만 보이면 무엇을 보내는지 모르고, 전문만
     * 보이면 어느 줄이 남들에게 요약으로 보일지 모른다.
     */}
    <section aria-label={t.dialog.reasonFull}>
      <p className="field-label">{t.dialog.reasonFull}</p>
      {/*
       * 줄바꿈이 뜻을 나른다 — 한 줄로 이어 붙이면 문단 구분이 사라진다. 줄마다 상자를 세우고
       * 빈 줄은 보이는 글자로 바꾼다(결재 진행 구획과 같은 처리 · `app.css`를 고치지 않는다).
       */}
      {toReasonLines(summary.reason).map((line, index) => (
        <p key={`${String(index)}:${line}`}>{toVisibleLine(line)}</p>
      ))}
    </section>

    <section aria-label={t.dialog.reasonFirstLine}>
      <p className="field-label">{t.dialog.reasonFirstLine}</p>
      <p>{summary.reasonFirstLine}</p>
      <p className="field-note">{t.dialog.reasonSummaryNote}</p>
    </section>

    {summary.hasUnknownOnHand && <p className="field-note">{t.dialog.submitOnHandUnknown}</p>}

    <p>{t.dialog.submitEffects}</p>
    <p>{t.dialog.submitNoUndo}</p>
  </Dialog>
);
