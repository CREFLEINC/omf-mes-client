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
  /** 라벨 옆 도움말. note와 달리 칸 아래가 아니라 라벨 줄에 둔다. */
  labelHint?: string;
  /** 선택칸 오른쪽 같은 줄에 붙일 요소. 선택칸은 남은 폭을 채운다. */
  trailing?: ReactNode;
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
  trailing,
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
        {/* 라벨 옆 도움말 — 문구는 자르지 않는다. */}
        {labelHint && (
          <span id={hintId} className="field-note warehouse-location-inline-note">
            {labelHint}
          </span>
        )}
      </span>
      <div className="warehouse-location-field-row">
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
        {trailing}
      </div>
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
        {/*
         * 공장과 사용 상태를 한 칸 안에 나란히 둔다 — 둘 다 「라벨 위 · 값 아래」(사용자 결정 2026-09-18 ·
         * omf-all-around#17). 사용 상태는 값 표기(칩)이고, 상태를 바꾸는 단추는 바닥글에 있다.
         */}
        <div className="warehouse-location-plant-row">
          <SelectField
            label={t.fields.plant}
            options={lookups.plants}
            value={values.plantId}
            onChange={(value) => onChange({ plantId: value })}
            disabled={mode === 'edit'}
            labelHint={mode === 'edit' ? t.actionReasons.plantFixedAfterCreate : undefined}
          />
          <div className="field-cell">
            <span className="field-label" id={activeLabelId}>
              {t.fields.isActive}
            </span>
            <div className="warehouse-location-status">
              <Chip aria-labelledby={activeLabelId} status={isActive ? 'success' : 'idle'}>
                {isActive ? t.values.active : t.values.inactive}
              </Chip>
            </div>
          </div>
        </div>

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
          /*
           * 외부 창고·불량 창고 토글은 유형·수준 선택칸 오른쪽 같은 줄에 둔다(사용자 결정 2026-09-18 ·
           * omf-all-around#17). 토글만 따로 쓰던 줄을 없앤다. 켬/끔 글자는 붙이지 않는다.
           */
          trailing={
            <div className="warehouse-location-inline-field">
              <span id={externalLabelId}>{t.fields.isExternal}</span>
              <Switch
                aria-labelledby={externalLabelId}
                checked={values.isExternal}
                onChange={(event) => onChange({ isExternal: event.target.checked })}
              />
            </div>
          }
        />

        <SelectField
          label={t.fields.managementLevel}
          options={lookups.managementLevels}
          value={values.managementLevelCode}
          onChange={(value) => onChange({ managementLevelCode: value })}
          error={fieldErrors.managementLevelCode}
          /* 폼의 현재 값 기준 — 「창고」를 고르는 순간 Location을 두지 않는다는 것을 알린다(omf-all-around#17). */
          labelHint={
            values.managementLevelCode === 'WAREHOUSE'
              ? t.actionReasons.managementLevelWarehouseNoLocation
              : undefined
          }
          trailing={
            <div className="warehouse-location-inline-field">
              <span id={defectLabelId}>{t.fields.isDefect}</span>
              <Switch
                aria-labelledby={defectLabelId}
                checked={values.isDefect}
                onChange={(event) => onChange({ isDefect: event.target.checked })}
              />
            </div>
          }
        />

        <SelectField
          label={t.fields.partner}
          required={values.isExternal}
          options={lookups.partners}
          value={values.partnerId}
          onChange={(value) => onChange({ partnerId: value })}
          error={fieldErrors.partnerId}
          placeholder={t.placeholders.partner}
        />
      </div>

      <div className="form-actions warehouse-location-form-actions">
        {/*
         * 사유가 붙은 보조 액션은 줄 왼쪽에, 주 액션(취소·저장)은 오른쪽에 남긴다.
         * variant는 outlined여야 한다 — text는 비활성일 때 흐린 글자만 남아 버튼으로 읽히지 않는다.
         */}
        <div className="field-cell form-actions-secondary">
          {/*
           * 상태를 바꾸는 액션은 바닥글 왼쪽 맨 앞 — 오른쪽의 폼 저장 액션(취소·저장)과 가른다
           * (사용자 지시 2026-09-18 · omf-all-around#17). 아직 등록되지 않은 창고에는 사용 중지할 대상이 없다.
           */}
          {mode === 'edit' && (
            <Button
              className="warehouse-location-status-action"
              variant="outlined"
              onClick={isActive ? onDeactivate : onActivate}
            >
              {isActive ? messages.common.deactivate : t.actions.activate}
            </Button>
          )}
          <Button variant="outlined" disabled aria-describedby={historyNoteId}>
            {t.actions.changeHistory}
          </Button>
          {/* 버튼 옆 도움말 — 버튼의 설명(aria-describedby)으로 계속 잇는다. */}
          <span id={historyNoteId} className="field-note warehouse-location-inline-note">
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
