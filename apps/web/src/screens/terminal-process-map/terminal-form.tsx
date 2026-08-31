import { Button, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { FieldLabel } from './field-label';
import { lookupNote, type LookupResult } from './lookups';
import { SelectField } from './select-field';
import type { TerminalDraft, TerminalErrors } from './terminal-draft';
import type { SelectOption } from './types';

const t = messages.terminalProcessMap;

export interface TerminalFormProps {
  draft: TerminalDraft;
  errors: TerminalErrors;
  /** 등록인가 수정인가. **코드 칸의 운명이 여기서 갈린다.** */
  isNew: boolean;
  isSaving: boolean;
  saveError: ApiError | null;
  fieldErrors: Record<string, string>;
  plants: LookupResult;
  equipments: LookupResult;
  onChange: (patch: Partial<TerminalDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
  entries.map((entry) => ({ value: entry.value, label: entry.label }));

/**
 * 단말 등록·수정 폼.
 *
 * ⛔ **수정에서 단말 코드 칸을 잠근다** — 키라서 계약이 아예 받지 않는다. 감추지 않고
 * 잠근 채 사유를 적는다: 감추면 「왜 못 고치는가」를 물을 자리가 사라진다.
 *
 * ⚠ **유형·상태는 값 목록이 확정되기 전이라 코드를 직접 받는다.** 고르는 칸으로 만들면 채울
 * 값이 없어 단말을 등록할 수 없다.
 */
export const TerminalForm = ({
  draft,
  errors,
  isNew,
  isSaving,
  saveError,
  fieldErrors,
  plants,
  equipments,
  onChange,
  onSubmit,
  onCancel,
}: TerminalFormProps) => {
  const baseId = useId();
  const codeId = `${baseId}-code`;
  const typeId = `${baseId}-type`;
  const statusId = `${baseId}-status`;

  return (
    <>
      <SaveErrorBanner error={saveError} />

      <div className="form-grid">
        <div className="field-cell">
          <FieldLabel htmlFor={codeId} label={t.terminal.code} />
          <TextField
            id={codeId}
            value={draft.terminalCode}
            disabled={!isNew}
            error={errors.terminalCode ?? fieldErrors.terminalCode}
            onChange={(event) => {
              onChange({ terminalCode: event.target.value });
            }}
          />
          {/* 잠근 이유를 잠근 칸 옆에 둔다 — 등록할 때는 아직 잠기지 않았으니 내지 않는다. */}
          {!isNew && <span className="field-note">{t.terminal.codeLocked}</span>}
        </div>

        <SelectField
          label={t.terminal.plant}
          options={toOptions(plants.entries)}
          value={draft.plant}
          note={lookupNote(plants, t.terminal.plantLookupFailed)}
          error={errors.plant ?? fieldErrors.plantId}
          placeholder={t.terminal.selectPlaceholder}
          wide
          onChange={(value) => {
            onChange({ plant: value });
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={typeId} label={t.terminal.type} />
          <TextField
            id={typeId}
            value={draft.terminalTypeCode}
            error={errors.terminalTypeCode ?? fieldErrors.terminalTypeCode}
            helperText={t.terminal.codeListPending}
            onChange={(event) => {
              onChange({ terminalTypeCode: event.target.value });
            }}
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={statusId} label={t.terminal.status} />
          <TextField
            id={statusId}
            value={draft.statusCode}
            error={errors.statusCode ?? fieldErrors.statusCode}
            helperText={t.terminal.codeListPending}
            onChange={(event) => {
              onChange({ statusCode: event.target.value });
            }}
          />
        </div>

        <SelectField
          label={t.terminal.equipment}
          options={[
            { value: '', label: t.terminal.equipmentNone },
            ...toOptions(equipments.entries),
          ]}
          value={draft.equipment}
          note={
            lookupNote(equipments, t.terminal.equipmentLookupFailed) ?? t.terminal.equipmentNote
          }
          error={fieldErrors.equipmentId}
          placeholder={t.terminal.equipmentNone}
          wide
          onChange={(value) => {
            onChange({ equipment: value });
          }}
        />
      </div>

      {/* 다루지 않는 칸이 있다는 사실을 감추지 않는다 — 선택 항목이라 없어도 단말이 선다. */}
      <p className="field-note">{t.terminal.locationOmitted}</p>

      <div className="form-actions">
        {isSaving && <p className="field-note form-actions-secondary">{t.terminal.saving}</p>}
        <Button variant="outlined" disabled={isSaving} onClick={onCancel}>
          {t.terminal.cancel}
        </Button>
        <Button disabled={isSaving} onClick={onSubmit}>
          {t.terminal.save}
        </Button>
      </div>
    </>
  );
};
