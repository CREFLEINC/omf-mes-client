import {
  AlertBanner,
  Button,
  Chip,
  EmptyState,
  Icon,
  SearchInput,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import type { ApiClient, ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest, toApiError, type ApiCallResult } from '../../patterns/request';
import { Select } from '../../patterns/select';
import { defectToHierarchyCode } from './mappers';

type DefectCode = components['schemas']['DefectCode'];
type DefectCodeProcess = components['schemas']['DefectCodeProcess'];
type Process = components['schemas']['Process'];
type PageMeta = components['schemas']['PageMeta'];

const t = messages.defectCauseCode;
const EMPTY_DEFECTS: DefectCode[] = [];
const EMPTY_PROCESSES: Process[] = [];

interface ListResponse<T> {
  items: T[];
  page: PageMeta;
}

/** 조회 카드 조건(#209) — 대분류 · 공정 · 검색어. 「조회」를 눌러야 표에 걸린다. */
interface MappingFilters {
  q: string;
  categoryId: string;
  processId: string;
}

const EMPTY_MAPPING_FILTERS: MappingFilters = { q: '', categoryId: '', processId: '' };

/** 연결 상태 — 탭 줄 오른쪽 칩으로 고른다(사용자 지시 2026-10-29 · #209). 누르면 바로 걸린다. */
type MappingLink = 'all' | 'linked' | 'unlinked';

interface MappingToggle {
  defectCodeId: number;
  processId: number;
  intent: 'assign' | 'revoke';
}

const mappingKeys = {
  all: ['defect-process-mappings'] as const,
  defects: ['defect-process-mappings', 'defects'] as const,
  processes: ['defect-process-mappings', 'processes'] as const,
  row: (defectCodeId: number) => ['defect-process-mappings', 'row', defectCodeId] as const,
};

const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

const LoadErrorBanner = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

const toToggleResult = <T,>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): ApiCallResult<DefectCodeProcess | null> => ({
  data: (result.data as DefectCodeProcess | undefined) ?? null,
  error: result.error,
  response: result.response,
});

const assignMapping = async (
  client: ApiClient['client'],
  input: MappingToggle,
  idempotencyKey: string,
): Promise<ApiCallResult<DefectCodeProcess | null>> =>
  toToggleResult(
    await client.POST('/quality/defect-codes/{defectCodeId}/processes', {
      params: {
        path: { defectCodeId: input.defectCodeId },
        header: { 'Idempotency-Key': idempotencyKey },
      },
      body: { processId: input.processId },
    }),
  );

const revokeMapping = async (
  client: ApiClient['client'],
  input: MappingToggle,
  idempotencyKey: string,
): Promise<ApiCallResult<DefectCodeProcess | null>> =>
  toToggleResult(
    await client.DELETE('/quality/defect-codes/{defectCodeId}/processes/{processId}', {
      params: {
        path: { defectCodeId: input.defectCodeId, processId: input.processId },
        header: { 'Idempotency-Key': idempotencyKey },
      },
    }),
  );

