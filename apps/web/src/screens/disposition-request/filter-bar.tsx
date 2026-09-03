import { Button, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { sourceCodeOptions, stageOptions, type CodeOption } from './codes';
import type { TargetFilters } from './filters';
import type { CodeOptionSource } from './lookups';

interface SelectCellProps {
  label: string;
  options: CodeOption[];
  value: string;
  /** 선택지가 비었을 때의 사유(G-2). 비어 있으면 감추지 않고 이유를 단다 */
  pendingNote?: string;
  /** 선택지가 «있어도» 상시 붙는 안내 — 축의 범위나 소스를 알릴 때 쓴다 */
  note?: string;
  wide?: boolean;
  onChange: (value: string) => void;
}

/**
 * 디자인 시스템 `Select`에는 `label` prop이 없다 — 라벨을 직접 붙이고 `htmlFor`로 잇는다(배치 규범 3).
 * 두 안내가 한 자리를 쓴다 — 선택지가 비면 그 사유(G-2)가 먼저다.
 */
const SelectCell = ({
  label,
  options,
  value,
  pendingNote,
  note,
  wide,
  onChange,
}: SelectCellProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const t = messages.dispositionRequest;
  const isPending = options.length === 0;
  const choices = isPending ? [] : [{ value: '', label: t.all }, ...options];
  const description = isPending ? pendingNote : note;

  return (
    <div className={wide === true ? 'field-cell wide-select' : 'field-cell'}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={choices}
        value={value === '' && isPending ? null : value}
        placeholder={isPending ? t.codePlaceholder : t.all}
        aria-describedby={description === undefined ? undefined : noteId}
        onChange={onChange}
      />
      {description !== undefined && (
        <span id={noteId} className="field-note">
          {description}
        </span>
      )}
    </div>
  );
};

export interface FilterBarProps {
  applied: TargetFilters;
  warehouses: CodeOptionSource;
  onApply: (filters: TargetFilters) => void;
  onReset: () => void;
}

export const FilterBar = ({ applied, warehouses, onApply, onReset }: FilterBarProps) => {
  const t = messages.dispositionRequest;
  const [draft, setDraft] = useState<TargetFilters>(applied);
  const { warehouseId, sourceCode, stage, q } = applied;

  useEffect(() => {
    setDraft({ warehouseId, sourceCode, stage, q });
  }, [warehouseId, sourceCode, stage, q]);

  return (
    <div className="filter-bar disposition-request-filter">
      {/*
       * 창고 — 판정 대상은 불량창고에 들어온 LOT이라 선택지는 불량창고 목록이다. 목록이 비면 창고를
       * 거르지 않고 조회한다는 사실을 밝힌다 — 빈 목록을 「데이터가 없다」로 읽지 않게.
       */}
      <SelectCell
        label={t.fields.warehouse}
        options={warehouses.options}
        value={draft.warehouseId}
        pendingNote={t.warehousePending}
        wide
        onChange={(value) => setDraft((current) => ({ ...current, warehouseId: value }))}
      />
      {/* 원천 — 서버가 파생하는 축이고 화면은 «거르는 축»으로만 쓴다(스펙 §5-1-1). */}
      <SelectCell
        label={t.fields.sourceCode}
        options={sourceCodeOptions()}
        value={draft.sourceCode}
        onChange={(value) => setDraft((current) => ({ ...current, sourceCode: value }))}
      />
      {/*
       * 상태 — 「부적합 없음」은 대상 목록의 서버 축이고, 나머지 셋은 부적합 목록에서 온다
       * (요구서 §3-7 둘째 행). 소스가 갈린다는 사실을 상시 적는다 — 검색어가 그쪽에는 안 실린다.
       */}
      <SelectCell
        label={t.fields.stage}
        options={stageOptions()}
        value={draft.stage}
        note={t.stageSourceNote}
        onChange={(value) => setDraft((current) => ({ ...current, stage: value }))}
      />
      <div className="field-cell">
        <TextField
          label={t.fields.keyword}
          value={draft.q}
          placeholder={t.keywordPlaceholder}
          fullWidth
          onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
        />
      </div>
      <div className="disposition-request-filter-actions">
        <div className="filter-actions">
          <Button onClick={() => onApply(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
