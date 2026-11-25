import { Button, Icon, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { CodeLockLabel, SaveErrorBanner } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { LoadErrorBanner } from './load-error-banner';
import {
  codeSelectOptions,
  lookupNote,
  type LookupResult,
  type TerminalCodeNames,
} from './lookups';
import { PagedSelectField } from './paged-select-field';
import { useEquipmentPages } from './queries';
import { SelectField } from './select-field';
import type { TerminalDraft, TerminalErrors } from './terminal-draft';
import type { SelectOption } from './types';

const t = messages.terminalProcessMap;

/** 설치 설비를 고르는 단말 유형(공통코드 TERMINAL_TYPE) — 고정 스테이션만 설비에 붙는다. */
const POP_TYPE = 'POP';

/** 설비 · 창고 선택칸이 한 번에 받는 건수. */
const PICK_PAGE_SIZE = 50;

export interface TerminalFormProps {
  draft: TerminalDraft;
  errors: TerminalErrors;
  /** 등록인가 수정인가. **코드 칸의 운명이 여기서 갈린다.** */
  isNew: boolean;
  /** 단말 코드가 화면이 채운 값 그대로인가 — 라벨 옆에 「자동」을 붙인다. */
  codeIsAuto?: boolean;
  saveError: ApiError | null;
  fieldErrors: Record<string, string>;
  plants: LookupResult;
  /** 단말 유형·운영 상태 선택지 — 공통코드(TERMINAL_TYPE·TERMINAL_STATUS). 저장값은 코드 그대로다. */
  codeNames: TerminalCodeNames;
  onChange: (patch: Partial<TerminalDraft>) => void;
}

const toOptions = (entries: { value: string; label: string }[]): SelectOption[] =>
  entries.map((entry) => ({ value: entry.value, label: entry.label }));

/** 먼저 보이는 유형 — POP(작업장) · MOBILE(PDA). 나머지는 [더보기] 뒤. */
const PRIMARY_TYPES: readonly string[] = [POP_TYPE, 'MOBILE'];

/** 유형 카드 아이콘 — 공통코드에 새 유형이 생기면 연동 아이콘으로 둔다. */
const typeIcon = (code: string): string =>
  code === POP_TYPE ? 'desktop_windows' : code === 'MOBILE' ? 'smartphone' : 'hub';

/**
 * 단말 등록·수정 칸 — 단추는 팝업 바닥글이 가진다(등록은 단계 단추, 수정은 [취소][저장]).
 *
 * ⭐ **고르는 순서대로 위에서 아래로** — 단말 유형 → 공장 · 창고 → 설치 설비 · 단말 코드.
 * 단말 코드는 유형으로 채워지므로 맨 끝에 둔다(위에 두면 아래에서 유형을 고를 때 위 칸이 바뀐다).
 *
 * ⭐ **칸은 처음부터 자리를 지킨다.** 아직 고를 수 없는 칸은 사유를 칸 안에 적고 잠근다 —
 * 고를 때마다 칸이 생기면 팝업 크기가 바뀐다.
 *
 * ⛔ **수정에서 단말 코드 칸을 잠근다** — 키라서 계약이 아예 받지 않는다.
 */
export const TerminalForm = ({
  draft,
  errors,
  isNew,
  codeIsAuto = false,
  saveError,
  fieldErrors,
  plants,
  codeNames,
  onChange,
}: TerminalFormProps) => {
  const baseId = useId();
  const codeId = `${baseId}-code`;
  const typeName = `${baseId}-type-choice`;
  const [showAllTypes, setShowAllTypes] = useState(false);
  const hasPlant = draft.plant !== '';
  const hasType = draft.terminalTypeCode !== '';
  const isPop = draft.terminalTypeCode === POP_TYPE;
  const { client } = useApiClient();
  /* POP 을 고르면 커서가 설치 설비 칸으로, 공장을 고르면 창고 칸으로 간다(사용자 지시 2026-11-20 · #333). */
  const equipmentRef = useRef<HTMLButtonElement>(null);
  const warehouseRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<'equipment' | 'warehouse' | null>(null);
  useEffect(() => {
    const target =
      focusNext.current === 'equipment'
        ? equipmentRef
        : focusNext.current === 'warehouse'
          ? warehouseRef
          : null;
    if (target?.current == null) return;
    focusNext.current = null;
    target.current.focus();
  });
  /* 사용 중인 설비 · 창고만, 서버 검색(코드 · 이름) · 쪽 넘김. */
  const fetchEquipments = useEquipmentPages();
  const fetchWarehouses = async (q: string, page: number) => {
    const plantId = Number(draft.plant);
    const data = await runRequest(() =>
      client.GET('/mdm/warehouses', {
        params: { query: { plantId, ...(q === '' ? {} : { q }), page, size: PICK_PAGE_SIZE } },
      }),
    );
    return {
      /* 공장 질의를 모르는 서버도 있어 다시 거른다 — 다른 공장 창고는 서버가 400 으로 막는다. */
      options: data.items
        .filter((item) => item.isActive && item.plantId === plantId)
        .map((item) => ({
          value: String(item.warehouseId),
          label: `${item.warehouseCode} ${item.warehouseName}`,
        })),
      total: data.page.total,
    };
  };

  const typeError = errors.terminalTypeCode ?? fieldErrors.terminalTypeCode;
  const typeOptions = codeSelectOptions(codeNames.typeLookup, draft.terminalTypeCode);
  /*
   * 자주 쓰는 POP · PDA 만 먼저 — 나머지(추적 시스템 연동 등)는 처음 한 번쯤 쓰는 유형이라
   * [더보기] 뒤에 둔다(사용자 지시 2026-11-24). 고른 유형이 뒤에 있으면 펼친 채로 둔다.
   */
  const isPrimaryType = (code: string): boolean => PRIMARY_TYPES.includes(code);
  const allTypesShown =
    showAllTypes || (draft.terminalTypeCode !== '' && !isPrimaryType(draft.terminalTypeCode));
  const shownTypes = allTypesShown
    ? typeOptions
    : typeOptions.filter((option) => isPrimaryType(option.value));
  const hiddenTypeCount = typeOptions.length - shownTypes.length;

  const typeCards = (
    <fieldset className="field-cell terminal-map-form-full terminal-map-type-field">
      <legend className="field-label">
        {t.terminal.type}
        <span className="required-mark" aria-hidden="true">
          {' '}
          *
        </span>
      </legend>
      <div className="terminal-map-type-options">
        {shownTypes.map((option) => {
          const hint = t.terminal.typeHints[option.value];
          return (
            <label
              key={option.value}
              className="terminal-map-type-option"
              data-checked={option.value === draft.terminalTypeCode ? 'true' : undefined}
            >
              <input
                type="radio"
                name={typeName}
                value={option.value}
                checked={option.value === draft.terminalTypeCode}
                onChange={() => {
                  const value = option.value;
                  if (value === POP_TYPE && draft.terminalTypeCode !== POP_TYPE)
                    focusNext.current = 'equipment';
                  /* POP 이 아니게 바꾸면 설비 칸이 잠긴다 — 보이지 않는 설비가 저장되지 않게 비운다. */
                  onChange(
                    value === POP_TYPE
                      ? { terminalTypeCode: value }
                      : { terminalTypeCode: value, equipment: '', equipmentLabel: '' },
                  );
                }}
              />
              <Icon name={typeIcon(option.value)} size={24} aria-hidden />
              <span className="terminal-map-type-text">
                <span className="terminal-map-type-name">{option.label}</span>
                {hint !== undefined && <span className="terminal-map-type-hint">{hint}</span>}
              </span>
            </label>
          );
        })}
        {/* 카드가 아니라 작은 글자 단추 — 고르는 카드와 크기로 가른다(사용자 지시 2026-11-24). */}
        {hiddenTypeCount > 0 && (
          <Button
            variant="text"
            size="sm"
            className="terminal-map-type-more"
            trailingIcon={<Icon name="expand_more" size={18} aria-hidden />}
            onClick={() => {
              setShowAllTypes(true);
            }}
          >
            {t.terminal.moreTypes}
          </Button>
        )}
      </div>
      {typeError !== undefined && <span className="field-error">{typeError}</span>}
    </fieldset>
  );

  /** 수정에서 바꿀 수 없는 칸 — 입력칸이 아니라 글자로만. 글자라 따로 「변경 불가」를 붙이지 않는다(사용자 지시 2026-11-24). */
  const readOnlyField = (id: string, label: string, value: string) => (
    <div className="field-cell">
      <span className="field-label">
        <label htmlFor={id}>{label}</label>
      </span>
      <output id={id} className="terminal-map-form-static">
        {value}
      </output>
    </div>
  );

  const plantField = (
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
        if (value !== draft.plant) focusNext.current = 'warehouse';
        onChange(
          value === draft.plant
            ? { plant: value }
            : { plant: value, warehouse: '', warehouseLabel: '' },
        );
      }}
    />
  );

  const warehouseField = (
    <PagedSelectField
      ref={warehouseRef}
      label={t.terminal.warehouse}
      optionalMark={t.terminal.optionalMark}
      /* 창고를 고르지 않으면 유형과 관계없이 「미지정」(사용자 지시 2026-11-24). */
      emptyLabel={t.terminal.equipmentNone}
      disabledLabel={hasPlant ? undefined : t.terminal.warehouseNeedsPlant}
      value={draft.warehouse}
      valueLabel={draft.warehouseLabel}
      queryKey={['terminal-process-map', 'warehouse-select', draft.plant]}
      fetchPage={fetchWarehouses}
      error={fieldErrors.warehouseId}
      onChange={(warehouse, warehouseLabel) => {
        onChange({ warehouse, warehouseLabel });
      }}
    />
  );

  /* 설치 설비는 POP 단말일 때만 고른다(선택 · 사용자 지시 2026-11-20 · #333). */
  const equipmentField = (
    <PagedSelectField
      ref={equipmentRef}
      label={t.terminal.equipment}
      optionalMark={t.terminal.optionalMark}
      emptyLabel={t.terminal.equipmentNone}
      disabledLabel={isPop ? undefined : t.terminal.equipmentPopOnly}
      value={draft.equipment}
      valueLabel={draft.equipmentLabel}
      queryKey={['terminal-process-map', 'equipment-select']}
      fetchPage={fetchEquipments}
      error={fieldErrors.equipmentId}
      onChange={(equipment, equipmentLabel) => {
        onChange({ equipment, equipmentLabel });
      }}
    />
  );

  return (
    <>
      <SaveErrorBanner error={saveError} />
      {plants.isError ? <LoadErrorBanner error={plants.error} onRetry={plants.refetch} /> : null}

      {isNew ? (
        /* 등록 — 고르는 순서대로: 유형 → 공장 · 창고 → 설비 · 단말 코드(유형으로 채워진다). */
        <div className="form-grid terminal-map-form">
          {typeCards}
          {plantField}
          {warehouseField}
          {equipmentField}
          <div className="field-cell">
            <span className="field-label">
              <label htmlFor={codeId}>{t.terminal.code}</label>
              <span className="required-mark" aria-hidden="true">
                {' '}
                *
              </span>
              {codeIsAuto && <span className="terminal-map-auto-mark">{t.terminal.autoMark}</span>}
            </span>
            <TextField
              id={codeId}
              value={draft.terminalCode}
              disabled={!hasType}
              placeholder={hasType ? undefined : t.terminal.codeNeedsType}
              error={errors.terminalCode ?? fieldErrors.terminalCode}
              onChange={(event) => {
                onChange({ terminalCode: event.target.value });
              }}
            />
          </div>
        </div>
      ) : (
        /*
         * 수정 — 단말 코드 · 유형은 바꾸지 않는다(유형: PDA 가 POP 이 될 수 없다 · 사용자 지시 2026-11-24).
         * 바꿀 수 없는 둘을 맨 위에 글자로, 아래에 고칠 수 있는 칸.
         */
        <div className="form-grid terminal-map-form">
          {/* 단말 코드는 칸 이름 오른쪽 회색 「변경 불가」 라벨 — 다른 화면의 잠긴 코드와 같은 모양(사용자 지시 2026-11-25 · #358). */}
          <div className="field-cell">
            <CodeLockLabel reason={t.terminal.codeLocked} reasonId={`${codeId}-lock`}>
              <span className="field-label">
                <label htmlFor={codeId}>{t.terminal.code}</label>
              </span>
            </CodeLockLabel>
            <output
              id={codeId}
              className="terminal-map-form-static"
              aria-describedby={`${codeId}-lock`}
            >
              {draft.terminalCode}
            </output>
          </div>
          {readOnlyField(`${baseId}-type`, t.terminal.type, codeNames.type(draft.terminalTypeCode))}
          {plantField}
          {warehouseField}
          {equipmentField}
          {/*
           * 운영 상태는 상태 표시라 사람이 고치지 않는다(사용자 지시 2026-11-24). 수정 본문이 이 값을 요구해
           * 서버가 준 값을 그대로 돌려보낸다(toUpdateBody).
           */}
          {readOnlyField(`${baseId}-status`, t.terminal.status, codeNames.status(draft.statusCode))}
        </div>
      )}
    </>
  );
};
