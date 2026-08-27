import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { TextArea } from '@omf-mes/ui';

import { useState } from 'react';

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
 *
 * ⛔ **건드리지 않은 칸을 붉게 물들이지 않는다.** 화면에 들어서자마자 「입력하세요」가 세 칸에
 * 떠 있으면, 아직 아무것도 하지 않은 사람을 나무라는 꼴이 된다 — 무엇이 모자란지는 발행
 * 버튼 옆 사유가 이미 말한다. **한 번 손댄 칸부터** 그 칸의 오류를 보인다.
 */
export const IssueFormPane = ({ value, errors, item, uomLabel, onChange }: IssueFormPaneProps) => {
  const t = messages.emergencyWorkOrder.form;
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const set = (field: keyof IssueFormValue, next: string): void => {
    setTouched((current) => ({ ...current, [field]: true }));
    onChange({ ...value, [field]: next });
  };

  /** 손댄 칸의 오류만 낸다. 손대기 전에는 사유가 발행 버튼 옆에서 말한다. */
  const errorOf = (field: keyof IssueFormErrors): string | undefined =>
    touched[field] === true ? errors[field] : undefined;

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
        error={errorOf('orderQty')}
        onChange={(event) => {
          set('orderQty', event.target.value);
        }}
      />

      <TextField
        label={t.plannedEnd}
        type="datetime-local"
        value={value.plannedEndAtLocal}
        helperText={t.dueHelp}
        error={errorOf('plannedEndAtLocal')}
        onChange={(event) => {
          set('plannedEndAtLocal', event.target.value);
        }}
      />

      <TextArea
        label={t.reason}
        value={value.remarks}
        /* 왜 필수인지와, 어디에 어떻게 남는지를 함께 적는다. */
        helperText={`${t.reasonHelp} ${t.reasonScope}`}
        error={errorOf('remarks')}
        onChange={(event) => {
          set('remarks', event.target.value);
        }}
      />
    </section>
  );
};
