import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { codeListNote, type CodeListState } from './code-options';
import { SelectField } from './select-field';
import type { HeaderDraft, SelectOption } from './types';

const t = messages.overReceiptSplit;

export interface ExcessFormProps {
  values: HeaderDraft;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  /** 예외 유형 선택지 — 서버 코드 사전(`INBOUND_RECEIPT_EXCEPTION_TYPE`). */
  exceptionTypeOptions: SelectOption[];
  exceptionTypeState: CodeListState;
  onChange: (patch: Partial<HeaderDraft>) => void;
}

/**
 * 초과분 전표에만 실리는 두 값. **초과분이 갈린 뒤에만 선다**(화면이 가린다) — 초과분 줄은 발주에
 * 묶이지 않아 서버가 유형을 요구한다. 기본값(초과입하)은 화면이 채우고, 사유만 사람이 적는다.
 */
export const ExcessForm = ({
  values,
  fieldErrors,
  isSaving,
  exceptionTypeOptions,
  exceptionTypeState,
  onChange,
}: ExcessFormProps) => (
  <div className="form-grid">
    <SelectField
      label={t.fields.exceptionType}
      options={exceptionTypeOptions}
      value={values.exceptionTypeCode}
      note={fieldErrors.exceptionTypeCode ?? codeListNote(exceptionTypeOptions, exceptionTypeState)}
      invalid={fieldErrors.exceptionTypeCode !== undefined}
      disabled={isSaving || exceptionTypeState !== 'ready'}
      onChange={(value) => {
        onChange({ exceptionTypeCode: value });
      }}
    />

    <TextField
      label={t.fields.exceptionReason}
      placeholder={t.form.exceptionReasonPlaceholder}
      value={values.exceptionReason}
      error={fieldErrors.exceptionReason}
      disabled={isSaving}
      onChange={(event) => {
        onChange({ exceptionReason: event.target.value });
      }}
    />

    <div className="field-cell">
      <span className="field-note">{t.notes.excessOnlyFields}</span>
    </div>
  </div>
);
