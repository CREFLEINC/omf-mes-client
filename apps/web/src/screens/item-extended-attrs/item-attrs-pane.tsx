import { Button, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { Select } from '../../patterns/select';
import { fifoPolicyOptions } from './code-catalog';
import { FieldLabel } from './field-label';
import type { ItemAttrsFormValues, SelectOption } from './types';

const t = messages.itemExtendedAttrs;

export interface ItemAttrsPaneProps {
  values: ItemAttrsFormValues;
  /** 고른 품목의 유형 코드 — LOT 기본크기의 이름과 표시 여부가 이것으로 갈린다(`lotSizeLabelOf`). */
  itemTypeCode: string;
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
  itemTypeCode,
  uomOptions,
  onChange,
  fieldErrors,
  banner,
  isDirty,
  isSaving,
  onSave,
  onCancel,
}: ItemAttrsPaneProps) => {
  const lotStorageUomId = useId();
  const productionLotSizeId = useId();
  const shelfLifeManagedId = useId();
  const fifoId = useId();
  const inspectionId = useId();
  const negativeStockId = useId();
  const lotSizeLabel = lotSizeLabelOf(itemTypeCode);
  const lotStorageUomOptions: SelectOption[] = [
    { value: '', label: t.attrs.values.unspecified },
    ...uomOptions,
  ];

  const groups: SettingGroup[] = [
    {
      label: t.attrs.groups.lot,
      rows: [
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
        ...(lotSizeLabel === null
          ? []
          : [
              {
                id: productionLotSizeId,
                label: lotSizeLabel,
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
            ]),
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
            <div className="item-attrs-control-with-note">
              <Switch
                id={inspectionId}
                checked={values.inspectionRequired}
                onChange={(event) => onChange({ inspectionRequired: event.target.checked })}
              />
              {/* 검사 기준의 IQC 「기본 생략」과 함께 바뀐다(omf-all-around#215). */}
              <p className="field-note">{t.attrs.inspectionRequiredSyncNote}</p>
            </div>
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

/**
 * LOT 기본크기의 이름 — 품목유형마다 뜻이 다르다(사용자 지시 2026-10-28). 반제품 · 제품은 생산 LOT, 원자재 · 부자재는
 * 자재 LOT 의 기본크기다. 상품과 그 밖의 유형은 쓰지 않아 칸을 두지 않는다(`null`) — 값은 조회한 그대로 되돌려 실린다.
 * 칸은 하나(`defaultProductionLotSize`)를 함께 쓴다 — 서버에 포괄적인 이름(`defaultLotSize`)으로 바꾸기를 요청함.
 */
export const lotSizeLabelOf = (itemTypeCode: string): string | null => {
  if (itemTypeCode === 'SEMI_FINISHED' || itemTypeCode === 'FINISHED') {
    return t.attrs.fields.defaultProductionLotSize;
  }
  if (itemTypeCode === 'RAW_MATERIAL' || itemTypeCode === 'SUBSIDIARY_MATERIAL') {
    return t.attrs.fields.defaultMaterialLotSize;
  }
  return null;
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
