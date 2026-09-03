import { AlertBanner, Button, Dialog, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
import type { ReissueReasonOption } from './queries';

const t = messages.popLotLabelPrint.reissueDialog;

export interface ReissueDialogProps {
  reasons: ReissueReasonOption[];
  isLoading: boolean;
  isError: boolean;
  onConfirm: (reissueReasonCode: string) => void;
  onCancel: () => void;
}

/**
 * 재출력 사유를 받는 창.
 *
 * ⛔ **사유 없이 보내지 않는다.** 이미 발행된 대상에 사유가 없으면 서버가 422 로 막는다
 * (계약 명시 · 스펙 §6 `ck_document_reissue_reason`) — 그 거절을 화면이 미리 막아 사용자가
 * 이유 없이 실패를 보지 않게 한다.
 *
 * ⛔ **선택지를 화면이 지어내지 않는다.** 값 목록은 서버가 내려 준다. 비어 오면 재출력을 열지
 * 않고 **왜 못 하는지** 보인다(F-1 · G-2).
 *
 * ⛔ **스크림 클릭으로 닫히지 않게 한다.** 나가는 중인 발행과 창의 수명이 어긋나면 사용자가
 * 무엇이 진행 중인지 알 수 없다(전례 규율).
 *
 * 디자인 시스템 부품의 조합이라 이 화면 슬라이스가 소유한다.
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
