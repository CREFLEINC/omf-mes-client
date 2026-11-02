import { Button, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { Select } from '../../patterns/select';
import { ItemFilterField } from '../iqc-inspection/item-filter-field';
import {
  codeLockReason,
  codeOptionsOf,
  codeTruncatedNote,
  sourceCodeOptions,
  type CodeOption,
} from './disposition-codes';
import type { PendingFilters } from './filters';
import type { DispositionLookup } from './lookups';

interface SelectCellProps {
  label: string;
  options: CodeOption[];
  value: string;
  pendingNote?: string;
  /** 선택지가 «있어도» 상시 붙는 안내. 값 목록이 비어서가 아니라 축의 범위를 알릴 때 쓴다. */
  note?: string;
  wide?: boolean;
  onChange: (value: string) => void;
}

/**
 * 디자인 시스템 `Select`에는 `label` prop이 없다(설치본 실측) — 라벨을 직접 붙이고
 * `htmlFor`로 잇는다. 선택지가 비었을 때 감추지 않고 사유를 다는 것은 공유계약 G-2다.
 *
 * ⚠ **두 안내가 한 자리를 쓴다.** 선택지가 비면 그 사유(G-2)가 먼저다 — 축의 범위를 알리는
 * 안내를 그 위에 겹쳐 놓으면 「왜 못 고르는지」가 밀려난다.
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
  const isPending = options.length === 0;
  const choices = isPending
    ? []
    : [{ value: '', label: messages.dispositionDecision.all }, ...options];
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
        placeholder={
          isPending
            ? messages.dispositionDecision.codePlaceholder
            : messages.dispositionDecision.all
        }
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
  applied: PendingFilters;
  /** 심각도는 공통코드 조회 결과를 그대로 받는다 — 선택지·잠금 사유를 여기서 가른다. */
  severity: DispositionLookup;
  onApply: (filters: PendingFilters) => void;
  onReset: () => void;
}

export const FilterBar = ({ applied, severity, onApply, onReset }: FilterBarProps) => {
  const t = messages.dispositionDecision;
  const fromId = useId();
  const toId = useId();
  const detailId = useId();
  /* 상세 조건(심각도 · 원천)이 걸려 있으면 펼친 채로 연다 — 접힌 칸에 조건이 숨지 않게. */
  const [isDetailOpen, setIsDetailOpen] = useState(
    applied.severityCode !== '' || applied.sourceCode !== '',
  );
  const [draft, setDraft] = useState<PendingFilters>(applied);
  const { from, to, itemId, severityCode, statusCode, sourceCode } = applied;

  useEffect(() => {
    setDraft({ from, to, itemId, severityCode, statusCode, sourceCode });
  }, [from, to, itemId, severityCode, statusCode, sourceCode]);

  /* 심각도·상태와 달리 밖에서 받지 않는다 — 계약이 두 값을 열거해 기다릴 대기가 없다. */
  const sourceOptions = sourceCodeOptions();

  return (
    <div className="disposition-filter-wrap">
      <div className="filter-bar disposition-filter">
        {/*
         * 접수 시작일 · 종료일을 따로(품질 승인 처리의 상신 시작일 · 종료일과 같은 모양 · 사용자 지시 · #223).
         * 기간은 비울 수 없다(L-3) — 지우는 단추를 두지 않고, 쓸 수 없는 기간은 조회 쪽이 최근 한 달로 되돌린다.
         */}
        <div className="field-cell">
          <label className="field-label" htmlFor={fromId}>
            {t.fields.openedFrom}
          </label>
          <DatePicker
            id={fromId}
            placeholder={messages.common.selectDate}
            max={draft.to === '' ? undefined : draft.to}
            value={draft.from === '' ? null : draft.from}
            onChange={(value) => setDraft((current) => ({ ...current, from: value ?? '' }))}
          />
        </div>
        <div className="field-cell">
          <label className="field-label" htmlFor={toId}>
            {t.fields.openedTo}
          </label>
          <DatePicker
            id={toId}
            placeholder={messages.common.selectDate}
            min={draft.from === '' ? undefined : draft.from}
            value={draft.to === '' ? null : draft.to}
            onChange={(value) => setDraft((current) => ({ ...current, to: value ?? '' }))}
          />
        </div>
        {/* 품목 — 검사 조회·판정과 같은 검색 창으로 고른다(사용자 지시 · #223). */}
        <div className="field-cell">
          <ItemFilterField
            value={draft.itemId}
            onChange={(value) => setDraft((current) => ({ ...current, itemId: value }))}
          />
        </div>
        <div className="disposition-filter-actions">
          <div className="filter-actions">
            <Button onClick={() => onApply(draft)}>{messages.common.search}</Button>
            <Button variant="outlined" onClick={onReset}>
              {messages.common.reset}
            </Button>
            {/* 상세 펼치기는 초기화 오른쪽(사용자 지시 · #223) — 심각도 · 원천을 펼쳤다 접는다. */}
            <Button
              variant="text"
              size="sm"
              aria-expanded={isDetailOpen}
              aria-controls={detailId}
              onClick={() => setIsDetailOpen((open) => !open)}
            >
              {isDetailOpen ? t.filterDetail.close : t.filterDetail.open}
            </Button>
          </div>
        </div>
      </div>
      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={detailId} hidden={!isDetailOpen}>
        <div className="filter-bar disposition-filter disposition-filter-detail">
          {/* 심각도 — 공통코드가 채운다(G-32). 못 채운 사유(조회 중·실패·빈 목록)는 칸 옆에 밝힌다(G-2). 상태는 탭 줄 칩이 거른다(#223). */}
          <SelectCell
            label={t.fields.severityPick}
            options={codeOptionsOf(severity)}
            value={draft.severityCode}
            pendingNote={codeLockReason(severity)}
            note={codeTruncatedNote(severity)}
            onChange={(value) => setDraft((current) => ({ ...current, severityCode: value }))}
          />
          {/*
           * 원천 — ⭐ 서버가 대상 LOT의 입고 유형으로 파생해 내리는 축이고 **화면은 보내지 않는다.**
           * 여기서는 «거르는 축»으로만 쓴다. 「두 갈래만 온다」 상시 안내는 걷었다(사용자 지시 · #223).
           */}
          <SelectCell
            label={t.fields.sourcePick}
            options={sourceOptions}
            value={draft.sourceCode}
            onChange={(value) => setDraft((current) => ({ ...current, sourceCode: value }))}
          />
        </div>
      </div>
    </div>
  );
};
