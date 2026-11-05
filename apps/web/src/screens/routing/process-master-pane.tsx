import {
  AlertBanner,
  Button,
  Checkbox,
  type Column,
  Dialog,
  EmptyState,
  SkeletonText,
  Table,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import {
  SaveErrorBanner,
  codeLockMessage,
  requireIfMatch,
  useMasterWrite,
} from '../../patterns/master';
import { TAB_PAGE_SIZES, type TabPageSize } from '../../patterns/client-page';
import { PageNav, type PageNavMeta } from '../../patterns/page-nav';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { runRequest, toApiError } from '../../patterns/request';
import { PagedSelect, Select } from '../../patterns/select';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import {
  emptyProcessFormValues,
  isSameProcessValues,
  processToFormValues,
  toProcessCreate,
  toProcessUpdate,
} from './process-master';
import { PROCESS_FORM_FIELDS, validateProcess } from './process-validation';
import {
  type ListPaging,
  processDetailPath,
  processKeys,
  useProcessDetail,
  useProcessList,
  useProcessTypeOptions,
} from './queries';
import { ROUTING_ORIENTATION_KEY } from './split-layout';
import type { Process, ProcessDetailResponse, ProcessFilters, ProcessFormValues } from './types';
import { centerColumns } from './table-align';

const t = messages.routing;
const hubText = messages.common.inspectionHub;

const DEFAULT_FILTERS: ProcessFilters = { q: '', includeInactive: false };

/** 공정 검색 칸이 한 번에 받는 건수 — 목록 끝에 닿으면 다음 쪽을 받는다. */
const PROCESS_SEARCH_PAGE_SIZE = 20;

interface ProcessFormState {
  source: 'create' | ProcessDetailResponse;
  baseline: ProcessFormValues;
  values: ProcessFormValues;
}

type ActivationIntent = 'activate' | 'deactivate';

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

/** W-06-01의 두 번째 축. 품목과 무관한 공정 마스터를 목록과 편집 페인으로 관리한다. */
export const ProcessMasterPane = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { client } = useApiClient();
  const toast = useToast();
  /* 조회 상자 · 목록 | 상세 — 공정 경로 탭과 같은 분할 · 같은 배치(#231). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:routing:process-split', 0.45);
  const layout = useSplitOrientation(ROUTING_ORIENTATION_KEY);

  const filters = useMemo<ProcessFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
    }),
    [searchParams],
  );
  /* 공정 목록 쪽 — 주소가 소유한다(#231). */
  const paging = useMemo<ListPaging>(
    () => ({
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      size: TAB_PAGE_SIZES.find((size) => String(size) === searchParams.get('size')) ?? 20,
    }),
    [searchParams],
  );
  const isCreateMode = searchParams.get('mode') === 'create';
  const selectedId = isCreateMode ? null : Number(searchParams.get('sel') ?? '') || null;

  const list = useProcessList(filters, paging);
  const processes = list.data?.items ?? [];
  const detail = useProcessDetail(selectedId);
  const typeOptions = useProcessTypeOptions();

  const [formState, setFormState] = useState<ProcessFormState | null>(null);
  const formSource: ProcessFormState['source'] | null = isCreateMode
    ? 'create'
    : (detail.data ?? null);

  if (formSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== formSource) {
    const seeded =
      formSource === 'create' ? emptyProcessFormValues() : processToFormValues(formSource.process);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const values = formState?.values ?? emptyProcessFormValues();
  const isDirty = formState !== null && !isSameProcessValues(values, formState.baseline);
  const [localErrors, setLocalErrors] = useState<Partial<Record<keyof ProcessFormValues, string>>>(
    {},
  );

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  };

  const write = useMasterWrite<ProcessFormValues, Process>({
    request: (nextValues, headers) =>
      isCreateMode
        ? client.POST('/mdm/processes', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toProcessCreate(nextValues),
          })
        : client.PUT('/mdm/processes/{processId}', {
            params: {
              path: { processId: selectedId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': requireIfMatch(headers),
              },
            },
            body: toProcessUpdate(nextValues),
          }),
    etagPath: selectedId === null ? null : processDetailPath(selectedId),
    invalidateKeys: [processKeys.all],
    knownFields: PROCESS_FORM_FIELDS,
    onSuccess: (saved) => {
      setLocalErrors({});
      const seeded = processToFormValues(saved);
      setFormState((current) =>
        current === null ? current : { source: current.source, baseline: seeded, values: seeded },
      );
      if (isCreateMode) updateParams({ mode: null, sel: String(saved.processId) });
      toast.show({
        variant: 'success',
        description: isCreateMode ? messages.common.created : messages.common.saved,
      });
    },
  });

  const [activationIntent, setActivationIntent] = useState<ActivationIntent | null>(null);
  const activationWrite = useMasterWrite<ActivationIntent, Process>({
    request: (intent, headers) =>
      intent === 'deactivate'
        ? client.POST('/mdm/processes/{processId}:deactivate', {
            params: {
              path: { processId: selectedId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': requireIfMatch(headers),
              },
            },
          })
        : client.POST('/mdm/processes/{processId}:activate', {
            params: {
              path: { processId: selectedId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': requireIfMatch(headers),
              },
            },
          }),
    etagPath: selectedId === null ? null : processDetailPath(selectedId),
    invalidateKeys: [processKeys.all],
    knownFields: [],
    onSuccess: () => {
      setActivationIntent(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const applyFilters = (nextFilters: ProcessFilters) => {
    updateParams({
      q: nextFilters.q === '' ? null : nextFilters.q,
      inactive: nextFilters.includeInactive ? '1' : null,
      /* 조건이 바뀌면 첫 쪽부터 본다. */
      page: null,
      sel: null,
      mode: null,
    });
  };

  const changeValues = (patch: Partial<ProcessFormValues>) => {
    setFormState((current) =>
      current === null ? current : { ...current, values: { ...current.values, ...patch } },
    );
    for (const field of Object.keys(patch) as (keyof ProcessFormValues)[]) {
      write.clearFieldError(field);
      setLocalErrors((current) => {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const handleSave = () => {
    const errors = validateProcess(values);
    setLocalErrors(errors);
    if (Object.keys(errors).length === 0) write.write(values);
  };

  const reloadDetail = () => {
    write.reset();
    activationWrite.reset();
    setLocalErrors({});
    setFormState(null);
    void detail.refetch();
  };

  const columns: Column<Process>[] = [
    {
      key: 'processCode',
      header: t.fields.processCode,
      /* 코드는 본문 글자 — 줄 아무 곳이나 눌러 고른다. 단추는 키보드·화면 낭독기 길이자 고른 줄 표시 자리다(#231). */
      render: (process) => (
        <button
          type="button"
          className="inspection-standard-plan-open routing-process-open"
          aria-current={process.processId === selectedId ? 'true' : undefined}
          title={process.processCode}
          onClick={() => updateParams({ sel: String(process.processId), mode: null })}
        >
          {process.processCode}
        </button>
      ),
    },
    { key: 'processName', header: t.fields.processName },
    {
      key: 'processTypeCode',
      header: t.fields.processType,
      render: (process) =>
        typeOptions.data?.find((option) => option.value === process.processTypeCode)?.label ??
        process.processTypeCode,
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      render: (process) => (process.isActive ? t.values.active : t.values.inactive),
    },
  ];

  return (
    <>
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />

      {/* 조회 조건 — 목록과 다른 상자에 둔다. 「공정 추가」는 조회 · 초기화 뒤 구분선 너머에 선다(#231). */}
      <section
        ref={aboveRef}
        className="pane inspection-standard-search routing-search"
        role="search"
      >
        <ProcessFilterBar
          filters={filters}
          onApplyFilters={applyFilters}
          onAdd={() => {
            write.reset();
            setLocalErrors({});
            updateParams({ mode: 'create', sel: null });
          }}
        />
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-standard-split routing-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <ProcessListPane
          processes={processes}
          columns={columns}
          filters={filters}
          isLoading={list.isPending}
          loadError={
            list.isError ? (
              <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
            ) : null
          }
          pageMeta={list.data?.page ?? { ...paging, total: 0 }}
          onChangePage={(page) => updateParams({ page: page === 1 ? null : String(page) })}
          onChangePageSize={(size) =>
            updateParams({ page: null, size: size === 20 ? null : String(size) })
          }
        />

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <div className="inspection-standard-detail routing-detail">
          <section className="pane" aria-label={t.panes.processForm}>
            <h2 className="pane-title">{t.panes.processForm}</h2>
            <ProcessFormSlot
              isCreateMode={isCreateMode}
              selectedId={selectedId}
              detail={detail}
              formState={formState}
              values={values}
              fieldErrors={{ ...write.fieldErrors, ...localErrors }}
              typeOptions={typeOptions.data ?? []}
              typeOptionsError={typeOptions.isError}
              isDirty={isDirty}
              isSaving={write.isSaving}
              writeError={write.error}
              onChange={changeValues}
              onSave={handleSave}
              onCancel={() => {
                write.reset();
                setLocalErrors({});
                setFormState((current) =>
                  current === null ? current : { ...current, values: current.baseline },
                );
              }}
              onReload={reloadDetail}
              onActivate={(intent) => {
                activationWrite.reset();
                setActivationIntent(intent);
              }}
            />
          </section>
        </div>
      </div>

      <ProcessActivationDialog
        intent={activationIntent}
        referenceCount={detail.data?.editability.referenceCount ?? null}
        isSaving={activationWrite.isSaving}
        banner={<SaveErrorBanner error={activationWrite.error} onReload={reloadDetail} />}
        onClose={() => setActivationIntent(null)}
        onConfirm={() => {
          if (activationIntent !== null) activationWrite.write(activationIntent);
        }}
      />
    </>
  );
};

interface ProcessFilterBarProps {
  filters: ProcessFilters;
  onApplyFilters: (filters: ProcessFilters) => void;
  onAdd: () => void;
}

/** 공정 조회 조건 — 검색 · 미사용 포함 · 조회 · 초기화 | 공정 추가. */
const ProcessFilterBar = ({ filters, onApplyFilters, onAdd }: ProcessFilterBarProps) => {
  const { client } = useApiClient();
  const searchId = useId();
  const [draft, setDraft] = useState(filters.q);

  useEffect(() => setDraft(filters.q), [filters.q]);

  return (
    <div className="filter-bar routing-process-filter">
      {/*
       * 공정은 칸에서 바로 검색해서 고른다(다른 화면과 같다 · #226 · #231) — 고른 공정코드가 검색어로 들어간다.
       * 「전체」는 조건을 푼다. 조회를 눌러야 목록에 걸린다(종전 검색어와 같은 트리거 · 같은 서버 조건 `q`).
       */}
      <div className="field-cell search-select-cell">
        <label className="field-label" htmlFor={searchId}>
          {t.filters.processSearchLabel}
        </label>
        <PagedSelect
          id={searchId}
          queryKey={['routing-processes', 'process-select', filters.includeInactive]}
          fetchPage={async (q, page) => {
            const data = await runRequest(() =>
              client.GET('/mdm/processes', {
                params: {
                  query: {
                    ...(q === '' ? {} : { q }),
                    /* 목록과 같은 범위에서 찾는다 — 목록에 없는 공정을 고르지 않게. */
                    ...(filters.includeInactive ? { includeInactive: true } : {}),
                    page,
                    size: PROCESS_SEARCH_PAGE_SIZE,
                  },
                },
              }),
            );
            return {
              options: data.items.map((process) => ({
                value: process.processCode,
                label: `${process.processCode} · ${process.processName}`,
              })),
              total: data.page.total,
            };
          }}
          selectedOption={draft === '' ? null : { value: draft, label: draft }}
          leadingOptions={[{ value: '', label: t.filters.all }]}
          value={draft}
          placeholder={t.filters.all}
          onChange={setDraft}
        />
      </div>
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={filters.includeInactive}
          onChange={(event) =>
            onApplyFilters({ ...filters, includeInactive: event.target.checked })
          }
        >
          {messages.common.includeInactive}
        </Checkbox>
      </div>
      <div className="filter-actions field-cell-unlabeled">
        <Button onClick={() => onApplyFilters({ ...filters, q: draft })}>
          {messages.common.search}
        </Button>
        <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_FILTERS)}>
          {messages.common.reset}
        </Button>
        <span className="inspection-standard-filter-divider" aria-hidden />
        <Button onClick={onAdd}>{t.actions.addProcess}</Button>
      </div>
    </div>
  );
};

interface ProcessListPaneProps {
  processes: Process[];
  columns: Column<Process>[];
  filters: ProcessFilters;
  isLoading: boolean;
  loadError: ReactNode;
  /** 쪽 이동 줄 — 총 건수 · 건수 고르기 · 처음/이전/다음/마지막(#231). */
  pageMeta: PageNavMeta;
  onChangePage: (page: number) => void;
  onChangePageSize: (size: TabPageSize) => void;
}

const ProcessListPane = ({
  processes,
  columns,
  filters,
  isLoading,
  loadError,
  pageMeta,
  onChangePage,
  onChangePageSize,
}: ProcessListPaneProps) => {
  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다(표 공통 · #231). */
  const ordered = useColumnOrder('omf-mes:routing:process-columns:order', centerColumns(columns));
  const resizable = useColumnWidths('omf-mes:routing:process-columns', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  let listSlot: ReactNode;
  if (loadError !== null && loadError !== undefined) listSlot = loadError;
  else if (isLoading) {
    listSlot = (
      <div role="status" aria-label={t.loading.processes}>
        <SkeletonText lines={5} />
      </div>
    );
  } else {
    listSlot = (
      /* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 코드 단추로 넘긴다. */
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-plan-rows inspection-standard-table-box wide-table"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.routing-process-open')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={processes}
          getRowId={(process) => String(process.processId)}
          empty={
            <EmptyState
              size="sm"
              live
              title={
                filters.q !== '' || filters.includeInactive
                  ? t.empty.processNoMatchTitle
                  : t.empty.processNoneTitle
              }
              description={
                filters.q !== '' || filters.includeInactive
                  ? t.empty.processNoMatchDescription
                  : t.empty.processNoneDescription
              }
            />
          }
        />
      </div>
    );
  }

  return (
    <section
      className="pane inspection-standard-list-pane routing-process-list-pane"
      aria-label={t.panes.processList}
    >
      <h2 className="pane-title">{t.panes.processList}</h2>
      {listSlot}

      {(loadError === null || loadError === undefined) && !isLoading && (
        <PageNav
          meta={pageMeta}
          buttonSize="md"
          sizes={TAB_PAGE_SIZES}
          onChangePage={onChangePage}
          onChangeSize={onChangePageSize}
        />
      )}
    </section>
  );
};

interface ProcessFormSlotProps {
  isCreateMode: boolean;
  selectedId: number | null;
  detail: ReturnType<typeof useProcessDetail>;
  formState: ProcessFormState | null;
  values: ProcessFormValues;
  fieldErrors: Partial<Record<keyof ProcessFormValues, string>>;
  typeOptions: { value: string; label: string }[];
  typeOptionsError: boolean;
  isDirty: boolean;
  isSaving: boolean;
  writeError: ApiError | null;
  onChange: (patch: Partial<ProcessFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
  onActivate: (intent: ActivationIntent) => void;
}

const ProcessFormSlot = ({
  isCreateMode,
  selectedId,
  detail,
  formState,
  values,
  fieldErrors,
  typeOptions,
  typeOptionsError,
  isDirty,
  isSaving,
  writeError,
  onChange,
  onSave,
  onCancel,
  onReload,
  onActivate,
}: ProcessFormSlotProps): ReactNode => {
  const typeId = useId();
  const typeErrorId = `${typeId}-error`;

  if (!isCreateMode && selectedId === null) {
    return <EmptyState size="sm" title={t.empty.processNotSelected} />;
  }
  if (!isCreateMode && detail.isError) {
    return <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />;
  }
  if (formState === null) {
    return (
      <div role="status" aria-label={t.loading.processDetail}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  const process = detail.data?.process;
  const codeLockReason =
    !isCreateMode && detail.data !== undefined ? codeLockMessage(detail.data.editability) : null;
  const active = process?.isActive ?? true;

  return (
    <>
      {typeOptionsError && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      )}
      <SaveErrorBanner error={writeError} onReload={isCreateMode ? undefined : onReload} />
      <div className="form-grid routing-process-form">
        <TextField
          label={t.fields.processCode}
          value={values.processCode}
          onChange={(event) => onChange({ processCode: event.target.value })}
          disabled={codeLockReason !== null}
          disabledReason={codeLockReason}
          error={fieldErrors.processCode}
          /* 필수 칸 — 라벨 옆 빨간 *, 비어 있으면 빨간 테두리(사용자 지시 · #231). */
          required
          containerClassName={
            values.processCode.trim() === '' ? 'routing-required-empty' : undefined
          }
        />
        <TextField
          label={t.fields.processName}
          value={values.processName}
          onChange={(event) => onChange({ processName: event.target.value })}
          error={fieldErrors.processName}
          required
          containerClassName={
            values.processName.trim() === '' ? 'routing-required-empty' : undefined
          }
        />
        <div className="field-cell">
          <span className="field-label">
            <label htmlFor={typeId}>{t.fields.processType}</label>
            <span className="required-mark" aria-hidden="true">
              {' '}*
            </span>
          </span>
          <Select
            id={typeId}
            value={values.processTypeCode}
            options={typeOptions}
            onChange={(value) => onChange({ processTypeCode: value })}
            invalid={fieldErrors.processTypeCode !== undefined || values.processTypeCode === ''}
            aria-required
            aria-describedby={fieldErrors.processTypeCode === undefined ? undefined : typeErrorId}
          />
          {fieldErrors.processTypeCode !== undefined && (
            <span id={typeErrorId} className="field-error">
              {fieldErrors.processTypeCode}
            </span>
          )}
        </div>
        {!isCreateMode && (
          <div className="field-cell form-actions-secondary">
            <span className="field-label">{t.fields.isActive}</span>
            <p>{active ? t.values.active : t.values.inactive}</p>
            <Button
              variant="outlined"
              onClick={() => onActivate(active ? 'deactivate' : 'activate')}
            >
              {active ? messages.common.deactivate : t.actions.activateProcess}
            </Button>
          </div>
        )}
      </div>
      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>
        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {messages.common.save}
        </Button>
      </div>
    </>
  );
};

interface ProcessActivationDialogProps {
  intent: ActivationIntent | null;
  referenceCount: number | null;
  isSaving: boolean;
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

const ProcessActivationDialog = ({
  intent,
  referenceCount,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: ProcessActivationDialogProps) => {
  const isDeactivate = intent === 'deactivate';

  return (
    <Dialog
      open={intent !== null}
      onClose={onClose}
      size="sm"
      closeOnBackdropClick={false}
      title={isDeactivate ? t.dialog.deactivateProcessTitle : t.dialog.activateProcessTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
            {isDeactivate ? messages.common.deactivate : t.actions.activateProcess}
          </Button>
        </>
      }
    >
      {banner}
      <p>
        {isDeactivate ? t.dialog.deactivateProcessDescription : t.dialog.activateProcessDescription}
      </p>
      {isDeactivate && referenceCount !== null && (
        <p>{t.dialog.deactivateProcessReferences(referenceCount)}</p>
      )}
    </Dialog>
  );
};
