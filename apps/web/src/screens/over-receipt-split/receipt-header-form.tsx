import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { HeaderDraft } from './types';

const t = messages.overReceiptSplit;

export interface ReceiptHeaderFormProps {
  values: HeaderDraft;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  onChange: (patch: Partial<HeaderDraft>) => void;
}

/**
 * 두 전표에 같이 실리는 머리 입력. 입하 일시만 필수(기본값은 공장 현지 지금)이고 나머지는 「(선택)」으로
 * 표시한다 — 무엇을 꼭 채워야 하는지 칸 이름에서 읽힌다.
 */
export const ReceiptHeaderForm = ({
  values,
  fieldErrors,
  isSaving,
  onChange,
}: ReceiptHeaderFormProps) => (
  <div className="form-grid">
    <TextField
      type="datetime-local"
      label={t.fields.receiptDatetime}
      value={values.receiptDatetime}
      error={fieldErrors.receiptDatetime}
      disabled={isSaving}
      onChange={(event) => {
        onChange({ receiptDatetime: event.target.value });
      }}
    />

    <TextField
      label={`${t.fields.deliveryNoteNo} ${t.form.optional}`}
      value={values.deliveryNoteNo}
      error={fieldErrors.deliveryNoteNo}
      disabled={isSaving}
      onChange={(event) => {
        onChange({ deliveryNoteNo: event.target.value });
      }}
    />

    <TextField
      label={`${t.fields.remarks} ${t.form.optional}`}
      value={values.remarks}
      error={fieldErrors.remarks}
      disabled={isSaving}
      onChange={(event) => {
        onChange({ remarks: event.target.value });
      }}
    />

    <div className="field-cell">
      <span className="field-note">{t.notes.headerShared}</span>
    </div>
  </div>
);
