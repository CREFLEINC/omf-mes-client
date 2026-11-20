import { Button, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner } from '../../patterns/master';
import {
  PickerDialog,
  REFERENCE_PAGE_SIZE,
  ReferenceField,
  type ReferenceSource,
} from '../../patterns/reference-picker';
import { runRequest } from '../../patterns/request';
import { FieldLabel, LabelAddons } from './field-label';
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
  codeNames,
  onChange,
  onSubmit,
  onCancel,
}: TerminalFormProps) => {
  const baseId = useId();
  const codeId = `${baseId}-code`;
  const hasPlant = draft.plant !== '';
  const isPop = draft.terminalTypeCode === POP_TYPE;
  const { client } = useApiClient();
  /* POP 을 고르면 설비 찾기 창, 공장을 고르면 창고 찾기 창이 바로 뜬다(사용자 지시 2026-11-20 · #333). 닫아도 칸에서 다시 연다. */
  const [autoPicker, setAutoPicker] = useState<'equipment' | 'warehouse' | null>(null);
  /* 설치 설비 · 창고는 찾기 창으로 고른다(사용자 지시 2026-11-20 · #333). 사용 중인 것만 낸다. */
  const equipmentSource: ReferenceSource = {
    title: t.terminal.equipmentPickerTitle,
    key: ['terminal-process-map', 'equipment-picker'],
    columns: { code: t.terminal.equipmentCodeColumn, name: t.terminal.equipmentNameColumn },
    search: async (q, page) => {
      const data = await runRequest(() =>
        client.GET('/mdm/equipments', {
          params: { query: { ...(q === '' ? {} : { q }), page, size: REFERENCE_PAGE_SIZE } },
        }),
      );
      return {
        items: data.items
          .filter((item) => item.isActive)
          .map((item) => ({
            id: item.equipmentId,
            code: item.equipmentCode,
            name: item.equipmentName,
          })),
        total: data.page.total,
      };
    },
  };
  const warehouseSource: ReferenceSource | null = hasPlant
    ? {
        title: t.terminal.warehousePickerTitle,
        key: ['terminal-process-map', 'warehouse-picker', draft.plant],
        columns: { code: t.terminal.warehouseCodeColumn, name: t.terminal.warehouseNameColumn },
        search: async (q, page) => {
          const plantId = Number(draft.plant);
          const data = await runRequest(() =>
            client.GET('/mdm/warehouses', {
              params: {
                query: { plantId, ...(q === '' ? {} : { q }), page, size: REFERENCE_PAGE_SIZE },
              },
            }),
          );
          return {
            /* 공장 질의를 모르는 서버도 있어 다시 거른다 — 다른 공장 창고는 서버가 400 으로 막는다. */
            items: data.items
              .filter((item) => item.isActive && item.plantId === plantId)
              .map((item) => ({
                id: item.warehouseId,
                code: item.warehouseCode,
                name: item.warehouseName,
              })),
            total: data.page.total,
          };
        },
      }
    : null;

  return (
    <>
      <SaveErrorBanner error={saveError} />
      {plants.isError ? <LoadErrorBanner error={plants.error} onRetry={plants.refetch} /> : null}

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
            if (value === POP_TYPE && draft.terminalTypeCode !== POP_TYPE)
              setAutoPicker('equipment');
            onChange(
              value === POP_TYPE || value === draft.terminalTypeCode
                ? { terminalTypeCode: value }
                : { terminalTypeCode: value, equipment: '', equipmentLabel: '' },
            );
          }}
        />

        {/* 설치 설비는 POP 단말일 때만 고른다(선택 · 사용자 지시 2026-11-20 · #333). */}
        {isPop ? (
          <ReferenceField
            label={t.terminal.equipment}
            labelAddon={
              <LabelAddons note={t.terminal.equipmentHint} optionalMark={t.terminal.optionalMark} />
            }
            valueLabel={draft.equipment === '' ? '' : draft.equipmentLabel || draft.equipment}
            placeholder={t.terminal.equipmentNone}
            source={equipmentSource}
            invalid={fieldErrors.equipmentId !== undefined}
            onPick={(row) => {
              onChange({ equipment: String(row.id), equipmentLabel: `${row.code} · ${row.name}` });
            }}
            onClear={() => {
              onChange({ equipment: '', equipmentLabel: '' });
            }}
          >
            {fieldErrors.equipmentId !== undefined && (
              <span className="field-error">{fieldErrors.equipmentId}</span>
            )}
          </ReferenceField>
        ) : (
          /* POP 이 아니면 설비 자리를 비워 둔다 — 공장 · 창고 줄이 그대로 아래에 선다(사용자 지시 2026-11-20 · #333). */
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
            if (value !== draft.plant) setAutoPicker('warehouse');
            onChange(
              value === draft.plant
                ? { plant: value }
                : { plant: value, warehouse: '', warehouseLabel: '' },
            );
          }}
        />

        {/* 창고는 고를 수 있을 때만(공장을 고른 뒤) 보인다(사용자 지시 2026-11-20 · #333). */}
        {hasPlant && (
          <ReferenceField
            label={t.terminal.warehouse}
            labelAddon={
              <LabelAddons
                note={t.terminal.warehouseScope}
                optionalMark={t.terminal.optionalMark}
              />
            }
            valueLabel={draft.warehouse === '' ? '' : draft.warehouseLabel || draft.warehouse}
            placeholder={t.terminal.warehouseAll}
            source={warehouseSource}
            invalid={fieldErrors.warehouseId !== undefined}
            onPick={(row) => {
              onChange({ warehouse: String(row.id), warehouseLabel: `${row.code} ${row.name}` });
            }}
            onClear={() => {
              onChange({ warehouse: '', warehouseLabel: '' });
            }}
          >
            {fieldErrors.warehouseId !== undefined && (
              <span className="field-error">{fieldErrors.warehouseId}</span>
            )}
          </ReferenceField>
        )}
      </div>

      {autoPicker === 'equipment' && (
        <PickerDialog
          source={equipmentSource}
          onClose={() => {
            setAutoPicker(null);
          }}
          onPick={(row) => {
            onChange({ equipment: String(row.id), equipmentLabel: `${row.code} · ${row.name}` });
            setAutoPicker(null);
          }}
        />
      )}
      {autoPicker === 'warehouse' && warehouseSource !== null && (
        <PickerDialog
          source={warehouseSource}
          onClose={() => {
            setAutoPicker(null);
          }}
          onPick={(row) => {
            onChange({ warehouse: String(row.id), warehouseLabel: `${row.code} ${row.name}` });
            setAutoPicker(null);
          }}
        />
      )}

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
