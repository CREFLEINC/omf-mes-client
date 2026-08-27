import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { TextArea } from '@omf-mes/ui';

import type { IssueFormErrors, IssueFormValue } from './issue-form';
import type { SelectedItem } from './types';

export interface IssueFormPaneProps {
  value: IssueFormValue;
  errors: IssueFormErrors;
  /** 고른 품목. 수량 옆에 붙일 단위 이름이 여기서 나온다. */
  item: SelectedItem | null;
  uomLabel: string;
  onChange: (next: IssueFormValue) => void;
}

/**
 * 발행 정보 입력.
 *
 * ⛔ **유형 칸이 없다.** 「긴급 고정」은 입력이 아니라 고정이라 「바꿀 수 없는 조건」 구획이
 * 값으로 적는다. 두 자리에 적으면 한쪽만 고쳐질 때 화면이 스스로와 어긋난다.
 *
 * ⛔ **품목은 여기서 고르지 않는다.** 고르는 일은 품목 구획이 맡고 여기서는 **고른 결과만**
 * 보인다 — 같은 값을 두 곳에서 바꾸게 두지 않는다.
 */
export const IssueFormPane = ({ value, errors, item, uomLabel, onChange }: IssueFormPaneProps) => {
  const t = messages.emergencyWorkOrder.form;
  const set = (patch: Partial<IssueFormValue>): void => {
    onChange({ ...value, ...patch });
  };

  return (
    <section aria-label={messages.emergencyWorkOrder.title}>
      <div className="field-cell">
        <span className="field-label">{t.item}</span>
        <span>{item === null ? '—' : `${item.itemCode} · ${item.itemName}`}</span>
      </div>

      <TextField
        label={`${t.orderQty} (${uomLabel})`}
        inputMode="decimal"
        value={value.orderQty}
        error={errors.orderQty}
        onChange={(event) => {
          set({ orderQty: event.target.value });
        }}
      />

      <TextField
        label={t.plannedEnd}
        type="datetime-local"
        value={value.plannedEndAtLocal}
        helperText={t.dueHelp}
        error={errors.plannedEndAtLocal}
        onChange={(event) => {
          set({ plannedEndAtLocal: event.target.value });
        }}
      />

      <TextArea
        label={t.reason}
        value={value.remarks}
        /* 왜 필수인지와, 어디에 어떻게 남는지를 함께 적는다. */
        helperText={`${t.reasonHelp} ${t.reasonScope}`}
        error={errors.remarks}
        onChange={(event) => {
          set({ remarks: event.target.value });
        }}
      />
    </section>
  );
};
