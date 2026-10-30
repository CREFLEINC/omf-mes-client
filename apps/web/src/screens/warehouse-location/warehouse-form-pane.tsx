import { Button, Chip, Dialog, Icon, SkeletonText, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { LOCATION_LEVEL_CODES } from '../../patterns/location-level';
import { levelIconOf, levelNameOf } from '../../patterns/location-tree-cell';
import { Select } from '../../patterns/select';
import {
  ConfirmTarget,
  IdentityHeader,
  type LocationFact,
  LocationFacts,
} from './location-identity';
import { summarizeLocations } from './location-summary';
import type { Location, LookupOptions, WarehouseFormValues } from './types';

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
   * 고칠 때의 Location 묶음 — Location 탭이 받는 목록(미사용 포함). `items` 가 null 이면 아직 받는 중, `error` 는
   * 받지 못했을 때 그 자리에 둘 배너.
   */
  locations?: { items: readonly Location[] | null; error: ReactNode } | undefined;
  /** 「Location 탭에서 보기」 — 옆 탭을 연다. */
  onOpenLocations?: (() => void) | undefined;
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

/** 창고 추가 — 머리 · 필수 칸 · 바닥. 값 순서는 보기와 같다(공장 · 코드 · 창고명 / 사업부 · 유형 · 불량 · 외부). */
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
      {/*
       * 불량 창고는 유형 옆 칸에 — 등록 때는 아직 창고가 없어 묻지 않고 바로 바뀐다. 외부 창고는 MES 가 관리할 대상이
       * 아니라 칸이 없다(사용자 지시 2026-10-30).
       */}
      <div className="warehouse-info-create-flags">
        <Switch
          label={t.fields.isDefect}
          labelPlacement="start"
          checked={values.isDefect}
          onChange={(event) => onChange({ isDefect: event.target.checked })}
        />
      </div>
    </div>
  </>
);

const STAT_ICON_SIZE = 18;

/** 창고 정보의 Location 묶음 — 위치 수 · 단계별 수 · 사용 중지 수 · 서버가 만든 위치 · 옆 탭으로. */
const WarehouseLocationSummary = ({
  locations,
  onOpenLocations,
}: {
  locations: NonNullable<WarehouseFormPaneProps['locations']>;
  onOpenLocations: WarehouseFormPaneProps['onOpenLocations'];
}) => {
  const baseId = useId();
  const summary = locations.items === null ? null : summarizeLocations(locations.items);
  const stats =
    summary === null
      ? []
      : [
          ...LOCATION_LEVEL_CODES.map((level) => ({
            key: level,
            label: t.values.locationLevels[level],
            icon: levelIconOf({ locationLevelCode: level, systemRoleCode: null }),
            count: summary.levels[level],
          })),
          {
            key: 'inactive',
            label: messages.common.deactivate,
            icon: { name: 'block', tone: 'none' },
            count: summary.inactive,
          },
        ];

  return (
    <section className="location-section" aria-label={t.tabs.location}>
      <div className="warehouse-info-section-head">
        <h3 className="location-section-title">
          {t.tabs.location}
          {summary !== null && <span className="location-items-count">{summary.total}</span>}
        </h3>
        {onOpenLocations !== undefined && (
          <Button
            variant="text"
            className="location-state-button"
            leadingIcon={<Icon name="arrow_forward" size={18} />}
            onClick={onOpenLocations}
          >
            {t.actions.viewLocations}
          </Button>
        )}
      </div>
      {locations.error}
      {summary === null ? (
        locations.error === null && (
          <div role="status" aria-label={t.loading.locations}>
            <SkeletonText lines={2} />
          </div>
        )
      ) : (
        <>
          <dl className="warehouse-info-stats">
            {stats.map((stat) => {
              const id = `${baseId}-${stat.key}`;
              return (
                <div
                  key={stat.key}
                  className={
                    stat.count === 0 ? 'warehouse-info-stat is-muted' : 'warehouse-info-stat'
                  }
                >
                  <span className={`location-identity-icon is-${stat.icon.tone}`}>
                    <Icon name={stat.icon.name} size={STAT_ICON_SIZE} />
                  </span>
                  <div className="warehouse-info-stat-text">
                    <dt id={id}>{stat.label}</dt>
                    <dd>
                      <output aria-labelledby={id}>{stat.count}</output>
                    </dd>
                  </div>
                </div>
              );
            })}
          </dl>
          {summary.system.length > 0 && (
            <ul
              className="location-items-list warehouse-info-system"
              aria-label={t.warehouseInfo.systemLocations}
            >
              {summary.system.map((location) => {
                const icon = levelIconOf(location);
                return (
                  <li key={location.locationId} className="location-items-row">
                    <span className={`location-identity-icon is-${icon.tone}`}>
                      <Icon name={icon.name} size={STAT_ICON_SIZE} />
                    </span>
                    <span className="location-items-code">{location.locationCode}</span>
                    <span className="location-items-name">{levelNameOf(location)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

/**
 * 창고 정보 탭(안 A, 사용자 결정 2026-10-30) — 위치 수정 창과 같은 짜임: 머리(창고 · 코드 · 창고명 · 칩) · 옅은 정보 판
 * (고칠 값만 연필, 불량 · 외부는 스위치) · Location 묶음 · 바닥(왼쪽 상태 단추, 오른쪽 취소 · 저장). 등록은 머리와 필수
 * 칸만.
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
  locations,
  onOpenLocations,
}: WarehouseFormPaneProps) => {
  /*
   * 불량 창고는 바꾸기 전에 한 번 묻는다(사용자 지시 2026-10-30) — 확인하면 값이 바뀌고 저장이 켜진다. 확인을 곧 저장으로
   * 보내지 않는다: 수정 본문은 칸 전부를 싣는 PUT 이라 연필로 고쳐 둔 다른 값까지 함께 나가거나, 그것을 빼려면 저장된
   * 값과 섞은 본문을 따로 지어야 한다. 바꾼 값은 다른 값과 같이 점으로 보이고 저장 · 취소로 한꺼번에 다룬다.
   */
  const [pendingDefect, setPendingDefect] = useState<boolean | null>(null);
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
      label: t.fields.isDefect,
      value: '',
      changed: changed('isDefect'),
      control: (
        <Switch
          aria-label={t.fields.isDefect}
          checked={values.isDefect}
          onChange={(event) => setPendingDefect(event.target.checked)}
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
      aria-label={mode === 'create' ? t.actions.addWarehouse : t.tabs.warehouse}
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
              values.isDefect ? (
                <Chip size="sm" status="error">
                  {t.fields.isDefect}
                </Chip>
              ) : undefined
            }
            isActive={isActive}
          />
          {identityErrors.map((error) => (
            <span key={error} className="field-error">
              {error}
            </span>
          ))}
          <LocationFacts key={`${values.warehouseCode}-${String(resetCount)}`} facts={facts} />
          {locations !== undefined && (
            <WarehouseLocationSummary locations={locations} onOpenLocations={onOpenLocations} />
          )}
        </>
      )}

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

      <Dialog
        className="location-dialog"
        open={pendingDefect !== null}
        onClose={() => setPendingDefect(null)}
        size="sm"
        title={pendingDefect === true ? t.defectConfirm.on : t.defectConfirm.off}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button variant="outlined" onClick={() => setPendingDefect(null)}>
              {messages.common.cancel}
            </Button>
            <Button
              onClick={() => {
                if (pendingDefect !== null) onChange({ isDefect: pendingDefect });
                setPendingDefect(null);
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
        />
      </Dialog>
    </section>
  );
};
