import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { PagedSelect, Select } from '../../patterns/select';

import type { CodeAdapter } from './adapters';
import { DEFAULT_CODE_FILTERS } from './code-options';
import { CodeSelect } from './code-select';
import type { CodeFilters } from './types';

const t = messages.defectCauseCode;

/** 공정 칸의 한 쪽 건수 — 종전 공정 검색 창의 첫 쪽과 같다. */
const PROCESS_SELECT_PAGE_SIZE = 20;

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
  const codeSelectId = useId();
  const processSelectId = useId();
  const { client } = useApiClient();
  /* 처분 유형은 처분 값이 있는 코드에만, 공정 검색은 늘(사용자 지시 · #209). */
  const showDisposition = adapter.hasDisposition;
  const dispositionLabel = (code: CodeFilters['dispositionTypeCode']): string =>
    code === '' ? t.filters.all : t.values.disposition[code];
  const processLabel = (id: string): string =>
    id === '' ? '' : (processLabelOf(Number(id)) ?? id);
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  // 편집 중인 값은 draft에만 있고 조건 칩에는 미러하지 않는다.
  const [draft, setDraft] = useState<CodeFilters>(appliedFilters);
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
        {showDisposition && (
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
         * 코드는 **칸에서 바로 검색해서 고른다**(omf-all-around#226) — 고른 코드가 검색어로 들어간다. 「전체」는 종전 × 자리다.
         * 조회를 눌러야 목록에 걸린다(다른 조건과 같은 트리거).
         */}
        <div className="field-cell defect-cause-code-field search-select-cell">
          <span className="field-label">
            <label htmlFor={codeSelectId}>{adapter.labels.searchLabel}</label>
          </span>
          <CodeSelect
            id={codeSelectId}
            adapter={adapter}
            includeInactive={appliedFilters.includeInactive}
            value={draft.q}
            onPick={(code) => setDraft((prev) => ({ ...prev, q: code === null ? '' : code.code }))}
          />
        </div>
        {/*
         * 공정 — 칸에서 바로 검색해서 고른다(#226 · 종전 공정 검색 창과 같은 조회). 「전체」는 종전 × 자리다.
         * 다른 조건처럼 「조회」를 눌러야 목록에 걸린다(#209).
         */}
        <div className="field-cell defect-cause-process-field search-select-cell">
          <span className="field-label">
            <label htmlFor={processSelectId}>{t.filters.process}</label>
          </span>
          <PagedSelect
            id={processSelectId}
            queryKey={['defect-cause-code', 'process-select']}
            fetchPage={async (q, page) => {
              const data = await runRequest(() =>
                client.GET('/mdm/processes', {
                  params: {
                    query: { ...(q === '' ? {} : { q }), page, size: PROCESS_SELECT_PAGE_SIZE },
                  },
                }),
              );
              return {
                options: data.items.map((process) => ({
                  value: String(process.processId),
                  label: `${process.processCode} · ${process.processName}`,
                })),
                total: data.page.total,
              };
            }}
            selectedOption={
              draft.processId === ''
                ? null
                : { value: draft.processId, label: processLabel(draft.processId) }
            }
            leadingOptions={[{ value: '', label: t.filters.all }]}
            value={draft.processId}
            placeholder={t.filters.all}
            onChange={(value) => setDraft((prev) => ({ ...prev, processId: value }))}
          />
        </div>
        {/* 「미사용 포함」 확인칸은 두지 않는다 — 탭 줄의 사용 여부 칩(전체 · 사용 · 미사용)이 맡는다(사용자 지시 · #209). */}
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
        </div>
      )}
    </>
  );
};
