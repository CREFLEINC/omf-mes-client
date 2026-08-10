import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import {
  EXCESS_INSPECTION_NOTE,
  exceptionTypeNote,
  exceptionTypeOptions,
  exceptionTypePlaceholder,
} from './code-options';
import { SelectField } from './select-field';
import type { HeaderDraft } from './types';

const t = messages.overReceiptSplit;

export interface ExcessFormProps {
  values: HeaderDraft;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  onChange: (patch: Partial<HeaderDraft>) => void;
}

/**
 * 초과분 전표에만 붙는 두 칸.
 *
 * **머리 입력과 갈라 둔다.** 예외 유형과 초과 사유는 계약이 「초과분 쪽에서 쓰는」 값으로
 * 정의했다 — 같은 줄에 섞어 놓으면 두 전표 모두에 붙는 값으로 읽힌다.
 *
 * **예외 유형 선택지는 비어 있다**(계획 결정 14). 값 목록이 확정되지 않아 지어내지 않고,
 * 왜 비었는지를 안내로 밝힌다. 값이 정해지면 `code-options.ts`의 배열만 채우면 되고,
 * 그 순간 「유형을 고르면 사유가 필수」라는 짝 제약이 함께 살아난다(`validation.ts`).
 *
 * **초과분의 수입검사 대상 여부는 보내지 않는다** — 계약의 분리 등록 요청에 그 자리가 하나도
 * 없어 「정량분 값을 승계한다」가 성립하지 않는다. 지어내지 않고 사실만 밝힌다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ExcessForm = ({ values, fieldErrors, isSaving, onChange }: ExcessFormProps) => (
  <div className="form-grid">
    <SelectField
      label={t.fields.exceptionType}
      options={exceptionTypeOptions()}
      value={values.exceptionTypeCode}
      note={exceptionTypeNote()}
      placeholder={exceptionTypePlaceholder()}
      disabled={isSaving}
      onChange={(value) => {
        onChange({ exceptionTypeCode: value });
      }}
    />

    <TextField
      label={t.fields.exceptionReason}
      value={values.exceptionReason}
      error={fieldErrors.exceptionReason}
      disabled={isSaving}
      onChange={(event) => {
        onChange({ exceptionReason: event.target.value });
      }}
    />

    <div className="field-cell">
      <span className="field-note">{t.notes.excessOnlyFields}</span>
      <span className="field-note">{EXCESS_INSPECTION_NOTE}</span>
    </div>
  </div>
);
