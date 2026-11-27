import { Button, Chip, Dialog, Icon, Switch } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { Select } from '../../patterns/select';
import { UsageChip } from '../../patterns/usage-chip';
import {
  ConfirmTarget,
  IdentityHeader,
  type LocationFact,
  LocationFacts,
} from './location-identity';
import type { LookupOptions, WarehouseFormValues } from './types';

export interface WarehouseFormPaneProps {
  values: WarehouseFormValues;
  /** 저장된 값 — 바꾼 칸 이름 옆에 점을 찍는 기준. 없으면 점을 찍지 않는다. */
  baseline?: WarehouseFormValues | undefined;
  onChange: (patch: Partial<WarehouseFormValues>) => void;
  /** 필드별 인라인 오류 */
  fieldErrors: Record<string, string>;
  /** 저장 충돌·화면 단위 오류 배너 슬롯 */
  banner: ReactNode;
  isActive: boolean;
  lookups: LookupOptions;
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

interface PendingFlag {
  field: 'isExternal' | 'isDefect';
  value: boolean;
}

const flagConfirmTitle = ({ field, value }: PendingFlag): string => {
  const confirm = field === 'isExternal' ? t.externalConfirm : t.defectConfirm;

  return value ? confirm.on : confirm.off;
};

/**
 * 창고 정보 수정 창의 본문 — 머리(창고 · 코드 · 창고명 · 칩) · 옅은 정보 판(고칠 값만 연필, 불량 · 외부는 스위치) · 「사용
 * 상태」 줄. 취소 · 저장은 창 바닥에 있다(안 B, 사용자 결정 2026-11-24). 창고 등록은 화면에서 뺐다(사용자 결정 2026-11-27).
 */
export const WarehouseFormPane = ({
  values,
  baseline,
  onChange,
  fieldErrors,
  banner,
  isActive,
  lookups,
  onDeactivate,
  onActivate,
}: WarehouseFormPaneProps) => {
  /*
   * 불량 창고는 바꾸기 전에 한 번 묻는다(사용자 지시 2026-10-30) — 확인하면 값이 바뀌고 저장이 켜진다. 확인을 곧 저장으로
   * 보내지 않는다: 수정 본문은 칸 전부를 싣는 PUT 이라 연필로 고쳐 둔 다른 값까지 함께 나가거나, 그것을 빼려면 저장된
   * 값과 섞은 본문을 따로 지어야 한다. 바꾼 값은 다른 값과 같이 점으로 보이고 저장 · 취소로 한꺼번에 다룬다.
   */
  /* 외부 · 불량 스위치는 한 번 묻고 바꾼다(사용자 지시 2026-10-30). */
  const [pendingFlag, setPendingFlag] = useState<PendingFlag | null>(null);

  const changed = (field: keyof WarehouseFormValues): boolean =>
    baseline !== undefined && values[field] !== baseline[field];

  const facts: LocationFact[] = [
    { label: t.fields.plant, value: labelOf(lookups.plants, values.plantId) },
    {
      label: t.fields.businessUnit,
      value: labelOf(lookups.businessUnits, values.businessUnitId),
      required: true,
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
      required: true,
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
    <section className="warehouse-location-form warehouse-info" aria-label={t.sections.warehouse}>
      {banner}

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
      />
      {identityErrors.map((error) => (
        <span key={error} className="field-error">
          {error}
        </span>
      ))}
      <LocationFacts facts={facts} />
      {/* 사용 중지는 저장과 다른 일이라 창 바닥이 아니라 본문에 — 지금 상태와 바꾸는 단추를 한 줄에(사용자 지시 2026-11-24). */}
      <div className="warehouse-info-state">
        <span className="warehouse-info-state-label">{t.fields.isActive}</span>
        <UsageChip isActive={isActive} />
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
