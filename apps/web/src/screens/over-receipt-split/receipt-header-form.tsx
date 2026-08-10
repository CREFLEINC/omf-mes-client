import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { HeaderDraft } from './types';

const t = messages.overReceiptSplit;

export interface ReceiptHeaderFormProps {
  values: HeaderDraft;
  /** 화면이 잡은 오류와 서버가 준 필드 오류를 합친 것. 어느 쪽이든 같은 자리에 낸다 */
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  onChange: (patch: Partial<HeaderDraft>) => void;
}

/**
 * 입하 전표의 머리 입력.
 *
 * **여기 친 값 한 벌이 만들어지는 전표 모두에 실린다.** 같은 도착을 둘로 나눈 것이라
 * 입하 일시·거래명세서번호·비고가 전표마다 다를 이유가 없다 — 그 사실을 안내로 밝힌다.
 *
 * **영업일 입력칸을 두지 않는다.** 계약이 영업일을 필수로 요구하지만 산출 규칙(야간조 경계 등)이
 * 어디에도 정의돼 있지 않아, 입력칸을 두면 사용자가 무엇을 넣어야 하는지 화면이 설명할 수 없다.
 * 입하 일시의 날짜로 파생하고 **그 사실을 안내로 밝힌다**(계획 결정 8 · 승인 13-5의 조건).
 *
 * **거래명세서번호에 `maxLength`를 두지 않는다.** 브라우저가 붙여넣기를 조용히 잘라 내면
 * 사용자가 넣으려던 것과 다른 번호가 되돌릴 수 없는 전표에 실린다 — 자르지 말고 사유를 밝힌다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
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
      label={t.fields.deliveryNoteNo}
      value={values.deliveryNoteNo}
      error={fieldErrors.deliveryNoteNo}
      disabled={isSaving}
      onChange={(event) => {
        onChange({ deliveryNoteNo: event.target.value });
      }}
    />

    <TextField
      label={t.fields.remarks}
      value={values.remarks}
      error={fieldErrors.remarks}
      disabled={isSaving}
      onChange={(event) => {
        onChange({ remarks: event.target.value });
      }}
    />

    {/*
     * 두 안내는 **입력칸이 없는 사정**을 밝힌다 — 하나는 이 값들이 어디까지 실리는지,
     * 다른 하나는 입력칸 없이 정해지는 값이 무엇에서 나오는지다.
     */}
    <div className="field-cell">
      <span className="field-note">{t.notes.headerSharedByBoth}</span>
      <span className="field-note">{t.notes.businessDateDerived}</span>
    </div>
  </div>
);
