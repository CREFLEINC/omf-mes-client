import { TextArea, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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

  /** 아직 품목을 고르지 않았거나 단위 이름을 못 받았으면 붙일 것이 없다. */
  const unit =
    item === null || uomLabel === messages.emergencyWorkOrder.uomUnknown ? null : uomLabel;

  const set = (field: keyof IssueFormValue, next: string): void => {
    setTouched((current) => ({ ...current, [field]: true }));
    onChange({ ...value, [field]: next });
  };

  /** 손댄 칸의 오류만 낸다. 손대기 전에는 사유가 발행 버튼 옆에서 말한다. */
  const errorOf = (field: keyof IssueFormErrors): string | undefined =>
    touched[field] === true ? errors[field] : undefined;

  return (
    <section className="pane emergency-work-order-pane" aria-label={t.title}>
      <h2 className="pane-title">{t.title}</h2>

      <div className="emergency-work-order-form-grid">
        {/* 고른 결과를 «읽는 값»으로 그린다 — 입력칸처럼 보이면 여기서도 고칠 수 있다고 읽는다. */}
        <div className="field-cell emergency-work-order-form-item" data-empty={item === null}>
          <span className="field-label">{t.item}</span>
          <strong>{item === null ? '—' : `${item.itemCode} · ${item.itemName}`}</strong>
        </div>

        {/*
         * ⭐ **단위는 라벨이 아니라 칸 끝에 붙인다.** 종전에는 「수량 (단위 확인 중)」처럼
         * 시스템 상태가 라벨에 섞여, 칸 이름이 상황마다 바뀌었다. 라벨은 늘 「수량」이다.
         */}
        {/*
         * ⛔ **모르는 단위를 「확인 중」으로 적지 않는다.** 그것은 시스템 사정이고, 사용자가
         * 할 일을 바꾸지 않는다 — 단위를 아는 때에만 칸 끝에 붙인다.
         */}
        <TextField
          label={t.orderQty}
          required
          inputMode="decimal"
          value={value.orderQty}
          trailingIcon={
            unit === null ? undefined : <span className="emergency-work-order-uom">{unit}</span>
          }
          error={errorOf('orderQty')}
          onChange={(event) => {
            set('orderQty', event.target.value);
          }}
        />

        {/* 비워도 되는 칸은 «라벨»이 그렇다고 말한다 — 칸 아래 한 줄을 더 두지 않는다. */}
        <TextField
          label={`${t.plannedEnd} (${t.optional})`}
          type="date"
          value={value.dueDate}
          error={errorOf('dueDate')}
          onChange={(event) => {
            set('dueDate', event.target.value);
          }}
        />

        <div className="emergency-work-order-form-reason">
          {/*
           * ⛔ **칸 아래 설명을 두지 않는다.** 필수인 것은 별표가, 무엇을 쓰는지는 칸 안 글자가
           * 말한다 — 「승인이 없어 사유가 유일한 기록이다」는 시스템 사정이라 여기서 뺐다
           * (사용자 결정 2026-09-21).
           */}
          <TextArea
            label={t.reason}
            required
            placeholder={t.reasonPlaceholder}
            value={value.remarks}
            error={errorOf('remarks')}
            onChange={(event) => {
              set('remarks', event.target.value);
            }}
          />
        </div>
      </div>
    </section>
  );
};
