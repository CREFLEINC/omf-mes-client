import { Button, TextField } from '@crefle/web-ui';
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

/** 설치 설비를 고르는 단말 유형(공통코드 TERMINAL_TYPE) — 고정 스테이션만 설비에 붙는다. */
const POP_TYPE = 'POP';

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
  /** 단말 공장의 창고(피처 002). 주지 않으면 빈 목록이다. */
  warehouses?: LookupResult;
  /** 단말 유형·운영 상태 선택지 — 공통코드(TERMINAL_TYPE·TERMINAL_STATUS). 저장값은 코드 그대로다. */
  codeNames: TerminalCodeNames;
  onChange: (patch: Partial<TerminalDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const NO_WAREHOUSES: LookupResult = {
  entries: [],
  truncated: false,
  isError: false,
  error: null,
  isLoading: false,
  refetch: () => undefined,
};

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
  warehouses = NO_WAREHOUSES,
  codeNames,
  onChange,
  onSubmit,
  onCancel,
}: TerminalFormProps) => {
  const baseId = useId();
  const codeId = `${baseId}-code`;
  const hasPlant = draft.plant !== '';
  const isPop = draft.terminalTypeCode === POP_TYPE;

  return (
    <>
      <SaveErrorBanner error={saveError} />
      {plants.isError ? <LoadErrorBanner error={plants.error} onRetry={plants.refetch} /> : null}
      {equipments.isError ? (
        <LoadErrorBanner error={equipments.error} onRetry={equipments.refetch} />
      ) : null}

      {/*
       * 두 열(사용자 지시 2026-11-20 · #333) — 단말 코드 · (운영 상태) / 단말 유형 · 설치 설비 / 공장 · 창고.
       * 설치 설비는 POP 일 때만, 창고는 공장을 고른 뒤에만 나타난다. 안내는 칸 이름 오른쪽 안내 라벨.
       */}
      <div className="form-grid terminal-map-form">
        <div className="field-cell">
          <FieldLabel
            htmlFor={codeId}
            label={t.terminal.code}
            required={isNew}
            note={t.terminal.codeLocked}
          />
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

        {/* 운영 상태는 수정할 때만 — 등록이면 단말 코드 줄 오른쪽을 비운다. */}
        {!isNew ? (
          <SelectField
            label={t.terminal.status}
            required
            options={codeSelectOptions(codeNames.statusLookup, draft.statusCode)}
            value={draft.statusCode}
            error={errors.statusCode ?? fieldErrors.statusCode}
            placeholder={t.terminal.selectPlaceholder}
            onChange={(value) => {
              onChange({ statusCode: value });
            }}
          />
        ) : (
          <div className="terminal-map-form-spacer" aria-hidden="true" />
        )}

        {/* 코드를 외워 적지 않게 공통코드 이름으로 고른다 — 저장값은 코드 그대로다. */}
        <SelectField
          label={t.terminal.type}
          required
          options={codeSelectOptions(codeNames.typeLookup, draft.terminalTypeCode)}
          value={draft.terminalTypeCode}
          error={errors.terminalTypeCode ?? fieldErrors.terminalTypeCode}
          placeholder={t.terminal.typePlaceholder}
          onChange={(value) => {
            /* POP 이 아니게 바꾸면 설비 칸이 사라진다 — 보이지 않는 설비가 저장되지 않게 비운다. */
            onChange(
              value === POP_TYPE || value === draft.terminalTypeCode
                ? { terminalTypeCode: value }
                : { terminalTypeCode: value, equipment: '' },
            );
          }}
        />

        {/* 설치 설비는 POP 단말일 때만 고른다(선택 · 사용자 지시 2026-11-20 · #333). 아니면 공장이 왼쪽 열에 서도록 비운다. */}
        {isPop ? (
          <SelectField
            label={t.terminal.equipment}
            optionalMark={t.terminal.optionalMark}
            options={[
              { value: '', label: t.terminal.equipmentNone },
              ...toOptions(equipments.entries),
            ]}
            value={draft.equipment}
            note={lookupNote(equipments, t.terminal.equipmentLookupFailed)}
            labelNote={t.terminal.equipmentHint}
            error={fieldErrors.equipmentId}
            placeholder={t.terminal.equipmentNone}
            wide
            onChange={(value) => {
              onChange({ equipment: value });
            }}
          />
        ) : (
          <div className="terminal-map-form-spacer" aria-hidden="true" />
        )}

        <SelectField
          label={t.terminal.plant}
          required
          options={toOptions(plants.entries)}
          value={draft.plant}
          note={lookupNote(plants, t.terminal.plantLookupFailed)}
          error={errors.plant ?? fieldErrors.plantId}
          placeholder={t.terminal.plantPlaceholder}
          wide
          onChange={(value) => {
            /* 다른 공장의 창고가 남지 않게 비운다. */
            onChange(value === draft.plant ? { plant: value } : { plant: value, warehouse: '' });
          }}
        />

        {/* 창고는 고를 수 있을 때만(공장을 고른 뒤) 보인다(사용자 지시 2026-11-20 · #333). */}
        {hasPlant && (
          <SelectField
            label={t.terminal.warehouse}
            optionalMark={t.terminal.optionalMark}
            labelNote={t.terminal.warehouseScope}
            options={[
              { value: '', label: t.terminal.warehouseAll },
              ...toOptions(warehouses.entries),
            ]}
            value={draft.warehouse}
            note={lookupNote(warehouses, t.terminal.warehouseLookupFailed)}
            error={fieldErrors.warehouseId}
            placeholder={t.terminal.warehouseAll}
            wide
            onChange={(value) => {
              onChange({ warehouse: value });
            }}
          />
        )}
      </div>

      <div className="form-actions terminal-map-form-actions">
        {isSaving && <p className="field-note form-actions-secondary">{t.terminal.saving}</p>}
        <Button variant="outlined" disabled={isSaving} onClick={onCancel}>
          {t.terminal.cancel}
        </Button>
        <Button disabled={isSaving} onClick={onSubmit}>
          {isNew ? t.terminal.register : t.terminal.save}
        </Button>
      </div>
    </>
  );
};
