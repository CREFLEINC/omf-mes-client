import { TextArea, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { type ReactNode, useId, useState } from 'react';

import type { IssueFormErrors, IssueFormValue } from './issue-form';
import type { SelectedItem } from './types';

export interface IssueFormPaneProps {
  value: IssueFormValue;
  errors: IssueFormErrors;
  /** 고른 품목. 수량 옆에 붙일 단위 이름이 여기서 나온다. */
  item: SelectedItem | null;
  uomLabel: string;
  /** 구획 머리 오른쪽에 설 것 — 발행 단추가 여기 선다. */
  action?: ReactNode;
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
 * ⚠ **비어 있는 필수 칸은 첫 렌더부터 붉은 테두리다**(사용자 결정 2026-09-21). 종전에는
 * 「손댄 칸부터」였고 무엇이 모자란지는 발행 단추 옆 사유가 말했는데, 그 사유도 이제 침묵한다
 * (`issue-action.tsx` 의 `SILENT_REASONS`). **글자로 나무라지는 않는다** — 테두리만 쓰고,
 * 값이 «있는데» 틀린 것만 손댄 뒤에 문구로 말한다.
 */
export const IssueFormPane = ({
  value,
  errors,
  item,
  uomLabel,
  action,
  onChange,
}: IssueFormPaneProps) => {
  const t = messages.emergencyWorkOrder.form;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const reasonId = useId();

  /**
   * 필수인데 비어 있는 칸은 **테두리로 먼저 알린다**(사용자 결정 2026-09-21). 글자로 나무라지
   * 않고 색만 쓴다 — 채우면 사라진다. 오류 문구는 종전대로 «손댄» 칸에서만 난다.
   */
  const emptyRequired = (value: string): string | undefined =>
    value.trim() === '' ? 'emergency-work-order-required-empty' : undefined;

  /** 아직 품목을 고르지 않았거나 단위 이름을 못 받았으면 붙일 것이 없다. */
  const unit =
    item === null || uomLabel === messages.emergencyWorkOrder.uomUnknown ? null : uomLabel;

  const set = (field: keyof IssueFormValue, next: string): void => {
    setTouched((current) => ({ ...current, [field]: true }));
    onChange({ ...value, [field]: next });
  };

  /**
   * 손댄 칸의 오류만 낸다.
   *
   * ⛔ **「…를 입력하세요」는 내지 않는다**(사용자 결정 2026-09-21). 비었다는 사실은 붉은
   * 테두리가 이미 말한다 — 같은 말을 글자로 또 적으면 칸마다 문장이 하나씩 붙는다.
   * 값이 «있는데» 틀린 것(숫자 아님·0 이하·없는 날짜)은 그대로 말한다.
   */
  const errorOf = (field: keyof IssueFormErrors): string | undefined => {
    if (touched[field] !== true) return undefined;

    const message = errors[field];
    const isEmptyRequired =
      (field === 'orderQty' && value.orderQty.trim() === '') ||
      (field === 'remarks' && value.remarks.trim() === '');

    return isEmptyRequired ? undefined : message;
  };

  return (
    <section className="pane emergency-work-order-pane" aria-label={t.title}>
      <div className="emergency-work-order-form-head">
        <h2 className="pane-title">{t.title}</h2>
        {action}
      </div>

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
          containerClassName={emptyRequired(value.orderQty)}
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
          {/*
           * ⚠ **별표를 손으로 붙인다.** DS `TextField` 는 `required` 에 별표를 그리지만
           * `TextArea` 는 그리지 않는다(실측). 4M 배정 화면(`W-02-03`)이 쓰는 것과 같은
           * `.required-mark` · 같은 빨강 토큰이다.
           */}
          <span className="field-label emergency-work-order-reason-label">
            <label htmlFor={reasonId}>{t.reason}</label>
            <span aria-hidden="true" className="required-mark">
              {' '}
              *
            </span>
          </span>
          <TextArea
            id={reasonId}
            aria-label={t.reason}
            required
            containerClassName={emptyRequired(value.remarks)}
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
