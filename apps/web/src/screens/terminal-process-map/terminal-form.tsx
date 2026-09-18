import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { FieldLabel } from './field-label';
import { LoadErrorBanner } from './load-error-banner';
import {
  codeSelectOptions,
  lookupNote,
  type LookupResult,
  type TerminalCodeNames,
} from './lookups';
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
  /** 단말 유형·운영 상태 선택지 — 공통코드(TERMINAL_TYPE·TERMINAL_STATUS). 저장값은 코드 그대로다. */
  codeNames: TerminalCodeNames;
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
 * 신규 등록은 운영 상태를 묻지 않는다. 수정할 때만 서버가 보유한 운영 상태를 편집한다.
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
  codeNames,
  onChange,
  onSubmit,
  onCancel,
}: TerminalFormProps) => {
  const baseId = useId();
  const codeId = `${baseId}-code`;

  return (
    <>
      {/* 다루지 않는 칸이 있다는 사실을 감추지 않는다 — 카드 제목 바로 아래 정보 띠(내용 폭). */}
      <AlertBanner className="terminal-map-notice terminal-map-form-notice" variant="info">
        {t.terminal.locationOmitted}
      </AlertBanner>
      <SaveErrorBanner error={saveError} />
      {plants.isError ? <LoadErrorBanner error={plants.error} onRetry={plants.refetch} /> : null}
      {equipments.isError ? (
        <LoadErrorBanner error={equipments.error} onRetry={equipments.refetch} />
      ) : null}

      <div className="form-grid terminal-map-form">
        <div className="field-cell">
          <FieldLabel htmlFor={codeId} label={t.terminal.code} hint={t.terminal.codeLocked} />
          <TextField
            id={codeId}
            value={draft.terminalCode}
            disabled={!isNew}
            error={errors.terminalCode ?? fieldErrors.terminalCode}
            onChange={(event) => {
              onChange({ terminalCode: event.target.value });
            }}
          />
        </div>

        <SelectField
          label={t.terminal.plant}
          options={toOptions(plants.entries)}
          value={draft.plant}
          note={lookupNote(plants, t.terminal.plantLookupFailed)}
          error={errors.plant ?? fieldErrors.plantId}
          placeholder={t.terminal.plantPlaceholder}
          wide
          onChange={(value) => {
            onChange({ plant: value });
          }}
        />

        {/* 코드를 외워 적지 않게 공통코드 이름으로 고른다 — 저장값은 코드 그대로다. */}
        <SelectField
          label={t.terminal.type}
          options={codeSelectOptions(codeNames.typeLookup, draft.terminalTypeCode)}
          value={draft.terminalTypeCode}
          error={errors.terminalTypeCode ?? fieldErrors.terminalTypeCode}
          placeholder={t.terminal.typePlaceholder}
          onChange={(value) => {
            onChange({ terminalTypeCode: value });
          }}
        />

        {!isNew ? (
          <SelectField
            label={t.terminal.status}
            options={codeSelectOptions(codeNames.statusLookup, draft.statusCode)}
            value={draft.statusCode}
            error={errors.statusCode ?? fieldErrors.statusCode}
            placeholder={t.terminal.selectPlaceholder}
            onChange={(value) => {
              onChange({ statusCode: value });
            }}
          />
        ) : null}

        <SelectField
          label={t.terminal.equipment}
          options={[
            { value: '', label: t.terminal.equipmentNone },
            ...toOptions(equipments.entries),
          ]}
          value={draft.equipment}
          note={lookupNote(equipments, t.terminal.equipmentLookupFailed)}
          hint={t.terminal.equipmentHint}
          error={fieldErrors.equipmentId}
          placeholder={t.terminal.equipmentNone}
          wide
          onChange={(value) => {
            onChange({ equipment: value });
          }}
        />
      </div>

      <div className="form-actions terminal-map-form-actions">
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
