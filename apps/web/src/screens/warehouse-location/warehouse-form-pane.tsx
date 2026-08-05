import { Button, Select, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { MANAGEMENT_LEVEL_OPTIONS, WAREHOUSE_TYPE_OPTIONS } from './code-options';
import type { LookupOptions, WarehouseFormValues } from './types';

export interface WarehouseFormPaneProps {
  mode: 'create' | 'edit';
  values: WarehouseFormValues;
  onChange: (patch: Partial<WarehouseFormValues>) => void;
  /** 필드별 인라인 오류. Phase 1은 fixture로 주입한다 */
  fieldErrors: Record<string, string>;
  /** 저장 충돌·화면 단위 오류 배너 슬롯 */
  banner: ReactNode;
  /** null이면 창고코드 편집 가능 */
  codeLockReason: string | null;
  isActive: boolean;
  isDirty: boolean;
  isSaving: boolean;
  lookups: LookupOptions;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
}

const t = messages.warehouseLocation;

/**
 * DS `Select`에는 `label` prop이 없다. 라벨을 직접 만들어 `htmlFor`로 이어야
 * 스크린리더 접근명과 테스트의 라벨 조회가 함께 성립한다.
 *
 * 비활성 사유·보조 안내는 항상 보이는 DOM 텍스트로 렌더하고 `aria-describedby`로 잇는다.
 * 비활성 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿지 못한다.
 *
 * 기존 컴포넌트의 조합이므로 이 화면 슬라이스가 소유한다. 세 번째 사용처가 생기면
 * 그때 공용 부품으로 올릴지 판단한다 — 조합물을 미리 디자인 시스템으로 올리지 않는다.
 *
 * 라벨 층·필수 표시 위치의 근거는 docs/layout-conventions.md 규범 3에 있다.
 */
export interface SelectFieldProps {
  label: string;
  required?: boolean;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  note?: string;
}

export const SelectField = ({
  label,
  required = false,
  options,
  value,
  onChange,
  disabled = false,
  error,
  note,
}: SelectFieldProps) => {
  const id = useId();
  const describedById = `${id}-note`;
  const description = error ?? note;

  return (
    <div className="field-cell">
      {/*
       * 필수 표시는 <label> 밖에 두되 같은 줄에 오도록 .field-label 안으로 올린다.
       * 밖에 두면 .field-label이 블록 서식이라 별도 줄로 떨어지고,
       * 안에 넣으면 접근성 이름이 「이름 *」이 되어 라벨 조회가 깨진다.
       */}
      <span className="field-label">
        <label htmlFor={id}>{label}</label>
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <Select
        id={id}
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        invalid={Boolean(error)}
        aria-required={required || undefined}
        aria-describedby={description ? describedById : undefined}
      />
      {description && (
        <span id={describedById} className={error ? 'field-error' : 'field-note'}>
          {description}
        </span>
      )}
    </div>
  );
};

export const WarehouseFormPane = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  isActive,
  isDirty,
  isSaving,
  lookups,
  onSave,
  onCancel,
  onDeactivate,
}: WarehouseFormPaneProps) => {
  const activeLabelId = useId();
  const historyNoteId = useId();

  return (
    <section aria-label={t.tabs.warehouse}>
      {banner}

      <div className="form-grid">
        <SelectField
          label={t.fields.plant}
          options={lookups.plants}
          value={values.plantId}
          onChange={(value) => onChange({ plantId: value })}
          disabled={mode === 'edit'}
          note={mode === 'edit' ? t.actionReasons.plantFixedAfterCreate : undefined}
        />

        <SelectField
          label={t.fields.businessUnit}
          options={lookups.businessUnits}
          value={values.businessUnitId}
          onChange={(value) => onChange({ businessUnitId: value })}
        />

        <TextField
          label={t.fields.warehouseCode}
          value={values.warehouseCode}
          onChange={(event) => onChange({ warehouseCode: event.target.value })}
          disabled={codeLockReason !== null}
          disabledReason={codeLockReason}
          error={fieldErrors.warehouseCode}
        />

        <TextField
          label={t.fields.warehouseName}
          value={values.warehouseName}
          onChange={(event) => onChange({ warehouseName: event.target.value })}
          error={fieldErrors.warehouseName}
        />

        <SelectField
          label={t.fields.warehouseType}
          options={WAREHOUSE_TYPE_OPTIONS}
          value={values.warehouseTypeCode}
          onChange={(value) => onChange({ warehouseTypeCode: value })}
          error={fieldErrors.warehouseTypeCode}
        />

        <SelectField
          label={t.fields.managementLevel}
          options={MANAGEMENT_LEVEL_OPTIONS}
          value={values.managementLevelCode}
          onChange={(value) => onChange({ managementLevelCode: value })}
          note={messages.pendingCode.note}
        />

        <Switch
          label={t.fields.isExternal}
          checked={values.isExternal}
          onChange={(event) => onChange({ isExternal: event.target.checked })}
        />

        <SelectField
          label={t.fields.partner}
          required={values.isExternal}
          options={lookups.partners}
          value={values.partnerId}
          onChange={(value) => onChange({ partnerId: value })}
          error={fieldErrors.partnerId}
        />

        {/* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다. */}
        <div>
          <span className="field-label" id={activeLabelId}>
            {t.fields.isActive}
          </span>
          <p aria-labelledby={activeLabelId}>{isActive ? t.values.active : t.values.inactive}</p>
          {isActive && (
            <Button variant="outlined" onClick={onDeactivate}>
              {messages.common.deactivate}
            </Button>
          )}
        </div>
      </div>

      <div className="form-actions">
        <div>
          <Button variant="text" disabled aria-describedby={historyNoteId}>
            {t.actions.changeHistory}
          </Button>
          <span id={historyNoteId} className="field-note">
            {t.actionReasons.changeHistoryUnavailable}
          </span>
        </div>
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
