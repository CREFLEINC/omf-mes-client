import { Button, Dialog, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import type { GuideTextField } from './version-summary';

const t = messages.inspectionStandard;
/** 서버 · 계약과 같은 길이(#252). */
const GUIDE_TEXT_MAX = 3000;

export interface VersionGuideDialogProps {
  field: GuideTextField;
  /** 지금 보이는 문구(담아 둔 글이 있으면 그 글) — 창은 이 값에서 시작한다. */
  initialText: string;
  /** 「확인」 — 화면에만 담는다. 저장은 바닥 줄 「임시 저장」 · 「확정」이 한다(사용자 지시). */
  onSave: (text: string) => void;
  onClose: () => void;
}

/**
 * 안내 문구 한 언어를 고치는 창(omf-all-around#252) — 안내가 매우 길 수 있어 버전 설정 창에서 빼고 언어별로 넓게 연다
 * (사용자 지시). 바꾼 것이 없으면 「확인」을 막는다. 닫으면 고친 글을 버린다.
 */
export const VersionGuideDialog = ({
  field,
  initialText,
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
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button disabled={!isDirty || isTooLong} onClick={() => onSave(text)}>
            {messages.common.confirm}
          </Button>
        </>
      }
    >
      <TextArea
        fullWidth
        label={t.fields[field]}
        value={text}
        rows={16}
        maxLength={GUIDE_TEXT_MAX}
        showCount
        onChange={(event) => setText(event.target.value)}
        error={isTooLong ? t.versionSection.guideTooLong(GUIDE_TEXT_MAX) : undefined}
      />
    </Dialog>
  );
};