/** W-06-03의 공정 × 상세 불량코드 N:M 매핑. 셀 토글은 계약대로 즉시 반영한다. */
export const ProcessMappingPane = () => {
  const { client } = useApiClient();
  const toast = useToast();

  const defectsQuery = useQuery({
    queryKey: mappingKeys.defects,
    queryFn: () =>
      runRequest(() => client.GET('/quality/defect-codes', { params: { query: {} } })) as Promise<
        ListResponse<DefectCode>
      >,
  });
  const processesQuery = useQuery({
    queryKey: mappingKeys.processes,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/processes', { params: { query: {} } })) as Promise<
        ListResponse<Process>
      >,
  });

  const allDefects = defectsQuery.data?.items ?? EMPTY_DEFECTS;
  const defects = useMemo(
    () => allDefects.map(defectToHierarchyCode).filter((item) => item.parentId !== null),
    [allDefects],
  );
  const processes = processesQuery.data?.items ?? EMPTY_PROCESSES;

  const mappingQueries = useQueries({
    queries: defects.map((defect) => ({
      queryKey: mappingKeys.row(defect.id),
      queryFn: () =>
        runRequest(() =>
          client.GET('/quality/defect-codes/{defectCodeId}/processes', {
            params: { path: { defectCodeId: defect.id } },
          }),
        ),
    })),
  });

  const mappedByDefect = useMemo(
    () =>
      new Map(
        defects.map((defect, index) => [
          defect.id,
          new Set(mappingQueries[index]?.data?.items.map((mapping) => mapping.processId) ?? []),
        ]),
      ),
    [defects, mappingQueries],
  );

  const write = useMasterWrite<MappingToggle, DefectCodeProcess | null>({
    request: (input, headers) =>
      input.intent === 'assign'
        ? assignMapping(client, input, headers['Idempotency-Key'])
        : revokeMapping(client, input, headers['Idempotency-Key']),
    etagPath: null,
    invalidateKeys: [mappingKeys.all],
    knownFields: [],
    onSuccess: () => {
      toast.show({ variant: 'success', description: t.mapping.saved });
    },
  });

  const categories = useMemo(
    () =>
      new Map(
        allDefects
          .map(defectToHierarchyCode)
          .filter((item) => item.parentId === null)
          .map((item) => [item.id, item]),
      ),
    [allDefects],
  );

  /*
   * 조회 카드 조건(#209) — 화면에 받은 목록 안에서 거른다. 매핑 저장과 무관하다.
   * 공정을 고르면 그 공정 열만 보이고, 연결 상태도 보이는 공정 기준으로 판단한다.
   */
  const hubTarget = useHubActionsTarget();
  const categoryFieldId = useId();
  const processFieldId = useId();
  const [link, setLink] = useState<MappingLink>('all');
  const [draft, setDraft] = useState<MappingFilters>(EMPTY_MAPPING_FILTERS);
  const [applied, setApplied] = useState<MappingFilters>(EMPTY_MAPPING_FILTERS);
  const resetFilters = (): void => {
    setDraft(EMPTY_MAPPING_FILTERS);
    setApplied(EMPTY_MAPPING_FILTERS);
  };
  const shownProcesses =
    applied.processId === ''
      ? processes
      : processes.filter((process) => String(process.processId) === applied.processId);
  const needle = applied.q.trim().toLowerCase();
  const isLinked = (defectId: number): boolean => {
    const mapped = mappedByDefect.get(defectId);
    return shownProcesses.some((process) => mapped?.has(process.processId) === true);
  };
  /* 칩 건수는 조회 조건까지 거른 코드 기준이다 — 칩끼리 더하면 「전체」가 된다. */
  const searchedDefects = defects.filter((defect) => {
    if (applied.categoryId !== '' && String(defect.parentId) !== applied.categoryId) return false;
    if (needle === '') return true;
    return [defect.code, defect.name, categories.get(defect.parentId ?? 0)?.name ?? '']
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
  const linkedCount = searchedDefects.filter((defect) => isLinked(defect.id)).length;
  const linkCounts: Record<MappingLink, number> = {
    all: searchedDefects.length,
    linked: linkedCount,
    unlinked: searchedDefects.length - linkedCount,
  };
  const shownDefects =
    link === 'all'
      ? searchedDefects
      : searchedDefects.filter((defect) => isLinked(defect.id) === (link === 'linked'));

  const firstMappingError = mappingQueries.find((query) => query.isError)?.error;
  const loadError = defectsQuery.error ?? processesQuery.error ?? firstMappingError ?? null;
  const isLoading =
    defectsQuery.isPending ||
    processesQuery.isPending ||
    mappingQueries.some((query) => query.isPending);
  const truncated =
    (defectsQuery.data !== undefined &&
      defectsQuery.data.page.total > defectsQuery.data.items.length) ||
    (processesQuery.data !== undefined &&
      processesQuery.data.page.total > processesQuery.data.items.length);

  const retry = () => {
    void defectsQuery.refetch();
    void processesQuery.refetch();
    for (const query of mappingQueries) void query.refetch();
  };

  let content: ReactNode;
  if (loadError !== null) content = <LoadErrorBanner error={loadError} onRetry={retry} />;
  else if (isLoading) {
    content = (
      <div role="status" aria-label={t.loading.mapping}>
        <SkeletonText lines={6} />
      </div>
    );
  } else if (defects.length === 0) {
    content = (
      <EmptyState
        size="sm"
        live
        icon={
          <span className="inspection-standard-empty-icon">
            <Icon name="list_alt" size={20} />
          </span>
        }
        title={t.empty.mappingNoneTitle}
        description={t.empty.mappingNoneDescription}
      />
    );
  } else if (processes.length === 0) {
    content = (
      <EmptyState
        size="sm"
        live
        icon={
          <span className="inspection-standard-empty-icon">
            <Icon name="list_alt" size={20} />
          </span>
        }
        title={t.empty.processNoneTitle}
        description={t.empty.processNoneDescription}
      />
    );
  } else if (shownDefects.length === 0) {
    content = (
      <EmptyState
        size="sm"
        live
        icon={
          <span className="inspection-standard-empty-icon">
            <Icon name="search_off" size={20} />
          </span>
        }
        title={t.mappingView.noMatchTitle}
        description={t.mappingView.noMatchDescription}
        action={
          <Button variant="outlined" onClick={resetFilters}>
            {messages.common.reset}
          </Button>
        }
      />
    );
  } else {
    /* 칸을 누르면 바로 연결 · 해제한다(종전 매트릭스와 같은 동작). 저장 중에는 막는다. */
    const toggle = (defectCodeId: number, processId: number): void => {
      if (write.isSaving) return;
      const assigned = mappedByDefect.get(defectCodeId)?.has(processId) === true;
      write.write({ defectCodeId, processId, intent: assigned ? 'revoke' : 'assign' });
    };

    content =
      (
        /*
         * 공정별 불량코드 설정 표(사용자 시안 · #209) — 왼쪽 「불량코드 · 명칭」, 공정마다 둥근 선택 표시.
         * 칸(셀)이 이름(「코드 · 공정 · 매핑됨/안 됨」)과 상태를 갖고, 칸 안 단추가 키보드로 누르는 길이다.
         */
        <table
          className="defect-mapping-table"
          role="grid"
          aria-label={t.panes.mapping}
          aria-busy={write.isSaving}
        >
          <thead>
            <tr>
              <th scope="col" className="defect-mapping-corner">
                {t.mappingView.rowHeader}
              </th>
              {shownProcesses.map((process) => (
                <th key={process.processId} scope="col">
                  <span className="defect-mapping-col">
                    <span>{process.processName}</span>
                    <span className="defect-mapping-col-code">{process.processCode}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownDefects.map((defect) => (
              <tr key={defect.id}>
                <th scope="row">
                  <span className="defect-mapping-row">
                    <span className="defect-mapping-row-code">{`${defect.code} · ${defect.name}`}</span>
                    <span className="defect-mapping-row-parent">
                      {categories.get(defect.parentId ?? 0)?.name ?? t.groupHeaderOrphan}
                    </span>
                  </span>
                </th>
                {shownProcesses.map((process) => {
                  const assigned = mappedByDefect.get(defect.id)?.has(process.processId) === true;
                  const label = `${defect.code} · ${process.processName} · ${
                    assigned ? t.mapping.assigned : t.mapping.notAssigned
                  }`;
                  return (
                    <td
                      key={process.processId}
                      aria-label={label}
                      data-status={assigned ? 'success' : undefined}
                      onClick={() => toggle(defect.id, process.processId)}
                    >
                      <button
                        type="button"
                        className="defect-mapping-toggle"
                        aria-pressed={assigned}
                        aria-label={label}
                        disabled={write.isSaving}
                      >
                        {assigned && <Icon name="check" size={16} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }

  const linkOptions: readonly { value: MappingLink; label: string }[] = [
    { value: 'all', label: t.usage.all },
    { value: 'linked', label: t.mappingView.linked },
    { value: 'unlinked', label: t.mappingView.unlinked },
  ];

  return (
    <>
      {/* 연결 상태 칩 — 불량코드 탭의 사용 여부 칩과 같은 자리 · 모양(사용자 지시 2026-10-29 · #209). */}
      {hubTarget !== null && (
        <HubActions target={hubTarget}>
          <div
            className="inspection-hub-counts defect-cause-usage"
            role="group"
            aria-label={t.mappingView.linkLabel}
          >
            {linkOptions.map((option) => (
              <Chip
                key={option.value}
                variant="filter"
                size="sm"
                selected={link === option.value}
                aria-pressed={link === option.value}
                onSelectedChange={() => {
                  if (link !== option.value) setLink(option.value);
                }}
              >
                {isLoading || loadError !== null
                  ? option.label
                  : t.usage.count(option.label, linkCounts[option.value])}
              </Chip>
            ))}
          </div>
        </HubActions>
      )}
      {/* 조회 조건 — 불량코드 탭처럼 표와 다른 카드에 둔다(#209). */}
      <section className="pane inspection-standard-search defect-cause-search" role="search">
        <div className="filter-bar">
          {/* 순서: 대분류 선택 · 공정 선택 · 불량코드 검색(사용자 지시 2026-10-29 · #209). */}
          <div className="field-cell defect-cause-filter-select">
            <span className="field-label">
              <label htmlFor={categoryFieldId}>{t.mappingView.categoryLabel}</label>
            </span>
            <Select
              id={categoryFieldId}
              options={[
                { value: '', label: t.filters.all },
                ...[...categories.values()].map((category) => ({
                  value: String(category.id),
                  label: category.name,
                })),
              ]}
              value={draft.categoryId}
              onChange={(value) => setDraft((prev) => ({ ...prev, categoryId: value }))}
            />
          </div>
          <div className="field-cell defect-cause-filter-select">
            <span className="field-label">
              <label htmlFor={processFieldId}>{t.mappingView.processLabel}</label>
            </span>
            <Select
              id={processFieldId}
              options={[
                { value: '', label: t.filters.all },
                ...processes.map((process) => ({
                  value: String(process.processId),
                  label: process.processName,
                })),
              ]}
              value={draft.processId}
              onChange={(value) => setDraft((prev) => ({ ...prev, processId: value }))}
            />
          </div>
          {/* 흐린 안내 글이 잘리지 않는 폭(사용자 지시 2026-10-29 · #209). */}
          <SearchInput
            containerClassName="defect-mapping-search-field"
            label={t.mappingView.searchLabel}
            placeholder={t.mappingView.searchPlaceholder}
            value={draft.q}
            onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
            onSearch={(value) => setApplied({ ...draft, q: value })}
            clearLabel={messages.common.clear}
          />
          <div className="filter-actions field-cell-unlabeled">
            <Button variant="filled" onClick={() => setApplied(draft)}>
              {messages.common.search}
            </Button>
            <Button variant="outlined" onClick={resetFilters}>
              {messages.common.reset}
            </Button>
          </div>
        </div>
      </section>

      <section
        className="pane defect-process-mapping-pane inspection-standard-detail-card"
        aria-label={t.panes.mapping}
      >
        <div className="inspection-standard-plan-head">
          <div className="inspection-standard-plan-chips">
            <h2 className="pane-title">{t.panes.mapping}</h2>
            {!isLoading && loadError === null && (
              <span className="defect-cause-child-count">
                {t.mappingView.counts(shownDefects.length, shownProcesses.length)}
              </span>
            )}
          </div>
          {/* 안내 문구는 제목 줄 맨 오른쪽(사용자 지시 2026-10-29 · #209). 둥근 표시가 연결 여부를 보여 범례는 두지 않는다. */}
          <p className="iqc-inspection-action-note defect-cause-mapping-note" data-tone="info">
            <Icon name="info" size={14} aria-hidden />
            {t.mapping.description}
          </p>
        </div>
        {truncated && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.mapping.truncated}</AlertBanner>
          </div>
        )}
        <SaveErrorBanner error={write.error} />
        <div className="defect-mapping-box">{content}</div>
      </section>
    </>
  );
};
