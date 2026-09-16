import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PopSelect as Select } from '../../patterns/pop-select';
import { popTouchClass } from '../../patterns/pop-touch';
import type { CodeValue } from './types';

const t = messages.popLocationLabel.reissue;

export interface ReissueDialogProps {
  /** 고른 것 가운데 이미 찍은 자리의 수. **서버가 센 값이다** — 화면이 세지 않는다. */
  reissueCount: number;
  reasons: CodeValue[];
  reasonsFailed: boolean;
  value: string;
  onChange: (reasonCode: string) => void;
  isSaving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 이미 찍은 자리가 섞였을 때 사유를 받는다.
 *
 * ⭐ **422 를 기다리지 않고 미리 묻는다.** 발행은 한 트랜잭션이라 사유가 빠지면 **전건이
 *    실패**한다 — 실패를 본 뒤 사유를 받아 다시 보내면 사용자는 같은 일을 두 번 한다.
 *
 * ⛔ **신규와 재발행이 섞여도 사유는 한 번만 받는다**(계약). 서버는 회차가 2 이상인 기록에만
 *    이 값을 남긴다 — 첫 발행 기록에 사유가 붙으면 이력이 거짓이 된다.
 *
 * ⚠ **사유 목록을 못 받으면 확인을 열지 않는다.** 값을 지어내 보내면 서버가 거절한다.
 */
export const ReissueDialog = ({
  reissueCount,
  reasons,
  reasonsFailed,
  value,
  onChange,
  isSaving,
  onConfirm,
  onClose,
}: ReissueDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title={t.title}
    footer={
      <>
        <Button
          className={popTouchClass('normal')}
          variant="outlined"
          size="xl"
          onClick={onClose}
        >
          {t.cancel}
        </Button>
        <Button
          className={popTouchClass('primary')}
          size="xl"
          disabled={value === '' || isSaving}
          loading={isSaving}
          onClick={onConfirm}
        >
          {t.confirm}
        </Button>
      </>
    }
  >
    <AlertBanner variant="warning">{t.notice(reissueCount)}</AlertBanner>

    {reasonsFailed ? (
      <AlertBanner variant="error">{t.reasonLoadFailed}</AlertBanner>
    ) : (
      <div className="pop-loclabel-reason">
        <span className="field-label">{t.reason}</span>
        <Select
          aria-label={t.reason}
          size="xl"
          value={value === '' ? null : value}
          placeholder={t.reasonPlaceholder}
          options={reasons.map((reason) => ({
            value: reason.code,
            label: reason.codeName,
          }))}
          onChange={onChange}
        />
        {value === '' && <span className="field-note">{t.required}</span>}
      </div>
    )}
  </Dialog>
);
