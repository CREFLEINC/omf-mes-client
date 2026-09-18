import { Button, Chip, Select, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

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
  onActivate: () => void;
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
  /** 값이 비었을 때 선택칸 안에 보일 안내. 값·검증에는 영향이 없다. */
  placeholder?: string;
  /** 라벨 옆 안내 칩(info). note와 달리 칸 아래가 아니라 라벨 줄에 둔다. */
  labelHint?: string;
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
  placeholder,
  labelHint,
}: SelectFieldProps) => {
  const id = useId();
  const describedById = `${id}-note`;
  const hintId = `${id}-hint`;
  const description = error ?? note;
  const describedBy =
    [labelHint ? hintId : null, description ? describedById : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="field-cell">
      {/*
       * 필수 표시는 <label> 밖에 두되 같은 줄에 오도록 .field-label 안으로 올린다.
       * 밖에 두면 .field-label이 블록 서식이라 별도 줄로 떨어지고,
       * 안에 넣으면 접근성 이름이 「이름 *」이 되어 라벨 조회가 깨진다.
       */}
      <span className="field-label warehouse-location-field-label">
        <span>
          <label htmlFor={id}>{label}</label>
          {required && <span aria-hidden="true"> *</span>}
        </span>
        {/* Lot Status 전이 화면 「최근 전이 기간」과 같은 라벨 옆 안내 칩 — 문구는 자르지 않는다. */}
        {labelHint && (
          <Chip id={hintId} size="sm" status="info">
            {labelHint}
          </Chip>
        )}
      </span>
      <Select
        id={id}
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        invalid={Boolean(error)}
        aria-required={required || undefined}
        aria-describedby={describedBy}
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
  onActivate,
}: WarehouseFormPaneProps) => {
  const activeLabelId = useId();
  const externalLabelId = useId();
  const defectLabelId = useId();
  const historyNoteId = useId();

  return (
    <section className="warehouse-location-form" aria-label={t.tabs.warehouse}>
      {banner}

      <div className="form-grid">
        <SelectField
          label={t.fields.plant}
          options={lookups.plants}
          value={values.plantId}
          onChange={(value) => onChange({ plantId: value })}
          disabled={mode === 'edit'}
          labelHint={mode === 'edit' ? t.actionReasons.plantFixedAfterCreate : undefined}
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
          options={lookups.warehouseTypes}
          value={values.warehouseTypeCode}
          onChange={(value) => onChange({ warehouseTypeCode: value })}
          error={fieldErrors.warehouseTypeCode}
        />

        <SelectField
          label={t.fields.managementLevel}
          options={lookups.managementLevels}
          value={values.managementLevelCode}
          onChange={(value) => onChange({ managementLevelCode: value })}
          error={fieldErrors.managementLevelCode}
        />

        {/*
         * 토글은 라벨 바로 오른쪽에 한 줄로 두고 세로 가운데를 맞춘다(사용자 지시 2026-09-18 ·
         * omf-all-around#17). 칸 자리·순서는 그대로다. 켬/끔 글자는 붙이지 않는다.
         */}
        <div className="field-cell warehouse-location-switch-cell">
          <span className="field-label" id={externalLabelId}>
            {t.fields.isExternal}
          </span>
          <Switch
            aria-labelledby={externalLabelId}
            checked={values.isExternal}
            onChange={(event) => onChange({ isExternal: event.target.checked })}
          />
        </div>

        <div className="field-cell warehouse-location-switch-cell">
          <span className="field-label" id={defectLabelId}>
            {t.fields.isDefect}
          </span>
          <Switch
            aria-labelledby={defectLabelId}
            checked={values.isDefect}
            onChange={(event) => onChange({ isDefect: event.target.checked })}
          />
        </div>

        <SelectField
          label={t.fields.partner}
          required={values.isExternal}
          options={lookups.partners}
          value={values.partnerId}
          onChange={(value) => onChange({ partnerId: value })}
          error={fieldErrors.partnerId}
          placeholder={t.placeholders.partner}
        />

        {/*
         * 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다.
         * 상태(칩)와 상태를 바꾸는 액션(단추)을 한 줄에 나란히 두어 역할을 가른다(omf-all-around#17).
         */}
        <div className="field-cell">
          <span className="field-label" id={activeLabelId}>
            {t.fields.isActive}
          </span>
          <div className="warehouse-location-status">
            <Chip aria-labelledby={activeLabelId} status={isActive ? 'success' : 'idle'}>
              {isActive ? t.values.active : t.values.inactive}
            </Chip>
            {/* 아직 등록되지 않은 창고에는 사용 중지할 대상이 없다. */}
            {mode === 'edit' && (
              <Button variant="outlined" onClick={isActive ? onDeactivate : onActivate}>
                {isActive ? messages.common.deactivate : t.actions.activate}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="form-actions warehouse-location-form-actions">
        {/*
         * 사유가 붙은 보조 액션은 줄 왼쪽에, 주 액션(취소·저장)은 오른쪽에 남긴다.
         * variant는 outlined여야 한다 — text는 비활성일 때 흐린 글자만 남아 버튼으로 읽히지 않는다.
         */}
        <div className="field-cell form-actions-secondary">
          <Button variant="outlined" disabled aria-describedby={historyNoteId}>
            {t.actions.changeHistory}
          </Button>
          {/* 공장 안내와 같은 안내 칩 — 버튼의 설명(aria-describedby)으로 계속 잇는다. */}
          <Chip id={historyNoteId} size="sm" status="info">
            {t.actionReasons.changeHistoryUnavailable}
          </Chip>
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
