import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';

const t = messages.pqcInspection.result;

export interface PanelActionsProps {
  isConfirmed: boolean;
  isJustConfirmed: boolean;
  isSaved: boolean;
  /** 저장·확정 둘 다 막는 이유(예: 그 W/O 의 생산 실적이 아직 없다). 있으면 두 단추를 잠그고 이 문구를 낸다. */
  lockedReason: string | null;
  /** 잠긴 이유를 이 줄에 말할 것인가. 분할 화면은 패널 맨 위에 말하므로 `false` 다. */
  showLockedNote: boolean;
  /** 확정만 막는 이유. 합계 불일치는 《결과 입력》이 이미 말하므로 여기서 다시 말하지 않는다. */
  confirmBlockedReason: string | null;
  saveBlockedReason: string | null;
  workerMissing: boolean;
  /** 관리웹이 저장을 보내 놓고 답을 기다리는 중 — 두 단추를 잠근다(리뷰 m5). POP 큐는 늘 `false`. */
  isSending: boolean;
  onSave: () => void;
  onConfirm: () => void;
}

/**
 * 분할 패널의 저장·확정 줄(omf-all-around#107). 단독 화면 P-02-13 의 `action-bar` 와 문구·결과 띠는 같고,
 * 「실적이 없어 둘 다 잠김」(사용자 결정 2026-10-19 · 실적 입력 → PQC)을 더했다.
 */
export const PanelActions = ({
  isConfirmed,
  isJustConfirmed,
  isSaved,
  lockedReason,
  showLockedNote,
  confirmBlockedReason,
  saveBlockedReason,
  workerMissing,
  isSending,
  onSave,
  onConfirm,
}: PanelActionsProps) => {
  /* 잠겼으면 잠긴 이유 하나만 말한다 — 분할 화면은 그 이유를 패널 맨 위에서 이미 말했다. */
  const confirmNote =
    confirmBlockedReason !== null &&
    confirmBlockedReason !== t.confirmBlockedByTotals &&
    confirmBlockedReason !== t.confirmed
      ? confirmBlockedReason
      : null;
  const note =
    lockedReason !== null
      ? showLockedNote
        ? lockedReason
        : null
      : (saveBlockedReason ?? confirmNote);

  return (
    <div className="pop-action-bar">
      <div className="pop-action-note">
        {isSaved && <AlertBanner variant="success" title={t.saved} />}
        {isJustConfirmed && (
          <AlertBanner variant="success" title={t.confirmSucceeded}>
            {t.confirmed}
          </AlertBanner>
        )}
        {isConfirmed && !isJustConfirmed && <AlertBanner variant="info" title={t.confirmed} />}
        {!isConfirmed && note !== null && <p className="field-note">{note}</p>}
      </div>

      <Button
        type="button"
        variant="outlined"
        size="xl"
        className={popTouchClass('primary')}
        disabled={isConfirmed || lockedReason !== null || isSending}
        onClick={onSave}
      >
        {t.save}
      </Button>
      <Button
        type="button"
        variant="filled"
        size="xl"
        className={popTouchClass('destructive')}
        disabled={
          lockedReason !== null || confirmBlockedReason !== null || workerMissing || isSending
        }
        onClick={onConfirm}
      >
        {t.confirm}
      </Button>
    </div>
  );
};
