import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.shotConversion.end;

export interface EndPolicyDialogProps {
  /** 무엇을 끝내는지 — 범위 문구. **내부 번호가 아니라 사람이 읽는 말이다** */
  scopeLabel: string;
  endOn: string;
  onChangeEndOn: (endOn: string) => void;
  /** 고른 날이 쓸 수 없으면 사유. 없으면 `null` */
  dateError: string | null;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다 */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 정책을 끝내기 전에 서는 창.
 *
 * ⛔ **「지우는 것이 아니다」를 먼저 말한다** — 이 창에서 가장 오해하기 쉬운 자리다.
 * 계약에 삭제 경로가 없는 것은 실수가 아니라 **과거 실적이 그때의 비율로 계산됐기** 때문이고,
 * 그 사실을 알아야 사용자가 「지우려다 못 지웠다」로 읽지 않는다.
 *
 * ⚠ **끝낸 뒤 무엇이 적용될지는 이 창이 말하지 않는다** — 그 판정은 서버 몫이다. 「더 넓은
 * 범위가 대신 적용된다」까지만 말하고, 실제 값은 미리보기에서 확인하게 한다.
 *
 * ⭐ **스크림과 창 머리 X 를 함께 막는다** — 한쪽만 잠그면 잠근 적이 없는 것과 같다.
 */
export const EndPolicyDialog = ({
  scopeLabel,
  endOn,
  onChangeEndOn,
  dateError,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: EndPolicyDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    closeOnBackdropClick={false}
    showCloseButton={false}
    size="sm"
    title={t.title}
    footer={
      <>
        <Button variant="outlined" onClick={onClose} disabled={isSaving}>
          {messages.common.cancel}
        </Button>
        <Button onClick={onConfirm} loading={isSaving}>
          {t.action}
        </Button>
      </>
    }
  >
    <div className="form-grid dialog-scroll">
      {banner !== null && banner !== undefined && <div className="form-grid-full">{banner}</div>}

      <div className="form-grid-full">
        <p>{t.target(scopeLabel)}</p>
        {/* ⛔ 지우는 것이 아니라는 사실이 가장 먼저 온다. */}
        <p className="dialog-lead">{t.notDeleted}</p>
        <p className="dialog-lead">{t.afterNote}</p>
      </div>

      <TextField
        type="date"
        label={t.dateLabel}
        required
        value={endOn}
        onChange={(event) => onChangeEndOn(event.target.value)}
        error={dateError ?? undefined}
      />
    </div>
  </Dialog>
);
