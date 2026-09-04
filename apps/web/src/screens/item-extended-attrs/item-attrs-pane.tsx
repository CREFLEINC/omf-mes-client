import { Button, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { fifoPolicyOptions } from './code-catalog';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { ItemAttrsFormValues, SelectOption } from './types';
import { ValueField } from './value-field';

const t = messages.itemExtendedAttrs;

export interface ItemAttrsPaneProps {
  values: ItemAttrsFormValues;
  /** 조회한 사용 여부. 저장할 때 이 값을 그대로 되돌려 싣는다. */
  isActive: boolean;
  uomOptions: SelectOption[];
  onChange: (patch: Partial<ItemAttrsFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/** W-06-05 품목 탭의 MES 확장 편집 구획. ERP 원본 열은 이 폼에 두지 않는다. */
export const ItemAttrsPane = ({
  values,
  isActive,
  uomOptions,
  onChange,
  fieldErrors,
  banner,
  isDirty,
  isSaving,
  onSave,
  onCancel,
}: ItemAttrsPaneProps) => {
  const nameKoId = useId();
  const nameViId = useId();
  const serialId = useId();
  const productionLotSizeId = useId();
  const shelfLifeDaysId = useId();
  const storageId = useId();
  const openedId = useId();
  const lotStorageUomOptions: SelectOption[] = [
    { value: '', label: t.attrs.values.unspecified },
    ...uomOptions,
  ];

  return (
    <section className="pane item-attrs-pane" aria-labelledby="item-attrs-title">
      <h2 id="item-attrs-title" className="pane-title">
        {t.panes.itemAttrs}
      </h2>
      {banner}

      <div className="item-attrs-form">
        <fieldset className="item-attrs-section">
          <legend>{t.attrs.groups.names}</legend>
          <div className="form-grid">
            <div className="field-cell">
              <FieldLabel htmlFor={nameKoId} label={t.attrs.fields.nameKo} />
              <TextField
                id={nameKoId}
                value={values.nameKo}
                onChange={(event) => onChange({ nameKo: event.target.value })}
                error={fieldErrors.nameKo}
              />
            </div>

            <div className="field-cell">
              <FieldLabel htmlFor={nameViId} label={t.attrs.fields.nameVi} />
              <TextField
                id={nameViId}
                value={values.nameVi}
                onChange={(event) => onChange({ nameVi: event.target.value })}
                error={fieldErrors.nameVi}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="item-attrs-section">
          <legend>{t.attrs.groups.lot}</legend>
          <div className="form-grid">
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

            <SelectField
              label={t.attrs.fields.defaultLotStorageUom}
              options={lotStorageUomOptions}
              value={values.defaultLotStorageUomId}
              onChange={(value) => onChange({ defaultLotStorageUomId: value })}
              error={fieldErrors.defaultLotStorageUomId}
            />

            <div className="field-cell">
              <FieldLabel
                htmlFor={productionLotSizeId}
                label={t.attrs.fields.defaultProductionLotSize}
              />
              <TextField
                id={productionLotSizeId}
                type="number"
                step="any"
                value={values.defaultProductionLotSize}
                onChange={(event) => onChange({ defaultProductionLotSize: event.target.value })}
                error={fieldErrors.defaultProductionLotSize}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="item-attrs-section">
          <legend>{t.attrs.groups.shelfLife}</legend>
          <div className="form-grid">
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

            <SelectField
              label={t.attrs.fields.fifoPolicy}
              required
              options={fifoPolicyOptions(values.fifoPolicyCode)}
              value={values.fifoPolicyCode}
              onChange={(value) => onChange({ fifoPolicyCode: value })}
              error={fieldErrors.fifoPolicyCode}
            />

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
          </div>
        </fieldset>

        <fieldset className="item-attrs-section">
          <legend>{t.attrs.groups.inventory}</legend>
          <div className="form-grid">
            <div className="field-cell">
              <Switch
                label={t.attrs.fields.inspectionRequired}
                checked={values.inspectionRequired}
                onChange={(event) => onChange({ inspectionRequired: event.target.checked })}
              />
            </div>

            <div className="field-cell">
              <Switch
                label={t.attrs.fields.negativeStockAllowed}
                checked={values.negativeStockAllowed}
                onChange={(event) => onChange({ negativeStockAllowed: event.target.checked })}
              />
            </div>

            <div className="field-cell">
              <FieldLabel htmlFor={storageId} label={t.attrs.fields.storageCondition} />
              <TextField
                id={storageId}
                value={values.storageConditionCode}
                onChange={(event) => onChange({ storageConditionCode: event.target.value })}
                error={fieldErrors.storageConditionCode}
              />
            </div>

            <div className="field-cell">
              <Switch
                label={t.attrs.fields.developmentItem}
                checked={values.developmentItem}
                onChange={(event) => onChange({ developmentItem: event.target.checked })}
              />
            </div>

            <div className="field-cell">
              <ValueField
                label={t.attrs.fields.isActive}
                value={isActive ? t.attrs.values.active : t.attrs.values.inactive}
              />
              <span className="field-note">{t.attrs.isActiveNote}</span>
            </div>
          </div>
        </fieldset>
      </div>

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
