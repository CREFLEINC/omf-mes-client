import { Button, Select, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { fifoPolicyOptions } from './code-catalog';
import { FieldLabel } from './field-label';
import type { ItemAttrsFormValues, SelectOption } from './types';

const t = messages.itemExtendedAttrs;

export interface ItemAttrsPaneProps {
  values: ItemAttrsFormValues;
  uomOptions: SelectOption[];
  onChange: (patch: Partial<ItemAttrsFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * W-06-05 품목 탭의 MES 확장 편집 구획 — 설정 항목 표. ERP 원본 열은 여기 두지 않는다 — 고치지 않는 값(MES 구분 ·
 * 사용 여부)은 위 사실 칸(`ItemOriginFacts`)에 있다. 탭 이름이 곧 제목이라 구획 제목을 따로 두지 않는다.
 */
export const ItemAttrsPane = ({
  values,
  uomOptions,
  onChange,
  fieldErrors,
  banner,
  isDirty,
  isSaving,
  onSave,
  onCancel,
}: ItemAttrsPaneProps) => {
  const serialId = useId();
  const lotStorageUomId = useId();
  const productionLotSizeId = useId();
  const lotControlledId = useId();
  const shelfLifeManagedId = useId();
  const fifoId = useId();
  const openedId = useId();
  const inspectionId = useId();
  const negativeStockId = useId();
  const developmentId = useId();
  const storageId = useId();
  const lotStorageUomOptions: SelectOption[] = [
    { value: '', label: t.attrs.values.unspecified },
    ...uomOptions,
  ];

  const groups: SettingGroup[] = [
    {
      label: t.attrs.groups.lot,
      rows: [
        {
          id: lotControlledId,
          label: t.attrs.fields.lotControlled,
          control: (
            <Switch
              id={lotControlledId}
              checked={values.lotControlled}
              onChange={(event) => onChange({ lotControlled: event.target.checked })}
            />
          ),
        },
        {
          id: lotStorageUomId,
          label: t.attrs.fields.defaultLotStorageUom,
          error: fieldErrors.defaultLotStorageUomId,
          control: (
            <Select
              size="sm"
              id={lotStorageUomId}
              options={lotStorageUomOptions}
              value={values.defaultLotStorageUomId}
              onChange={(value) => onChange({ defaultLotStorageUomId: value })}
              invalid={fieldErrors.defaultLotStorageUomId !== undefined}
            />
          ),
        },
        {
          id: productionLotSizeId,
          label: t.attrs.fields.defaultProductionLotSize,
          control: (
            <TextField
              size="sm"
              id={productionLotSizeId}
              type="number"
              step="any"
              value={values.defaultProductionLotSize}
              onChange={(event) => onChange({ defaultProductionLotSize: event.target.value })}
              error={fieldErrors.defaultProductionLotSize}
            />
          ),
        },
        {
          id: serialId,
          label: t.attrs.fields.serialControlType,
          required: true,
          control: (
            <TextField
              size="sm"
              id={serialId}
              value={values.serialControlTypeCode}
              onChange={(event) => onChange({ serialControlTypeCode: event.target.value })}
              error={fieldErrors.serialControlTypeCode}
              aria-required
            />
          ),
        },
      ],
    },
    {
      label: t.attrs.groups.shelfLife,
      rows: [
        {
          id: shelfLifeManagedId,
          label: t.attrs.fields.shelfLifeManaged,
          /* 켜야 일수를 넣는다 — 스위치 옆에 일수 칸이 나타난다(꺼져 있으면 칸이 없다 · 저장 때 비워 보낸다). */
          control: (
            <>
              <Switch
                id={shelfLifeManagedId}
                checked={values.shelfLifeManaged}
                onChange={(event) => onChange({ shelfLifeManaged: event.target.checked })}
              />
              {values.shelfLifeManaged && (
                <span className="item-attrs-inline">
                  <TextField
                    size="sm"
                    aria-label={t.attrs.fields.shelfLifeDays}
                    type="number"
                    step={1}
                    min={0}
                    value={values.shelfLifeDays}
                    onChange={(event) => onChange({ shelfLifeDays: event.target.value })}
                    error={fieldErrors.shelfLifeDays}
                    aria-required
                  />
                  <span className="item-attrs-unit">{t.attrs.units.days}</span>
                </span>
              )}
            </>
          ),
        },
        {
          id: openedId,
          label: t.attrs.fields.openedShelfLifeHours,
          control: (
            <TextField
              size="sm"
              id={openedId}
              type="number"
              step={1}
              min={1}
              value={values.openedShelfLifeHours}
              onChange={(event) => onChange({ openedShelfLifeHours: event.target.value })}
              error={fieldErrors.openedShelfLifeHours}
            />
          ),
        },
        {
          id: fifoId,
          label: t.attrs.fields.fifoPolicy,
          required: true,
          error: fieldErrors.fifoPolicyCode,
          control: (
            <Select
              size="sm"
              id={fifoId}
              options={fifoPolicyOptions(values.fifoPolicyCode)}
              value={values.fifoPolicyCode === '' ? null : values.fifoPolicyCode}
              onChange={(value) => onChange({ fifoPolicyCode: value })}
              invalid={fieldErrors.fifoPolicyCode !== undefined}
              aria-required
            />
          ),
        },
      ],
    },
    {
      label: t.attrs.groups.inventory,
      rows: [
        {
          id: inspectionId,
          label: t.attrs.fields.inspectionRequired,
          control: (
            <Switch
              id={inspectionId}
              checked={values.inspectionRequired}
              onChange={(event) => onChange({ inspectionRequired: event.target.checked })}
            />
          ),
        },
        {
          id: negativeStockId,
          label: t.attrs.fields.negativeStockAllowed,
          control: (
            <Switch
              id={negativeStockId}
              checked={values.negativeStockAllowed}
              onChange={(event) => onChange({ negativeStockAllowed: event.target.checked })}
            />
          ),
        },
        {
          id: developmentId,
          label: t.attrs.fields.developmentItem,
          control: (
            <Switch
              id={developmentId}
              checked={values.developmentItem}
              onChange={(event) => onChange({ developmentItem: event.target.checked })}
            />
          ),
        },
        {
          id: storageId,
          label: t.attrs.fields.storageCondition,
          control: (
            <TextField
              size="sm"
              id={storageId}
              value={values.storageConditionCode}
              onChange={(event) => onChange({ storageConditionCode: event.target.value })}
              error={fieldErrors.storageConditionCode}
            />
          ),
        },
      ],
    },
  ];

  return (
    <section className="item-attrs-pane" aria-label={t.panes.itemAttrs}>
      {banner}

      {/*
       * 설정 항목 전체를 한 표로(사용자 지시 2026-10-28 「전체 수정 항목을 목록으로 · 스크롤 없이 한 화면에」).
       * 구분 | 항목 | 설정값 — 한 줄에 한 항목, 구분은 묶음의 첫 줄에만 쓴다.
       */}
      <table className="item-attrs-table">
        <thead>
          <tr>
            <th scope="col">{t.attrs.columns.group}</th>
            <th scope="col">{t.attrs.columns.field}</th>
            <th scope="col">{t.attrs.columns.value}</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.label} aria-label={group.label}>
            {group.rows.map((row, index) => (
              <tr key={row.id}>
                {index === 0 && (
                  <th scope="rowgroup" rowSpan={group.rows.length} className="item-attrs-group">
                    {group.label}
                  </th>
                )}
                <th scope="row" className="item-attrs-field">
                  <FieldLabel htmlFor={row.id} label={row.label} required={row.required ?? false} />
                </th>
                <td>
                  <div className="item-attrs-inline">{row.control}</div>
                  {row.error !== undefined && <span className="field-error">{row.error}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      <div className="form-actions">
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

interface SettingRow {
  /** 고르는 칸의 id — 항목 이름(label)이 이 칸을 부른다. */
  id: string;
  label: string;
  required?: boolean;
  /** 선택칸의 오류(입력칸은 제 칸 아래에 낸다). */
  error?: string | undefined;
  control: ReactNode;
}

interface SettingGroup {
  label: string;
  rows: SettingRow[];
}
