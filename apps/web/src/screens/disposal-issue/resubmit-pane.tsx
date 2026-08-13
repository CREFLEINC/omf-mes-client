import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { Submission } from './approval-progress';

const t = messages.disposalIssue;

export interface ResubmitPaneProps {
  /**
   * 상신 여부 세 갈래. **판정을 여기서 만들지 않는다** — `approval-progress.ts` 한 곳에서
   * 나온 것을 받는다. 결재 진행 구획이 「아직 상신되지 않았습니다」라고 적는 그 판정과
   * 같은 값이어야 두 구획이 서로 다른 말을 하지 않는다.
   */
  submission: Submission['kind'];
  reason: string;
  /** 사유 칸 아래 서는 오류. 화면이 잡은 것과 서버가 준 것이 **같은 칸에** 붙는다 */
  reasonError?: string;
  /** 왜 막혔는지. `null`이면 보낼 수 있다 — 사유 없이 잠그지 않는다(배치 규범 4) */
  blockReason: string | null;
  /** 전송 중인가. **첫째 겹**이다 — 핸들러 가드(둘째 겹)와 짝이다 */
  isLocked: boolean;
  onChangeReason: (value: string) => void;
  onOpenConfirm: () => void;
}

/**
 * 이력 탭의 상신 구획 — **미상신 전표를 이어서 결재에 올리는 자리다.**
 *
 * **이 구획이 있어야 중간 상태가 막다른 길이 되지 않는다**(승인 기록 정정 1-1). 「품의 상신」은
 * 요청 둘을 잇는데 둘째가 실패하면 **전표만 남는다** — 그 전표를 정상 경로로 되살릴 자리가
 * 여기다. 다른 경로로 만들어진 미상신 전표도 같은 자리를 지난다.
 *
 * **상신 규칙은 발의 자리와 같은 파일에서 나온다**(`reason-draft.ts`·`validation.ts`) —
 * 자리가 둘이어도 규칙이 둘이 되면 한쪽에서만 공백만인 사유가 결재에 오른다.
 *
 * **이미 상신된 품의에도 이 구획이 선다.** 감추면 「왜 여기서는 상신할 수 없는가」에 화면이
 * 답하지 못하고, 상신 여부를 **확인할 수 없는** 갈래(값이 실려 왔으나 쓸 수 없다)가 미상신과
 * 같은 모양으로 보인다 — 그 갈래에서 다시 올리면 결재 요청이 두 벌이 된다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResubmitPane = ({
  submission,
  reason,
  reasonError,
  blockReason,
  isLocked,
  onChangeReason,
  onOpenConfirm,
}: ResubmitPaneProps) => {
  const reasonId = useId();
  const blockReasonId = `${reasonId}-block`;
  const canSubmit = submission === 'notSubmitted';

  return (
    <section className="pane" aria-label={t.resubmit.label}>
      <p>{canSubmit ? t.resubmit.lead : t.resubmit.submittedLead}</p>

      {/*
       * **올릴 수 없는 전표에는 사유 칸을 두지 않는다.** 칠 수 있는데 보낼 수 없는 칸은
       * 사용자가 쓴 글을 버리게 만든다 — 무엇이 막혔는지는 버튼 옆 사유가 말한다.
       */}
      {canSubmit && (
        <div className="field-cell">
          <TextField
            fullWidth
            label={t.formFields.submitReason}
            value={reason}
            placeholder={t.form.reasonPlaceholder}
            helperText={t.form.reasonHelper}
            disabled={isLocked}
            error={reasonError}
            onChange={(event) => {
              onChangeReason(event.target.value);
            }}
          />
        </div>
      )}

      <div className="form-actions">
        <div className="field-cell">
          <Button
            disabled={blockReason !== null || isLocked}
            loading={isLocked}
            aria-describedby={blockReason === null ? undefined : blockReasonId}
            onClick={onOpenConfirm}
          >
            {t.actions.resubmit}
          </Button>
          {blockReason !== null && (
            <span id={blockReasonId} className="field-note">
              {blockReason}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
