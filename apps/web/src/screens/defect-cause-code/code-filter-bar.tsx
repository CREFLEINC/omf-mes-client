import { Button, Checkbox, Chip, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { Select } from '../../patterns/select';

import type { CodeAdapter } from './adapters';
import { DEFAULT_CODE_FILTERS } from './code-options';
import { CodePickerDialog } from './code-picker-dialog';
import { ProcessPickerDialog } from './process-picker-dialog';
import type { CodeFilters } from './types';

const t = messages.defectCauseCode;

export interface CodeFilterBarProps {
  adapter: CodeAdapter;
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: CodeFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출 */
  onApplyFilters: (next: CodeFilters) => void;
  /** 조회 · 초기화 뒤, 구분선 너머에 서는 화면 단추(대분류 추가 · 상세 추가) */
  actions: ReactNode;
  /** 공정 번호 → 「공정코드 · 공정명」. 불량코드 탭의 공정 조건 칸이 고른 공정 이름을 낸다 */
  processLabelOf: (processId: number | null | undefined) => string | null;
}

/**
 * 조회 조건 카드 한 줄 — 검사 기준 탭과 같은 모양(omf-all-around#209 · #196).
 * 목록 구획 안에 두면 좌우 배치에서 좁은 목록 칸에 조건과 단추가 끼어 줄이 넘친다.
 */
export const CodeFilterBar = ({
  adapter,
  appliedFilters,
  onApplyFilters,
  actions,
  processLabelOf,
}: CodeFilterBarProps) => {
  const dispositionId = useId();
  const [isProcessPickerOpen, setIsProcessPickerOpen] = useState(false);
  /* 처분 유형 · 공정 조건은 불량코드 탭에만 둔다(사용자 지시 2026-10-29 · #209). */
  const showCodeConditions = adapter.hasDisposition;
  const dispositionLabel = (code: CodeFilters['dispositionTypeCode']): string =>
    code === '' ? t.filters.all : t.values.disposition[code];
  const processLabel = (id: string): string =>
    id === '' ? '' : (processLabelOf(Number(id)) ?? id);
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  // 편집 중인 값은 draft에만 있고 조건 칩에는 미러하지 않는다.
  const [draft, setDraft] = useState<CodeFilters>(appliedFilters);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const {
    q: appliedQ,
    includeInactive: appliedIncludeInactive,
    inactiveOnly: appliedInactiveOnly,
    dispositionTypeCode: appliedDisposition,
    processId: appliedProcessId,
    page: appliedPage,
    size: appliedSize,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      q: appliedQ,
      includeInactive: appliedIncludeInactive,
      inactiveOnly: appliedInactiveOnly,
      dispositionTypeCode: appliedDisposition,
      processId: appliedProcessId,
      page: appliedPage,
      size: appliedSize,
    });
  }, [
    appliedQ,
    appliedIncludeInactive,
    appliedInactiveOnly,
    appliedDisposition,
    appliedProcessId,
    appliedPage,
    appliedSize,
  ]);

  return (
    <>
      <div className="filter-bar">
        {/* 순서: 처분 유형 · 불량코드 검색 · 공정 검색 · 미사용 포함(사용자 지시 2026-10-29 · #209). */}
        {showCodeConditions && (
          <div className="field-cell defect-cause-filter-select">
            <span className="field-label">
              <label htmlFor={dispositionId}>{t.filters.disposition}</label>
            </span>
            <Select
              id={dispositionId}
              options={[
                { value: '', label: t.filters.all },
                { value: 'REWORKABLE', label: t.values.disposition.REWORKABLE },
                { value: 'SCRAP', label: t.values.disposition.SCRAP },
              ]}
              value={draft.dispositionTypeCode}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  dispositionTypeCode: value as CodeFilters['dispositionTypeCode'],
                }))
              }
            />
          </div>
        )}
        {/*
         * 코드는 **창에서 검색해서 고른다** — 검사 조회·판정의 품목 검색과 같은 모양(사용자 지시 2026-10-29 · #209).
         * 코드가 많아도 찾게 한다. 읽기 전용 칸을 누르거나 엔터를 치면 창이 열리고, 고른 코드가 검색어로 들어간다.
         * 지우기는 값이 있을 때만 칸 안의 × 다. 조회를 눌러야 목록에 걸린다(다른 조건과 같은 트리거).
         */}
        <SearchInput
          containerClassName="defect-cause-code-field"
          label={adapter.labels.searchLabel}
          placeholder={adapter.labels.searchPlaceholder}
          value={draft.q}
          readOnly
          title={draft.q === '' ? undefined : draft.q}
          aria-haspopup="dialog"
          clearLabel={t.picker.clear(adapter.labels.tab)}
          onClick={() => setIsPickerOpen(true)}
          onSearch={() => setIsPickerOpen(true)}
          onChange={() => undefined}
          onClear={() => setDraft((prev) => ({ ...prev, q: '' }))}
        />
        {/* 처분 유형 · 공정 — 다른 조건처럼 「조회」를 눌러야 목록에 걸린다(#209). */}
        {showCodeConditions && (
          <>
            {/*
             * 공정은 많을 수 있어 **창에서 검색해서 고른다** — 불량코드 검색과 같은 조작(사용자 지시 · #209).
             * 읽기 전용 칸을 누르거나 엔터를 치면 창이 열린다. 지우기는 칸 안의 × 다.
             */}
            <SearchInput
              containerClassName="defect-cause-process-field"
              label={t.filters.process}
              placeholder={t.processPicker.fieldPlaceholder}
              value={processLabel(draft.processId)}
              readOnly
              title={draft.processId === '' ? undefined : processLabel(draft.processId)}
              aria-haspopup="dialog"
              clearLabel={t.processPicker.clear}
              onClick={() => setIsProcessPickerOpen(true)}
              onSearch={() => setIsProcessPickerOpen(true)}
              onChange={() => undefined}
              onClear={() => setDraft((prev) => ({ ...prev, processId: '' }))}
            />
          </>
        )}
        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeInactive}
            onChange={(event) =>
              // 끄면 「미사용만」도 함께 풀린다 — 미사용을 빼고 미사용만 볼 수는 없다.
              onApplyFilters({
                ...appliedFilters,
                includeInactive: event.target.checked,
                inactiveOnly: event.target.checked && appliedFilters.inactiveOnly,
              })
            }
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>
        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 조회는 이 줄의 주 동작(채운 빨강), 초기화는 테두리 단추 — 검사 기준 탭과 같다(#196).
         */}
        <div className="filter-actions field-cell-unlabeled">
          <Button variant="filled" onClick={() => onApplyFilters(draft)}>
            {messages.common.search}
          </Button>
          <Button
            variant="outlined"
            onClick={() => onApplyFilters({ ...DEFAULT_CODE_FILTERS, size: appliedFilters.size })}
          >
            {messages.common.reset}
          </Button>
          <span className="inspection-standard-filter-divider" aria-hidden />
          {actions}
        </div>
      </div>

      {(appliedFilters.q !== '' ||
        appliedFilters.includeInactive ||
        appliedFilters.dispositionTypeCode !== '' ||
        appliedFilters.processId !== '') && (
        <div className="filter-bar">
          {appliedFilters.q !== '' && (
            <Chip
              variant="status"
              removeLabel={t.filters.chipRemoveKeyword}
              onRemove={() => onApplyFilters({ ...appliedFilters, q: '' })}
            >
              {t.filters.chipKeyword(appliedFilters.q)}
            </Chip>
          )}
          {appliedFilters.dispositionTypeCode !== '' && (
            <Chip
              variant="status"
              removeLabel={t.filters.chipRemoveDisposition}
              onRemove={() => onApplyFilters({ ...appliedFilters, dispositionTypeCode: '' })}
            >
              {t.filters.chipDisposition(dispositionLabel(appliedFilters.dispositionTypeCode))}
            </Chip>
          )}
          {appliedFilters.processId !== '' && (
            <Chip
              variant="status"
              removeLabel={t.filters.chipRemoveProcess}
              onRemove={() => onApplyFilters({ ...appliedFilters, processId: '' })}
            >
              {t.filters.chipProcess(processLabel(appliedFilters.processId))}
            </Chip>
          )}
          {appliedFilters.includeInactive && (
            <Chip
              variant="status"
              removeLabel={t.filters.chipRemoveIncludeInactive}
              onRemove={() =>
                onApplyFilters({ ...appliedFilters, includeInactive: false, inactiveOnly: false })
              }
            >
              {messages.common.includeInactive}
            </Chip>
          )}
        </div>
      )}
      {isProcessPickerOpen && (
        <ProcessPickerDialog
          onClose={() => setIsProcessPickerOpen(false)}
          onConfirm={(process) => {
            setDraft((prev) => ({ ...prev, processId: String(process.processId) }));
            setIsProcessPickerOpen(false);
          }}
        />
      )}
      {isPickerOpen && (
        <CodePickerDialog
          adapter={adapter}
          includeInactive={appliedFilters.includeInactive}
          onClose={() => setIsPickerOpen(false)}
          onConfirm={(code) => {
            setDraft((prev) => ({ ...prev, q: code.code }));
            setIsPickerOpen(false);
          }}
        />
      )}
    </>
  );
};
