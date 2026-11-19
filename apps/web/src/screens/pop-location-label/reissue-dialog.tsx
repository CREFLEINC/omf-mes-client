import { messages } from '@omf-mes/i18n';

import { PuButton, PuDialog, PuField, PuNote, PuTiles } from '../../patterns/pop-uniform';
import type { CodeValue } from './types';

const t = messages.popLocationLabel.reissue;

export interface ReissueDialogProps {
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
 * 재인쇄 사유 창(#295 시안) — 이미 찍은 자리가 섞이면 사유를 받은 뒤에야 보낸다.
 * 사유는 코드 사전이 준 그대로 타일로 고른다. 머리 X 없이 [취소] · [재인쇄](규칙 16). Esc 는 닫는다.
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
  <PuDialog
    title={t.title}
    wide
    onClose={onClose}
    footer={
      <>
        <PuButton onClick={onClose}>{t.cancel}</PuButton>
        <PuButton variant="primary" disabled={value === '' || isSaving} onClick={onConfirm}>
          {t.confirm}
        </PuButton>
      </>
    }
  >
    <div className="ll-reissue">
      <PuNote tone="warn">{t.notice(reissueCount)}</PuNote>

      {reasonsFailed ? (
        <PuNote tone="bad">{t.reasonLoadFailed}</PuNote>
      ) : (
        <PuField label={t.reason} required>
          <PuTiles
            label={t.reason}
            cols={Math.min(3, Math.max(1, reasons.length))}
            value={value === '' ? null : value}
            options={reasons.map((reason) => ({ value: reason.code, label: reason.codeName }))}
            onChange={onChange}
          />
        </PuField>
      )}
    </div>
  </PuDialog>
);
