import { Button, Icon, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect } from 'react';

const t = messages.pqcInspectionRegister.web.actions;
const tResult = messages.pqcInspection.result;

export interface WebActionsProps {
  isConfirmed: boolean;
  isJustConfirmed: boolean;
  isSaved: boolean;
  lockedReason: string | null;
  /** 잠근 이유를 이 줄에 적을 것인가 — 회차를 못 읽은 갈래는 위 오류 띠가 이유와 [다시 시도]를 이미 낸다. */
  showLockedNote: boolean;
  confirmBlockedReason: string | null;
  saveBlockedReason: string | null;
  isSending: boolean;
  onSave: () => void;
  onConfirm: () => void;
}

/**
 * W-03-11 관리웹 저장 · 확정 줄(omf-all-around#135) — IQC 판정 화면(#133)과 같은 모양이다.
 * 오른쪽 끝에 [임시 저장](테두리) [판정 확정](채움), 바로 왼쪽에 지금 상황 한 줄 — 막힌 까닭은 정보색 바탕,
 * 확정 가능하면 「판정 확정 후 수정이 불가합니다」 경고색 바탕(표식·글 폭만큼).
 * ⛔ 단추가 잠기는 조건은 POP 과 같은 `PanelActions` 의 것 그대로다.
 */
export const WebActions = ({
  isConfirmed,
  isJustConfirmed,
  isSaved,
  lockedReason,
  showLockedNote,
  confirmBlockedReason,
  saveBlockedReason,
  isSending,
  onSave,
  onConfirm,
}: WebActionsProps) => {
  /* 저장 결과는 IQC 처럼 오른쪽 아래 알림으로 낸다(사용자 지시 2026-10-28 · #197). */
  const toast = useToast();
  useEffect(() => {
    if (isSaved) toast.show({ variant: 'success', description: tResult.saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장이 막 끝났을 때 한 번만 알린다.
  }, [isSaved]);

  const blocked =
    lockedReason !== null
      ? showLockedNote
        ? lockedReason
        : null
      : (saveBlockedReason ?? confirmBlockedReason);

  return (
    <div className="pqc-web-actions">
      <div className="pqc-web-action-notes">
        {isJustConfirmed && <p className="field-note">{tResult.confirmSucceeded}</p>}
        {isConfirmed ? (
          <p className="pqc-web-action-note" data-tone="info">
            <Icon name="info" size={18} aria-hidden />
            {t.confirmed}
          </p>
        ) : (
          <>
            {lockedReason !== null && !showLockedNote ? null : blocked !== null ? (
              <p className="pqc-web-action-note" data-tone="info">
                <Icon name="info" size={18} aria-hidden />
                {blocked}
              </p>
            ) : (
              <p className="pqc-web-action-note" data-tone="warning">
                <Icon name="warning" size={18} aria-hidden />
                {t.confirmNote}
              </p>
            )}
          </>
        )}
      </div>

      <div className="pqc-web-action-buttons">
        <Button
          type="button"
          variant="outlined"
          size="md"
          disabled={isConfirmed || lockedReason !== null || isSending}
          onClick={onSave}
        >
          {tResult.save}
        </Button>
        <Button
          type="button"
          variant="filled"
          size="md"
          disabled={lockedReason !== null || confirmBlockedReason !== null || isSending}
          onClick={onConfirm}
        >
          {t.confirm}
        </Button>
      </div>
    </div>
  );
};
