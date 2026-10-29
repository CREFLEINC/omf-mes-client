import { Button, Checkbox, Chip, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import type { CodeAdapter } from './adapters';
import { DEFAULT_CODE_FILTERS } from './code-options';
import { CodePickerDialog } from './code-picker-dialog';
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
}: CodeFilterBarProps) => {
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  // 편집 중인 값은 draft에만 있고 조건 칩에는 미러하지 않는다.
  const [draft, setDraft] = useState<CodeFilters>(appliedFilters);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const {
    q: appliedQ,
    includeInactive: appliedIncludeInactive,
    inactiveOnly: appliedInactiveOnly,
    page: appliedPage,
    size: appliedSize,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      q: appliedQ,
      includeInactive: appliedIncludeInactive,
      inactiveOnly: appliedInactiveOnly,
      page: appliedPage,
      size: appliedSize,
    });
  }, [appliedQ, appliedIncludeInactive, appliedInactiveOnly, appliedPage, appliedSize]);

  return (
    <>
      <div className="filter-bar">
        {/*
         * 코드는 **창에서 검색해서 고른다** — 검사 조회·판정의 품목 검색과 같은 모양(사용자 지시 2026-10-29 · #209).
         * 코드가 많아도 찾게 한다. 읽기 전용 칸을 누르거나 엔터를 치면 창이 열리고, 고른 코드가 검색어로 들어간다.
         * 지우기는 값이 있을 때만 칸 안의 × 다. 조회를 눌러야 목록에 걸린다(다른 조건과 같은 트리거).
         */}
        <SearchInput
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

      {(appliedFilters.q !== '' || appliedFilters.includeInactive) && (
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
