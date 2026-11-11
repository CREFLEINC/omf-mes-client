import { Button, Dialog, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useState } from 'react';

import type { GuideTextField } from './version-summary';

const t = messages.inspectionStandard;
/** 서버 · 계약과 같은 길이(#252). */
const GUIDE_TEXT_MAX = 3000;

export interface VersionGuideDialogProps {
  field: GuideTextField;
  /** 저장된 문구 — 창은 이 값에서 시작한다. */
  initialText: string;
  isSaving: boolean;
  /** 저장 실패 알림(버전 저장과 같은 띠). */
  banner: ReactNode;
  error?: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

/**
 * 안내 문구 한 언어를 고치는 창(omf-all-around#252) — 안내가 매우 길 수 있어 버전 설정 창에서 빼고 언어별로 넓게 연다
 * (사용자 지시). 바꾼 것이 없으면 저장을 막는다. 닫으면 고친 글을 버린다.
 */
export const VersionGuideDialog = ({
  field,
  initialText,
  isSaving,
  banner,
  error,
  onSave,
  onClose,
}: VersionGuideDialogProps) => {
  const [text, setText] = useState(initialText);
  const isDirty = text.trim() !== initialText.trim();
  /* DS TextArea 는 maxLength 로 입력을 막지 않는다 — 넘으면 저장을 막고 칸에 알린다. */
  const isTooLong = text.trim().length > GUIDE_TEXT_MAX;
  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={t.versionSection.editGuide(t.fields[field])}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button
            loading={isSaving}
            disabled={isSaving || !isDirty || isTooLong}
            onClick={() => onSave(text)}
          >
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}
      <TextArea
        fullWidth
        label={t.fields[field]}
        value={text}
        rows={16}
        maxLength={GUIDE_TEXT_MAX}
        showCount
        onChange={(event) => setText(event.target.value)}
        error={isTooLong ? t.versionSection.guideTooLong(GUIDE_TEXT_MAX) : error}
      />
    </Dialog>
  );
};
