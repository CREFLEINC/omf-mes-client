import { Button, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { fifoPolicyOptions } from './code-catalog';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { ItemAttrsFormValues } from './types';
import { ValueField } from './value-field';

const t = messages.itemExtendedAttrs;

export interface ItemAttrsPaneProps {
  values: ItemAttrsFormValues;
  /**
   * 조회한 사용 여부. **입력칸이 아니라 값 표기로만 낸다**(결정 3) —
   * 저장할 때는 이 값이 그대로 되돌아 실린다.
   */
  isActive: boolean;
  onChange: (patch: Partial<ItemAttrsFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * 탭① — 확장 속성. **이 화면에서 저장이 있는 유일한 구획이다**(PR ① 기준).
 *
 * **원본 4열이 여기 없다.** 원본은 위 구획에서 값으로만 보이고, 이 폼은 계약의 `ItemUpdate`가
 * 담는 항목만 다룬다 — 서버가 그 경계를 막지 않으므로 화면이 형태로 지킨다.
 *
 * **값 목록이 확정되지 않은 코드는 자유 입력이다**(결정 4). 빈 선택지로 두면 저장 자체가
 * 막히고, 값을 지어내면 화면이 계약에 없는 코드 체계를 주장하게 된다.
 * 선출 정책만 선택칸인 이유는 계약이 그 두 값을 이름으로 밝혔기 때문이다.
 *
 * **유효기한 관리를 켜도 선출 정책이 따라 바뀌지 않는다**(이슈 #14 §4). 경고도 내지 않는다 —
 * 경고는 자동 연동의 절반이라 사용자가 무엇이 강제인지 알 수 없게 된다.
 */
export const ItemAttrsPane = ({
  values,
  isActive,
  onChange,
  fieldErrors,
  banner,
  isDirty,
  isSaving,
  onSave,
  onCancel,
}: ItemAttrsPaneProps) => {
  const serialId = useId();
  const shelfLifeDaysId = useId();
  const storageId = useId();
  const openedId = useId();

  return (
    <section className="pane" aria-label={t.panes.itemAttrs}>
      {banner}

      <div className="form-grid">
        {/*
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
         */}
        <div className="field-cell">
          <Switch
            label={t.attrs.fields.lotControlled}
            checked={values.lotControlled}
            onChange={(event) => onChange({ lotControlled: event.target.checked })}
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={serialId} label={t.attrs.fields.serialControlType} required />
          <TextField
            id={serialId}
            value={values.serialControlTypeCode}
            onChange={(event) => onChange({ serialControlTypeCode: event.target.value })}
            error={fieldErrors.serialControlTypeCode}
            aria-required
          />
        </div>

        {/*
         * 계약에 이 토글의 컬럼이 없다 — 유효기한(일)의 널 여부가 곧 이 스위치다(§8-2).
         * 그래서 두 항목을 나란히 둔다. 떨어뜨려 놓으면 무엇이 무엇을 켜는지 읽히지 않는다.
         */}
        <div className="field-cell">
          <Switch
            label={t.attrs.fields.shelfLifeManaged}
            checked={values.shelfLifeManaged}
            onChange={(event) => onChange({ shelfLifeManaged: event.target.checked })}
          />
        </div>

        <div className="field-cell">
          <FieldLabel
            htmlFor={shelfLifeDaysId}
            label={t.attrs.fields.shelfLifeDays}
            required={values.shelfLifeManaged}
          />
          <TextField
            id={shelfLifeDaysId}
            type="number"
            step={1}
            min={0}
            value={values.shelfLifeDays}
            onChange={(event) => onChange({ shelfLifeDays: event.target.value })}
            error={fieldErrors.shelfLifeDays}
            aria-required={values.shelfLifeManaged || undefined}
          />
        </div>

        <div className="field-cell">
          <Switch
            label={t.attrs.fields.inspectionRequired}
            checked={values.inspectionRequired}
            onChange={(event) => onChange({ inspectionRequired: event.target.checked })}
          />
        </div>

        {/*
         * 규범 3-1로 충분하다 — 선택지 문구가 네 자(`FIFO`·`FEFO`)라 트리거 폭에 갇히지 않는다.
         * `.wide-select`의 판단 기준은 코드값이 아니라 **선택지 문구 길이**다.
         */}
        <SelectField
          label={t.attrs.fields.fifoPolicy}
          required
          options={fifoPolicyOptions(values.fifoPolicyCode)}
          value={values.fifoPolicyCode}
          onChange={(value) => onChange({ fifoPolicyCode: value })}
          error={fieldErrors.fifoPolicyCode}
        />

        <div className="field-cell">
          <Switch
            label={t.attrs.fields.negativeStockAllowed}
            checked={values.negativeStockAllowed}
            onChange={(event) => onChange({ negativeStockAllowed: event.target.checked })}
          />
        </div>

        {/* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={storageId} label={t.attrs.fields.storageCondition} />
          <TextField
            id={storageId}
            value={values.storageConditionCode}
            onChange={(event) => onChange({ storageConditionCode: event.target.value })}
            error={fieldErrors.storageConditionCode}
          />
        </div>

        {/* 계약 `exclusiveMinimum: 0` — 유효기한(일)과 하한 규칙이 다르다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={openedId} label={t.attrs.fields.openedShelfLifeHours} />
          <TextField
            id={openedId}
            type="number"
            step={1}
            min={1}
            value={values.openedShelfLifeHours}
            onChange={(event) => onChange({ openedShelfLifeHours: event.target.value })}
            error={fieldErrors.openedShelfLifeHours}
          />
        </div>

        {/*
         * **사용 여부에 컨트롤을 두지 않는다.** 계약이 저장 본문에 필수로 요구하지만
         * 같은 계약이 「사용 중지 액션이 화면에 없다」고 못 박았다 — 값 표기로 내고
         * 저장할 때 조회값을 그대로 되돌려 싣는다(결정 3).
         *
         * 원본이 아니라 확장 구획에 둔다. 원본 4열이 아니기 때문이다.
         */}
        <div className="field-cell">
          <ValueField
            label={t.attrs.fields.isActive}
            value={isActive ? t.attrs.values.active : t.attrs.values.inactive}
          />
          <span className="field-note">{t.attrs.isActiveNote}</span>
        </div>
      </div>

      <div className="form-actions">
        {/* 수정에서 「취소」는 기준값으로 되돌리는 것이라 고친 것이 있을 때만 의미가 있다. */}
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {messages.common.save}
        </Button>
      </div>
    </section>
  );
};
