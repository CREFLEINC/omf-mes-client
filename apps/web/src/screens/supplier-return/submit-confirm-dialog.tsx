import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.supplierReturn;

/**
 * 창이 보이는 줄 하나.
 *
 * **이름이 아니라 값이 온다.** 참조 풀이·수량 표기는 화면이 이미 끝냈고, 이 창은 받은 것을
 * 그리기만 한다 — 여기서 다시 만들면 **확인한 값과 보내는 값이 갈린다.**
 *
 * 줄을 가르는 것은 **표시 순번**이다. 내부 번호를 쓰지 않는다(#44) — 화면 글자가 아니어도
 * DOM에 남고, 한 번 쓰기 시작하면 접근 이름으로도 새기 쉽다.
 */
export interface SubmitLineSummary {
  ordinal: number;
  item: string;
  lot: string;
  /** 「30 SAMPLE-EA」 — 단위를 붙인 표기 그대로 */
  qty: string;
}

export interface SubmitSummary {
  supplierName: string;
  issueTypeCode: string;
  sourceDocumentTypeCode: string;
  destinationTypeCode: string;
  reasonCode: string;
  /** 「2026-08-06 09:12」 — 보이는 표기 그대로 */
  issuedAt: string;
  /** **파생값이다.** 사용자가 넣은 적 없는 값이므로 창이 그 사실을 함께 밝힌다 */
  businessDate: string;
  replacementExpected: boolean;
  sendToErp: boolean;
  remarks: string;
  lines: readonly SubmitLineSummary[];
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

const yesNo = (value: boolean): string => (value ? t.values.yes : t.values.no);

const toRows = (summary: SubmitSummary): SummaryRow[] => [
  { key: 'supplier', label: t.fields.supplier, value: summary.supplierName },
  { key: 'issueType', label: t.fields.issueType, value: summary.issueTypeCode },
  {
    key: 'sourceDocumentType',
    label: t.fields.sourceDocumentType,
    value: summary.sourceDocumentTypeCode,
  },
  { key: 'destinationType', label: t.fields.destinationType, value: summary.destinationTypeCode },
  { key: 'reason', label: t.fields.reason, value: summary.reasonCode },
  { key: 'issuedAt', label: t.fields.issuedAt, value: summary.issuedAt },
  /* 파생값임을 **값 자체가** 밝힌다 — 라벨만으로는 사용자가 자기가 넣은 값으로 읽는다. */
  {
    key: 'businessDate',
    label: t.fields.businessDate,
    value: t.dialog.businessDateDerived(summary.businessDate),
  },
  {
    key: 'replacementExpected',
    label: t.fields.replacementExpected,
    value: yesNo(summary.replacementExpected),
  },
  { key: 'sendToErp', label: t.fields.sendToErp, value: yesNo(summary.sendToErp) },
  { key: 'remarks', label: t.fields.remarks, value: summary.remarks },
];

/**
 * 반품 처리 확인 — **되돌릴 수 없는 쓰기 앞의 마지막 층이다.**
 *
 * 이 조작 한 번에 출고 전표가 만들어지고 **곧바로 전기돼 재고가 차감된다.** 계약의 출고 취소는
 * 승인을 타며 **다른 화면 소관**이라 이 화면이 되돌릴 수단을 갖지 않는다 — 보내기 직전에 무엇을
 * 보내는지 한 번 더 보이는 값이 그만큼 크다.
 *
 * **사실을 정확히 말한다**(계획 결정 12). 「계약에 취소가 없습니다」가 아니라 **「이 화면에는
 * 되돌리는 수단이 없습니다」**다 — 취소 오퍼레이션은 계약에 실재한다(실측). 사실과 다르게
 * 적으면 사용자가 잘못된 판단을 한다.
 *
 * **보류가 유지된다는 사실을 함께 밝힌다**(착수 이슈 §6). 반품했으니 보류가 풀릴 것으로 읽는
 * 사용자가 있고, 이 화면에는 보류를 푸는 수단이 없다.
 *
 * **창 안에 선택칸을 두지 않는다**(#45 · DS 이슈). 이 창은 값을 고치는 자리가 아니라 확인하는
 * 자리다 — 고칠 것이 있으면 닫고 구획에서 고친다. 반품 정보 폼을 창에 넣지 않은 것도 같은
 * 이유이며, 그 폼에는 선택칸이 다섯이라 넣었다면 정면으로 걸린다.
 *
 * **상태 칩을 쓰지 않는다** — 비활성 표현이 필요해지면 디자인 시스템의 갭(`StatusChip`에
 * `disabled`가 없다 · 실측)에 걸린다. 여기서는 평문으로 낸다.
 *
 * **스크림 클릭으로 닫히는 것을 막는다**(`closeOnBackdropClick={false}`). 실수로 닫혀도 잃는
 * 것은 없지만, 되돌릴 수 없는 조작을 확인하는 창이 스치는 클릭에 사라지면 확인 자체가
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
     * 확인할 수 없고, 이 화면에서 잘못 실린 수량은 재고에서 그대로 빠진다.
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

    {summary.hasUnknownOnHand && <p className="field-note">{t.dialog.submitOnHandUnknown}</p>}

    <p>{t.dialog.submitEffects}</p>
    <p>{t.dialog.submitNoUndoHere}</p>
    <p>{t.dialog.submitLotHoldKept}</p>
  </Dialog>
);
