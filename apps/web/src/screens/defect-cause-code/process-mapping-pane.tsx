import {
  AlertBanner,
  Button,
  EmptyState,
  Icon,
  MatrixGrid,
  SearchInput,
  SkeletonText,
  type MatrixColumn,
  type MatrixRow,
  useToast,
} from '@crefle/web-ui';
import type { ApiClient, ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest, toApiError, type ApiCallResult } from '../../patterns/request';
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

  const columns: MatrixColumn[] = processes.map((process) => ({
    key: String(process.processId),
    /* 공정명 위 · 공정코드 아래 흐리게(#209). */
    label: (
      <span className="defect-mapping-col">
        <span>{process.processName}</span>
        <span className="defect-mapping-col-code">{process.processCode}</span>
      </span>
    ),
  }));
  /* 조회 카드의 검색어(#209) — 화면에 받은 목록 안에서 코드 · 이름 · 대분류 이름으로 거른다. 매핑 저장과 무관하다. */
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const needle = keyword.trim().toLowerCase();
  const shownDefects =
    needle === ''
      ? defects
      : defects.filter((defect) =>
          [defect.code, defect.name, categories.get(defect.parentId ?? 0)?.name ?? '']
            .join(' ')
            .toLowerCase()
            .includes(needle),
        );

  const rows: MatrixRow[] = shownDefects.map((defect) => ({
    /* 「코드 · 이름」 위, 대분류 이름 아래 흐리게 — 불량코드 탭의 대분류 · 상세 표시와 같은 결(#209). */
    label: (
      <span className="defect-mapping-row">
        <span className="defect-mapping-row-code">{`${defect.code} · ${defect.name}`}</span>
        <span className="defect-mapping-row-parent">
          {categories.get(defect.parentId ?? 0)?.name ?? t.groupHeaderOrphan}
        </span>
      </span>
    ),
    cells: processes.map((process) => {
      const assigned = mappedByDefect.get(defect.id)?.has(process.processId) === true;
      return {
        key: `${String(defect.id)}:${String(process.processId)}`,
        status: assigned ? ('success' as const) : ('none' as const),
        content: <span aria-hidden>{assigned ? '✓' : '—'}</span>,
        ariaLabel: `${defect.code} · ${process.processName} · ${
          assigned ? t.mapping.assigned : t.mapping.notAssigned
        }`,
      };
    }),
  }));

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
          <Button
            variant="outlined"
            onClick={() => {
              setDraft('');
              setKeyword('');
            }}
          >
            {messages.common.reset}
          </Button>
        }
      />
    );
  } else {
    content = (
      <MatrixGrid
        size="md"
        aria-label={t.panes.mapping}
        aria-busy={write.isSaving}
        columns={columns}
        rows={rows}
        onCellClick={
          write.isSaving
            ? undefined
            : (_row, _column, cell) => {
                const [defectPart, processPart] = cell.key.split(':');
                if (defectPart === undefined || processPart === undefined) return;
                const defectCodeId = Number(defectPart);
                const processId = Number(processPart);
                if (!Number.isInteger(defectCodeId) || !Number.isInteger(processId)) return;
                const assigned = mappedByDefect.get(defectCodeId)?.has(processId) === true;
                write.write({
                  defectCodeId,
                  processId,
                  intent: assigned ? 'revoke' : 'assign',
                });
              }
        }
      />
    );
  }

  return (
    <>
      {/* 조회 조건 — 불량코드 탭처럼 표와 다른 카드에 둔다(#209). */}
      <section className="pane inspection-standard-search defect-cause-search" role="search">
        <div className="filter-bar">
          <SearchInput
            label={t.mappingView.searchLabel}
            placeholder={t.mappingView.searchPlaceholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onSearch={(value) => setKeyword(value)}
            clearLabel={messages.common.clear}
          />
          <div className="filter-actions field-cell-unlabeled">
            <Button variant="filled" onClick={() => setKeyword(draft)}>
              {messages.common.search}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setDraft('');
                setKeyword('');
              }}
            >
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
                {t.mappingView.counts(shownDefects.length, processes.length)}
              </span>
            )}
          </div>
          <div className="inspection-hub-counts" aria-hidden>
            <span className="inspection-hub-count">{t.mappingView.legendAssigned}</span>
            <span className="inspection-hub-count">{t.mappingView.legendNone}</span>
          </div>
        </div>
        {/* 정보 안내 — 검사 조회·판정의 안내 줄과 같은 모양(#209). */}
        <p className="iqc-inspection-action-note defect-cause-mapping-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {t.mapping.description}
        </p>
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
