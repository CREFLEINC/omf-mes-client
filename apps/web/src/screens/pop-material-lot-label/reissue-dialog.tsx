import { AlertBanner, Button, Dialog, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
import type { ReissueReasonOption } from './queries';

const t = messages.popMaterialLotLabel.target.reissueDialog;

export interface ReissueDialogProps {
  reasons: ReissueReasonOption[];
  isLoading: boolean;
  isError: boolean;
  onConfirm: (reissueReasonCode: string) => void;
  onCancel: () => void;
}

/**
 * 재인쇄 사유를 받는 창.
 *
 * ⛔ **사유 없이 보내지 않는다.** 회차가 2 이상인 발행에 사유가 없으면 서버가 422 로 막는다 —
 * 그 거절을 화면이 미리 막아 사용자가 이유 없이 실패를 보지 않게 한다.
 *
 * ⛔ **선택지를 화면이 지어내지 않는다.** 값 목록은 서버가 내려 준다. 비어 오면 재인쇄를 열지
 * 않고 **왜 못 하는지** 보인다(공유계약 F-1·G-2) — 빈 목록을 「사유 없음」으로 통과시키면
 * 서버 거절이 그 자리에서 나온다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ReissueDialog = ({
  reasons,
  isLoading,
  isError,
  onConfirm,
  onCancel,
}: ReissueDialogProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  const isChoosable = !isLoading && !isError && reasons.length > 0;
  /* 고르지 않은 채로는 보낼 수 없다 — 빈 값을 사유로 실으면 서버가 422 로 막는다. */
  const isReady = isChoosable && selected !== null;

  return (
    <Dialog
      open
      onClose={onCancel}
      size="md"
      closeOnBackdropClick={false}
      title={t.title}
      footer={
        <>
          <Button
            className={popTouchClass('normal')}
            variant="outlined"
            size="xl"
            onClick={onCancel}
          >
            {t.cancel}
          </Button>
          <Button
            className={popTouchClass('critical')}
            size="xl"
            disabled={!isReady}
            onClick={() => {
              if (selected !== null) onConfirm(selected);
            }}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      <p className="field-note pop-wide-note">{t.description}</p>

      {isError ? <AlertBanner variant="error">{t.loadFailed}</AlertBanner> : null}
      {!isError && !isLoading && reasons.length === 0 ? (
        <AlertBanner variant="warning">{t.empty}</AlertBanner>
      ) : null}

      {isChoosable ? (
        <>
          <span className="field-label">{t.label}</span>
          <Select
            aria-label={t.label}
            size="xl"
            placeholder={t.placeholder}
            value={selected}
            options={reasons.map((reason) => ({ value: reason.code, label: reason.name }))}
            onChange={setSelected}
          />
        </>
      ) : null}
    </Dialog>
  );
};
