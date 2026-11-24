import { Button, Chip, Dialog, Icon, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { Select } from '../../patterns/select';
import {
  ConfirmTarget,
  IdentityHeader,
  type LocationFact,
  LocationFacts,
} from './location-identity';
import { LOCATION_PREFIX_MAX_LENGTH, generateLocationPrefix } from './location-prefix';
import type { LookupOptions, WarehouseFormValues } from './types';

export interface WarehouseFormPaneProps {
  mode: 'create' | 'edit';
  values: WarehouseFormValues;
  /** 저장된 값 — 고칠 때 바꾼 칸 이름 옆에 점을 찍는 기준. 없으면 점을 찍지 않는다. */
  baseline?: WarehouseFormValues | undefined;
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
  /**
   * 바닥 단추 줄(사용 중지 · 취소 · 저장)을 판 안에 둘지 — 창고 정보 수정 창은 취소 · 저장을 창 바닥에 두므로 끈다.
   * 끄면 사용 중지 · 다시 사용은 본문 맨 아래 「사용 상태」 줄로 옮긴다(사용자 지시 2026-11-24).
   */
  showActions?: boolean;
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
          {required && (
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          )}
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

const labelOf = (options: { value: string; label: string }[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? value;

/**
 * 창고 위치 코드(omf-all-around#292) — 등록 폼을 여는 쪽이 무작위로 지어 채운다. 사람은 고치거나 [다시 만들기]로 새로
 * 짓는다. 친 글자는 대문자로 바꾼다. 형식 · 저장 뒤 못 바꿈은 라벨 옆 ⓘ 가 말하고(관리웹 정리 시안 A), 칸 아래에는
 * 오류(형식 · 다른 창고가 쓰는 코드)만 나타난다. 그 아래 위치 코드 예가 친 값을 따라 바뀐다.
 */
const LocationPrefixField = ({
  value,
  error,
  onChange,
}: {
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) => {
  const id = useId();

  return (
    <div className="field-cell warehouse-info-prefix">
      {/* 칸과 단추를 한 줄에 두려고 이름을 칸 밖에 둔다 — 짜임은 `SelectField` 와 같다. */}
      <span className="field-label warehouse-location-field-label">
        <span>
          <label htmlFor={id}>{t.locationPrefix.label}</label>
          <span className="required-mark" aria-hidden="true">
            {' *'}
          </span>
        </span>
        <InfoTip text={t.locationPrefix.helper} />
      </span>
      <div className="warehouse-location-field-row">
        <TextField
          id={id}
          required
          value={value}
          maxLength={LOCATION_PREFIX_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          error={error}
        />
        <Button
          variant="outlined"
          leadingIcon={<Icon name="refresh" size={18} />}
          onClick={() => onChange(generateLocationPrefix())}
        >
          {t.locationPrefix.regenerate}
        </Button>
      </div>
      <span className="field-note">{t.locationPrefix.example(value)}</span>
    </div>
  );
};

/** 창고 추가 — 머리 · 필수 칸 · 바닥. 값 순서는 보기와 같다(공장 · 코드 · 창고명 / 사업부 · 유형 · 불량 · 외부 / 창고 위치 코드). */
const WarehouseCreateFields = ({
  values,
  onChange,
  fieldErrors,
  codeLockReason,
  lookups,
}: Pick<
  WarehouseFormPaneProps,
  'values' | 'onChange' | 'fieldErrors' | 'codeLockReason' | 'lookups'
>) => (
  <>
    <div className="warehouse-info-create-head">
      <span className="location-identity-icon is-zone">
        <Icon name="add_business" size={24} />
      </span>
      <h3 className="warehouse-info-create-title">{t.actions.addWarehouse}</h3>
    </div>
    <div className="form-grid warehouse-info-create-grid">
      <SelectField
        label={t.fields.plant}
        required
        options={lookups.plants}
        value={values.plantId}
        onChange={(value) => onChange({ plantId: value })}
        error={fieldErrors.plantId}
      />
      <TextField
        label={t.fields.warehouseCode}
        required
        value={values.warehouseCode}
        onChange={(event) => onChange({ warehouseCode: event.target.value })}
        disabled={codeLockReason !== null}
        disabledReason={codeLockReason}
        error={fieldErrors.warehouseCode}
      />
      <TextField
        label={t.fields.warehouseName}
        required
        value={values.warehouseName}
        onChange={(event) => onChange({ warehouseName: event.target.value })}
        error={fieldErrors.warehouseName}
      />
      <SelectField
        label={t.fields.businessUnit}
        required
        options={lookups.businessUnits}
        value={values.businessUnitId}
        onChange={(value) => onChange({ businessUnitId: value })}
        error={fieldErrors.businessUnitId}
      />
      <SelectField
        label={t.fields.warehouseType}
        required
        options={lookups.warehouseTypes}
        value={values.warehouseTypeCode}
        onChange={(value) => onChange({ warehouseTypeCode: value })}
        error={fieldErrors.warehouseTypeCode}
        placeholder={t.values.selectPlaceholder}
      />
      {/* 외부 · 불량 창고는 유형 옆 칸에 — 등록 때는 아직 창고가 없어 묻지 않고 바로 바뀐다. */}
      <div className="warehouse-info-create-flags">
        <Switch
          label={t.fields.isExternal}
          labelPlacement="start"
          checked={values.isExternal}
          onChange={(event) => onChange({ isExternal: event.target.checked })}
        />
        <Switch
          label={t.fields.isDefect}
          labelPlacement="start"
          checked={values.isDefect}
          onChange={(event) => onChange({ isDefect: event.target.checked })}
        />
      </div>
    </div>
    <LocationPrefixField
      value={values.locationPrefix}
      error={fieldErrors.locationPrefix}
      onChange={(value) => onChange({ locationPrefix: value })}
    />
  </>
);

interface PendingFlag {
  field: 'isExternal' | 'isDefect';
  value: boolean;
}

const flagConfirmTitle = ({ field, value }: PendingFlag): string => {
  const confirm = field === 'isExternal' ? t.externalConfirm : t.defectConfirm;

  return value ? confirm.on : confirm.off;
};

/**
 * 창고 정보 판 — 위치 수정 창과 같은 짜임: 머리(창고 · 코드 · 창고명 · 칩) · 옅은 정보 판(고칠 값만 연필, 불량 · 외부는
 * 스위치) · 바닥(왼쪽 상태 단추, 오른쪽 취소 · 저장). 등록은 오른쪽 창에, 수정은 [창고 정보] 창 안에 둔다(안 B, 사용자 결정
 * 2026-11-24). 등록은 머리와 필수 칸만.
 */
export const WarehouseFormPane = ({
  mode,
  values,
  baseline,
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
  showActions = true,
}: WarehouseFormPaneProps) => {
  /*
   * 불량 창고는 바꾸기 전에 한 번 묻는다(사용자 지시 2026-10-30) — 확인하면 값이 바뀌고 저장이 켜진다. 확인을 곧 저장으로
   * 보내지 않는다: 수정 본문은 칸 전부를 싣는 PUT 이라 연필로 고쳐 둔 다른 값까지 함께 나가거나, 그것을 빼려면 저장된
   * 값과 섞은 본문을 따로 지어야 한다. 바꾼 값은 다른 값과 같이 점으로 보이고 저장 · 취소로 한꺼번에 다룬다.
   */
  /* 외부 · 불량 스위치는 한 번 묻고 바꾼다(사용자 지시 2026-10-30). */
  const [pendingFlag, setPendingFlag] = useState<PendingFlag | null>(null);
  /* 취소하면 열어 둔 연필 칸도 닫는다 — 정보 판을 새로 그린다. */
  const [resetCount, setResetCount] = useState(0);

  const changed = (field: keyof WarehouseFormValues): boolean =>
    baseline !== undefined && values[field] !== baseline[field];

  const facts: LocationFact[] = [
    { label: t.fields.plant, value: labelOf(lookups.plants, values.plantId) },
    {
      label: t.fields.businessUnit,
      value: labelOf(lookups.businessUnits, values.businessUnitId),
      error: fieldErrors.businessUnitId,
      changed: changed('businessUnitId'),
      edit: {
        onChange: (value) => onChange({ businessUnitId: value }),
        select: { value: values.businessUnitId, options: lookups.businessUnits },
      },
    },
    {
      label: t.fields.warehouseType,
      value: labelOf(lookups.warehouseTypes, values.warehouseTypeCode),
      error: fieldErrors.warehouseTypeCode,
      changed: changed('warehouseTypeCode'),
      edit: {
        onChange: (value) => onChange({ warehouseTypeCode: value }),
        select: { value: values.warehouseTypeCode, options: lookups.warehouseTypes },
      },
    },
    {
      label: t.fields.isExternal,
      value: '',
      changed: changed('isExternal'),
      control: (
        <Switch
          aria-label={t.fields.isExternal}
          checked={values.isExternal}
          onChange={(event) => setPendingFlag({ field: 'isExternal', value: event.target.checked })}
        />
      ),
    },
    {
      label: t.fields.isDefect,
      value: '',
      changed: changed('isDefect'),
      control: (
        <Switch
          aria-label={t.fields.isDefect}
          checked={values.isDefect}
          onChange={(event) => setPendingFlag({ field: 'isDefect', value: event.target.checked })}
        />
      ),
    },
  ];

  /* 코드 · 창고명은 고칠 수 없어 머리로 올린다. 서버가 그 칸에 붙여 보낸 오류는 머리 밑에 둔다. */
  const identityErrors = [fieldErrors.warehouseCode, fieldErrors.warehouseName].filter(
    (error): error is string => error !== undefined,
  );

  return (
    <section
      className="warehouse-location-form warehouse-info"
      aria-label={mode === 'create' ? t.actions.addWarehouse : t.sections.warehouse}
    >
      {banner}

      {mode === 'create' ? (
        <WarehouseCreateFields
          values={values}
          onChange={onChange}
          fieldErrors={fieldErrors}
          codeLockReason={codeLockReason}
          lookups={lookups}
        />
      ) : (
        <>
          <IdentityHeader
            icon={{ name: 'warehouse', tone: 'zone' }}
            kind={t.fields.warehouse}
            code={values.warehouseCode}
            codeLabel={t.fields.warehouseCode}
            name={values.warehouseName}
            nameLabel={t.fields.warehouseName}
            chips={
              values.isExternal || values.isDefect ? (
                <>
                  {values.isExternal && (
                    <Chip size="sm" status="idle">
                      {t.fields.isExternal}
                    </Chip>
                  )}
                  {values.isDefect && (
                    <Chip size="sm" status="error">
                      {t.fields.isDefect}
                    </Chip>
                  )}
                </>
              ) : undefined
            }
            /* 창 안에서는 「사용 상태」 줄이 상태를 보인다 — 머리에 두 번 두지 않는다. */
            isActive={showActions ? isActive : undefined}
          />
          {identityErrors.map((error) => (
            <span key={error} className="field-error">
              {error}
            </span>
          ))}
          <LocationFacts key={`${values.warehouseCode}-${String(resetCount)}`} facts={facts} />
          {!showActions && (
            /* 사용 중지는 저장과 다른 일이라 바닥이 아니라 본문에 — 지금 상태와 바꾸는 단추를 한 줄에. */
            <div className="warehouse-info-state">
              <span className="warehouse-info-state-label">{t.fields.isActive}</span>
              <Chip size="sm" status={isActive ? 'success' : 'idle'}>
                {isActive ? t.values.active : t.values.inactive}
              </Chip>
              <Button
                variant="outlined"
                size="sm"
                className="location-state-button"
                leadingIcon={<Icon name={isActive ? 'block' : 'restart_alt'} size={18} />}
                onClick={isActive ? onDeactivate : onActivate}
              >
                {isActive ? messages.common.deactivate : t.actions.activate}
              </Button>
            </div>
          )}
        </>
      )}

      {showActions && (
        <div className="form-actions warehouse-location-form-actions">
          {/*
           * 상태를 바꾸는 단추는 바닥 왼쪽 — 오른쪽의 취소 · 저장과 가른다(omf-all-around#17). 위치 창과 같은 아이콘 ·
           * 글자 단추다. 아직 등록되지 않은 창고에는 사용 중지할 대상이 없다.
           */}
          <div className="field-cell form-actions-secondary">
            {mode === 'edit' && (
              <Button
                variant="text"
                className="location-state-button"
                leadingIcon={<Icon name={isActive ? 'block' : 'restart_alt'} size={18} />}
                onClick={isActive ? onDeactivate : onActivate}
              >
                {isActive ? messages.common.deactivate : t.actions.activate}
              </Button>
            )}
          </div>
          <Button
            variant="outlined"
            disabled={!isDirty}
            onClick={() => {
              setResetCount((count) => count + 1);
              onCancel();
            }}
          >
            {messages.common.cancel}
          </Button>
          <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        </div>
      )}

      <Dialog
        className="location-dialog"
        open={pendingFlag !== null}
        onClose={() => setPendingFlag(null)}
        size="sm"
        title={pendingFlag === null ? '' : flagConfirmTitle(pendingFlag)}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button variant="outlined" onClick={() => setPendingFlag(null)}>
              {messages.common.cancel}
            </Button>
            <Button
              onClick={() => {
                if (pendingFlag !== null) onChange({ [pendingFlag.field]: pendingFlag.value });
                setPendingFlag(null);
              }}
            >
              {messages.common.confirm}
            </Button>
          </>
        }
      >
        <ConfirmTarget
          tone="warning"
          icon="warning"
          code={values.warehouseCode}
          name={values.warehouseName}
        >
          {pendingFlag?.field === 'isExternal' && pendingFlag.value && (
            <p className="location-confirm-line">{t.externalConfirm.hiddenNote}</p>
          )}
        </ConfirmTarget>
      </Dialog>
    </section>
  );
};
