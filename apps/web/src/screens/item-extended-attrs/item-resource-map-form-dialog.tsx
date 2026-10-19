import { Button, Checkbox, Dialog, TextField } from '@crefle/web-ui';
import type { ItemResourceMap } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId, useState } from 'react';

import { FieldLabel } from './field-label';
import {
  isSameItemResourceMapValues,
  type ItemResourceMapFormValues,
} from './item-resource-map-draft';
import { validateItemResourceMap } from './item-resource-map-validation';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.itemExtendedAttrs.itemResourceMap;

export interface ItemResourceMapFormDialogProps {
  /** 고치는 줄. 없으면 새로 등록한다. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다 */
  row: ItemResourceMap | null;
  initialValues: ItemResourceMapFormValues;
  /** 표 위에서 고른 공장의 이름. 창에서는 바꾸지 않는다 */
  plantLabel: string;
  /** 같은 품목·공장의 줄 전부 — 중복 판정에 쓴다 */
  rows: readonly ItemResourceMap[];
  processOptions: (selected: string) => SelectOption[];
  equipmentOptions: (selected: string) => SelectOption[];
  moldOptions: (selected: string) => SelectOption[];
  /** 서버가 돌려준 칸 오류. 로컬 검증 결과가 덮는다 */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다 */
  banner: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  /** 바로 서버로 나간다 — 다른 부속 하위 탭의 「확인」과 다르다 */
  onSave: (values: ItemResourceMapFormValues) => void;
}

interface FilteredSelectFieldProps {
  label: string;
  searchLabel: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * 받은 목록을 검색어로 좁혀 고르는 선택칸. 금형은 공장마다 수백 건이라 한 목록에서 찾을 수 없다.
 *
 * **고른 값은 검색어와 상관없이 남긴다** — 빼면 선택칸이 비어 보여 값이 사라진 줄 안다.
 * 「(없음)」도 늘 남긴다. 설비·금형은 둘 중 하나만 있어도 된다.
 */
const FilteredSelectField = ({
  label,
  searchLabel,
  options,
  value,
  onChange,
  error,
}: FilteredSelectFieldProps) => {
  const searchId = useId();
  const [keyword, setKeyword] = useState('');
  const needle = keyword.trim().toLowerCase();

  const matched = options.filter(
    (option) => needle === '' || option.label.toLowerCase().includes(needle),
  );
  const visible = [
    { value: '', label: t.values.none },
    ...options.filter(
      (option) => option.value === value && !matched.some((item) => item.value === value),
    ),
    ...matched,
  ];

  return (
    <>
      <div className="field-cell">
        <FieldLabel htmlFor={searchId} label={searchLabel} />
        <TextField
          id={searchId}
          value={keyword}
          placeholder={t.search.placeholder}
          onChange={(event) => setKeyword(event.target.value)}
          /* 검색칸에서 엔터를 쳐도 창이 저장되지 않게 한다. */
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
        />
      </div>
      <SelectField
        label={label}
        options={visible}
        value={value}
        onChange={onChange}
        note={needle !== '' && matched.length === 0 ? t.search.noMatch : undefined}
        error={error}
        wide
      />
    </>
  );
};

/**
 * 설비·금형 매핑 한 줄을 등록·수정하는 창. **저장은 이 창에서 바로 나간다.**
 *
 * 공장은 고칠 수 없다 — 계약의 수정 본문에 공장이 없고, 설비·금형 선택지가 공장에 매여 있다.
 */
export const ItemResourceMapFormDialog = ({
  row,
  initialValues,
  plantLabel,
  rows,
  processOptions,
  equipmentOptions,
  moldOptions,
  fieldErrors,
  banner,
  isSaving,
  onClose,
  onSave,
}: ItemResourceMapFormDialogProps) => {
  const [values, setValues] = useState<ItemResourceMapFormValues>(initialValues);
  /** 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const plantId = useId();
  const priorityId = useId();
  const remarksId = useId();
  const defaultNoteId = useId();

  /* 서버가 기본 자리를 사용 중인 줄로만 세므로, 사용 중지한 줄을 기본으로 저장해도 기본이 되지 않는다. */
  const isDefaultLocked = row !== null && !row.isActive;

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
      size="md"
      title={row === null ? t.dialog.addTitle : t.dialog.editTitle}
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
          <FieldLabel htmlFor={plantId} label={t.fields.plant} />
          <TextField id={plantId} value={plantLabel} readOnly helperText={t.notes.plantFixed} />
        </div>

        {/* 빈 값이 「품목 공통」이라는 정상 값이다 — 자리표시로 대신하지 않는다. */}
        <SelectField
          label={t.fields.process}
          options={[
            { value: '', label: t.values.allProcesses },
            ...processOptions(values.processId),
          ]}
          value={values.processId}
          onChange={(processId) => change({ processId })}
          note={t.notes.process}
          error={shownErrors.processId}
          wide
        />

        <FilteredSelectField
          label={t.fields.equipment}
          searchLabel={t.search.equipment}
          options={equipmentOptions(values.equipmentId)}
          value={values.equipmentId}
          onChange={(equipmentId) => change({ equipmentId })}
          error={shownErrors.equipmentId}
        />

        <FilteredSelectField
          label={t.fields.mold}
          searchLabel={t.search.mold}
          options={moldOptions(values.moldId)}
          value={values.moldId}
          onChange={(moldId) => change({ moldId })}
          error={shownErrors.moldId}
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
            helperText={t.notes.priorityNo}
            error={shownErrors.priorityNo}
            aria-required
          />
        </div>

        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={values.isDefault}
            disabled={isDefaultLocked}
            aria-describedby={defaultNoteId}
            onChange={(event) => change({ isDefault: event.target.checked })}
          >
            {t.fields.isDefault}
          </Checkbox>
          <span id={defaultNoteId} className="field-note">
            {isDefaultLocked ? t.notes.defaultNeedsActive : t.notes.isDefault}
          </span>
        </div>

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
