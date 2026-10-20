import { Button, Checkbox, Dialog, TextField } from '@crefle/web-ui';
import type { ItemResourceMap } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import { ResourcePickerInput } from '../../patterns/resource-picker';
import { FieldLabel } from './field-label';
import {
  isSameItemResourceMapValues,
  type ItemResourceMapFormValues,
} from './item-resource-map-draft';
import { validateItemResourceMap } from './item-resource-map-validation';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.itemExtendedAttrs.itemResourceMap;

const codeName = (code: string | null, name: string | null): string =>
  code === null ? '' : `${code} · ${name ?? ''}`;

export interface ItemResourceMapFormDialogProps {
  /** 고치는 줄. 없으면 새로 등록한다. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다 */
  row: ItemResourceMap | null;
  initialValues: ItemResourceMapFormValues;
  /** 표 위에서 고른 공장. 창에서는 바꾸지 않아 제목에만 둔다 */
  plantId: number;
  plantLabel: string;
  /** 같은 품목·공장의 줄 전부 — 중복 판정에 쓴다 */
  rows: readonly ItemResourceMap[];
  processOptions: (selected: string) => SelectOption[];
  /** 서버가 돌려준 칸 오류. 로컬 검증 결과가 덮는다 */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다 */
  banner: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  /** 바로 서버로 나간다 — 다른 부속 하위 탭의 「확인」과 다르다 */
  onSave: (values: ItemResourceMapFormValues) => void;
}

/**
 * 설비·금형 매핑 한 줄을 등록·수정하는 창. **저장은 이 창에서 바로 나간다.**
 *
 * 공장은 고칠 수 없다 — 계약의 수정 본문에 공장이 없고, 설비·금형이 공장에 매여 있다. 그래서 제목에만 둔다.
 */
export const ItemResourceMapFormDialog = ({
  row,
  initialValues,
  plantId,
  plantLabel,
  rows,
  processOptions,
  fieldErrors,
  banner,
  isSaving,
  onClose,
  onSave,
}: ItemResourceMapFormDialogProps) => {
  const [values, setValues] = useState<ItemResourceMapFormValues>(initialValues);
  /** 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const equipmentId = useId();
  const moldId = useId();
  const priorityId = useId();
  const remarksId = useId();
  /** 칸에 보이는 「코드 · 이름」. 창에서 고르면 바뀐다 */
  const [labels, setLabels] = useState({
    equipment: codeName(row?.equipmentCode ?? null, row?.equipmentName ?? null),
    mold: codeName(row?.moldCode ?? null, row?.moldName ?? null),
  });

  /* 서버가 자동 배정 자리를 사용 중인 줄로만 센다 — 사용 중지한 줄에는 그 칸을 두지 않는다. */
  const canSetDefault = row === null || row.isActive;

  const editingId = row?.itemResourceMapId ?? null;
  const isDirty = row === null || !isSameItemResourceMapValues(values, initialValues);
  const shownErrors = { ...fieldErrors, ...errors };

  const change = (patch: Partial<ItemResourceMapFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));

    setErrors((prev) => {
      const next = { ...prev };
      for (const field of Object.keys(patch)) delete next[field];

      /* 공정·설비·금형은 함께 「하나는 있어야」와 중복을 만든다 — 하나를 고치면 함께 다시 본다. */
      if ('processId' in patch || 'equipmentId' in patch || 'moldId' in patch) {
        delete next.equipmentId;
        delete next.moldId;
      }

      return next;
    });
  };

  const handleSave = () => {
    const found = validateItemResourceMap(values, rows, editingId);
    setErrors(found);

    if (Object.keys(found).length > 0) return;

    onSave(values);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={row === null ? t.dialog.addTitle(plantLabel) : t.dialog.editTitle(plantLabel)}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={handleSave}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}

      <div className="form-grid">
        <div className="field-cell">
          <FieldLabel htmlFor={equipmentId} label={t.fields.equipment} />
          <ResourcePickerInput
            id={equipmentId}
            kind="equipment"
            plantId={plantId}
            valueLabel={values.equipmentId === '' ? '' : labels.equipment}
            invalid={shownErrors.equipmentId !== undefined}
            aria-describedby={
              shownErrors.equipmentId === undefined ? undefined : `${equipmentId}-error`
            }
            onPick={(picked) => {
              setLabels((prev) => ({ ...prev, equipment: `${picked.code} · ${picked.name}` }));
              change({ equipmentId: String(picked.id) });
            }}
            onClear={() => change({ equipmentId: '' })}
          />
          {shownErrors.equipmentId !== undefined && (
            <span id={`${equipmentId}-error`} className="field-error">
              {shownErrors.equipmentId}
            </span>
          )}
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={moldId} label={t.fields.mold} />
          <ResourcePickerInput
            id={moldId}
            kind="mold"
            plantId={plantId}
            valueLabel={values.moldId === '' ? '' : labels.mold}
            invalid={shownErrors.moldId !== undefined}
            aria-describedby={shownErrors.moldId === undefined ? undefined : `${moldId}-error`}
            onPick={(picked) => {
              setLabels((prev) => ({ ...prev, mold: `${picked.code} · ${picked.name}` }));
              change({ moldId: String(picked.id) });
            }}
            onClear={() => change({ moldId: '' })}
          />
          {shownErrors.moldId !== undefined && (
            <span id={`${moldId}-error`} className="field-error">
              {shownErrors.moldId}
            </span>
          )}
        </div>

        {/* 빈 값이 「전체 공정」이라는 정상 값이다 — 자리표시로 대신하지 않는다. */}
        <SelectField
          label={t.fields.process}
          options={[
            { value: '', label: t.values.allProcesses },
            ...processOptions(values.processId),
          ]}
          value={values.processId}
          onChange={(processId) => change({ processId })}
          error={shownErrors.processId}
          wide
        />

        <div className="field-cell">
          <FieldLabel htmlFor={priorityId} label={t.fields.priorityNo} required />
          <TextField
            id={priorityId}
            type="number"
            min={0}
            step={1}
            value={values.priorityNo}
            onChange={(event) => change({ priorityNo: event.target.value })}
            error={shownErrors.priorityNo}
            aria-required
          />
        </div>

        {canSetDefault && (
          <div className="field-cell field-cell-unlabeled">
            <Checkbox
              checked={values.isDefault}
              onChange={(event) => change({ isDefault: event.target.checked })}
            >
              {t.fields.isDefault}
            </Checkbox>
          </div>
        )}

        <div className="field-cell">
          <FieldLabel htmlFor={remarksId} label={t.fields.remarks} />
          <TextField
            id={remarksId}
            value={values.remarks}
            onChange={(event) => change({ remarks: event.target.value })}
            error={shownErrors.remarks}
          />
        </div>
      </div>
    </Dialog>
  );
};
