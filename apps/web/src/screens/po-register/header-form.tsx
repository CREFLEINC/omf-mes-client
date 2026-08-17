import { DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { HeaderDraft, SelectOption } from './types';

const t = messages.poRegister;

export interface HeaderFormProps {
  values: HeaderDraft;
  supplierOptions: SelectOption[];
  businessUnitOptions: SelectOption[];
  plantOptions: SelectOption[];
  /** 선택지의 한계를 밝히는 보조 문구. 목록마다 사정이 달라 따로 받는다 */
  supplierNote?: string;
  businessUnitNote?: string;
  plantNote?: string;
  /** 화면이 잡은 오류와 서버가 준 필드 오류를 합친 것. 어느 쪽이든 같은 자리에 낸다 */
  fieldErrors: Record<string, string>;
  /** 막지 않는 안내. 승계값과 다른 공급사를 골랐을 때만 선다(계획 결정 5) */
  supplierWarning?: string;
  /**
   * 다섯 칸이 함께 잠겼는가(완료 조건 C19·C24).
   *
   * **사유는 이 폼이 내지 않는다** — 나가는 중과 이미 등록한 뒤가 같은 잠금을 쓰고, 그 사정은
   * 조작 자리(등록 버튼 옆)에 한 번 선다. 칸마다 되풀이하면 같은 사실이 다섯 번 읽힌다.
   */
  isLocked?: boolean;
  onChange: (patch: Partial<HeaderDraft>) => void;
}

/**
 * 발주 머리 입력.
 *
 * **공급사·공장은 넘어온 전표에서 승계된 값으로 시작한다.** 고칠 수는 있고, 공급사를 바꾸면
 * 경고가 붙되 막지 않는다 — 초과분을 보낸 곳과 발주를 받는 곳이 갈리는 것은 드문 일이지
 * 잘못이 아니다.
 *
 * **사업부는 승계할 원천이 없다.** 입하 전표가 사업부를 담지 않으므로 사용자가 고른다.
 *
 * **ERP 발주번호·상태 칸이 없다**(계획 결정 6·7). 계약에 ERP 발주번호를 쓰는 경로 자체가 없고
 * 상태는 서버가 정한다 — 칸을 두면 보낼 수 없는 값을 화면이 들고 있게 된다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const HeaderForm = ({
  values,
  supplierOptions,
  businessUnitOptions,
  plantOptions,
  supplierNote,
  businessUnitNote,
  plantNote,
  fieldErrors,
  supplierWarning,
  isLocked = false,
  onChange,
}: HeaderFormProps) => {
  const orderDateId = useId();
  const expectedDateId = useId();
  const orderDateErrorId = `${orderDateId}-error`;
  const orderDateError = fieldErrors.orderDate;

  return (
    <div className="form-grid">
      <SelectField
        label={t.fields.supplier}
        required
        options={supplierOptions}
        value={values.supplierId}
        note={supplierNote}
        error={fieldErrors.supplierId}
        warning={supplierWarning}
        disabled={isLocked}
        onChange={(value) => {
          onChange({ supplierId: value });
        }}
      />

      <SelectField
        label={t.fields.businessUnit}
        required
        options={businessUnitOptions}
        value={values.businessUnitId}
        note={businessUnitNote}
        error={fieldErrors.businessUnitId}
        disabled={isLocked}
        onChange={(value) => {
          onChange({ businessUnitId: value });
        }}
      />

      <SelectField
        label={t.fields.plant}
        required
        options={plantOptions}
        value={values.plantId}
        note={plantNote}
        error={fieldErrors.plantId}
        disabled={isLocked}
        onChange={(value) => {
          onChange({ plantId: value });
        }}
      />

      {/*
       * `DatePicker`에는 `label`·`error` prop이 없다(설치본 실측) — 라벨을 직접 만들고
       * 오류는 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다(배치 규범 3).
       * **빈 값과 고른 값을 가른다**: 폼 값은 빈 문자열로 「고르지 않음」을 나타내지만
       * 이 컴포넌트는 `null`을 그 뜻으로 받는다.
       */}
      <div className="field-cell">
        <FieldLabel htmlFor={orderDateId} label={t.fields.orderDate} required />
        <DatePicker
          id={orderDateId}
          mode="single"
          placeholder={messages.common.selectDate}
          value={values.orderDate === '' ? null : values.orderDate}
          disabled={isLocked}
          invalid={orderDateError !== undefined}
          aria-required
          aria-describedby={orderDateError === undefined ? undefined : orderDateErrorId}
          onChange={(value) => {
            onChange({ orderDate: value });
          }}
        />
        {orderDateError !== undefined && (
          <span id={orderDateErrorId} className="field-error">
            {orderDateError}
          </span>
        )}
      </div>

      {/* 입고 예정일은 「고르지 않음」이 정상 값이라 필수 표시를 붙이지 않는다. */}
      <div className="field-cell">
        <FieldLabel htmlFor={expectedDateId} label={t.fields.expectedReceiptDate} />
        <DatePicker
          id={expectedDateId}
          mode="single"
          placeholder={messages.common.selectDate}
          value={values.expectedReceiptDate === '' ? null : values.expectedReceiptDate}
          disabled={isLocked}
          onChange={(value) => {
            onChange({ expectedReceiptDate: value });
          }}
        />
      </div>
    </div>
  );
};
