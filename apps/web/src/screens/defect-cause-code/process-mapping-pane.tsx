import {
  AlertBanner,
  Button,
  EmptyState,
  Icon,
  SearchInput,
  SkeletonText,
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
    /* 칸을 누르면 바로 연결 · 해제한다(종전 매트릭스와 같은 동작). 저장 중에는 막는다. */
    const toggle = (defectCodeId: number, processId: number): void => {
      if (write.isSaving) return;
      const assigned = mappedByDefect.get(defectCodeId)?.has(processId) === true;
      write.write({ defectCodeId, processId, intent: assigned ? 'revoke' : 'assign' });
    };

    content = (
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
            {processes.map((process) => (
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
              {processes.map((process) => {
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
