import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

const t = messages.overReceiptSplit;

export interface RegisterActionsProps {
  /** 잠긴 사유. `null`이면 열려 있다. */
  blockReason: string | null;
  isSaving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * 취소와 「입하 등록」 하나. **갈래 단추 셋을 두지 않는다**(사용자 지시 2026-10-21) — 어느 전표를 만들지는
 * 수량이 정하고, 확인 창의 「만들어지는 전표」에서 보이며 거기서 뺄 수 있다. 사람이 계약의 세 갈래를
 * 알 필요가 없다.
 */
export const RegisterActions = ({
  blockReason,
  isSaving,
  onSubmit,
  onCancel,
}: RegisterActionsProps) => {
  const reasonId = useId();

  return (
    <div className="form-actions">
      {/* 취소가 등록보다 앞에 선다 — 되돌릴 수 없는 것이 손 가까이 있으면 안 된다. */}
      <Button variant="text" disabled={isSaving} onClick={onCancel}>
        {messages.common.cancel}
      </Button>

      <div className="field-cell">
        <Button
          disabled={blockReason !== null || isSaving}
          loading={isSaving}
          aria-describedby={blockReason === null ? undefined : reasonId}
          onClick={onSubmit}
        >
          {t.actions.register}
        </Button>
        {blockReason !== null && (
          <span id={reasonId} className="field-note">
            {blockReason}
          </span>
        )}
      </div>
    </div>
  );
};
