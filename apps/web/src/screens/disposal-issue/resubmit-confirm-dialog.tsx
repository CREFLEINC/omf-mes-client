import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toVisibleLine } from './approval-progress-pane';
import { toReasonLines } from './types';

const t = messages.disposalIssue;

export interface ResubmitSummary {
  /** 이미 만들어져 있는 전표의 **업무 번호**. 내부 번호가 아니다(`omf-mes#44`) */
  goodsIssueNo: string;
  lineCount: number;
  /** 「45 SAMPLE-UOM-EA」 · 단위가 섞이면 화면이 합계를 내지 않고 그 사실을 적어 넘긴다 */
  totalQtyText: string;
  reason: string;
  reasonFirstLine: string;
}

export interface ResubmitConfirmDialogProps {
  summary: ResubmitSummary;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 재상신 확인 — **이미 만들어진 전표를 결재에 올린다.**
 *
 * 「품의 상신」의 확인 창과 **갈라 둔다.** 그 창은 전표를 **만들면서** 올리는 자리라 코드 다섯과
 * 보낼 줄을 확인시키지만, 여기서 확인할 것은 **이 전표가 맞는가와 사유**뿐이다 — 줄과 코드는
 * 이미 서버에 있고 이 화면이 고칠 수 없다. 한 창에 두 쓰임을 담으면 사용자가 **바꿀 수 없는
 * 값을 확인하는** 자리가 되고, 그때 「고치려면 어디로 가야 하나」에 화면이 답할 수 없다.
 *
 * **전표를 새로 만들지 않는다는 사실을 앞머리가 적는다.** 이 자리에 오는 사용자는 방금
 * 「전표는 만들어졌고 상신이 실패했습니다」를 본 사람이라, 다시 만드는 것으로 읽으면 **전표
 * 두 벌**을 남긴다.
 *
 * **상신은 되돌릴 수 없다** — 반려 뒤 다시 올리는 것은 새 요청이다(스펙 §6).
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45`). 스크림·X로 닫히지 않게 하는 것도 상신 확인
 * 창과 같다 — 되돌릴 수 없는 조작의 확인이 스치는 클릭에 사라지면 확인이 형식이 된다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResubmitConfirmDialog = ({
  summary,
  onConfirm,
  onClose,
}: ResubmitConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.resubmitTitle}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button onClick={onConfirm}>{t.actions.confirmSubmit}</Button>
      </>
    }
  >
    <p>{t.dialog.resubmitLead}</p>

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.issueSummary.goodsIssueNo}</dt>
        <dd>{summary.goodsIssueNo}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.issueLineTable.issueQty}</dt>
        <dd>{summary.totalQtyText}</dd>
      </div>
    </dl>

    <p>{t.dialog.lineCount(summary.lineCount)}</p>

    <section aria-label={t.dialog.reasonFull}>
      <p className="field-label">{t.dialog.reasonFull}</p>
      {toReasonLines(summary.reason).map((line, index) => (
        <p key={`${String(index)}:${line}`}>{toVisibleLine(line)}</p>
      ))}
    </section>

    <section aria-label={t.dialog.reasonFirstLine}>
      <p className="field-label">{t.dialog.reasonFirstLine}</p>
      <p>{summary.reasonFirstLine}</p>
      <p className="field-note">{t.dialog.reasonSummaryNote}</p>
    </section>

    <p>{t.dialog.submitEffects}</p>
    <p>{t.dialog.submitNoUndo}</p>
  </Dialog>
);
