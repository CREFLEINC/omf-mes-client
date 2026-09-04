import {
  AlertBanner,
  Button,
  Checkbox,
  type Column,
  Dialog,
  EmptyState,
  SearchInput,
  Select,
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
import {
  SaveErrorBanner,
  codeLockMessage,
  requireIfMatch,
  useMasterWrite,
} from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import {
  emptyProcessFormValues,
  isSameProcessValues,
  processToFormValues,
  toProcessCreate,
  toProcessUpdate,
} from './process-master';
import { PROCESS_FORM_FIELDS, validateProcess } from './process-validation';
import {
  isTruncated,
  processDetailPath,
  processKeys,
  useProcessDetail,
  useProcessList,
  useProcessTypeOptions,
} from './queries';
import type { Process, ProcessDetailResponse, ProcessFilters, ProcessFormValues } from './types';

const t = messages.routing;

const DEFAULT_FILTERS: ProcessFilters = { q: '', includeInactive: false };

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

  const filters = useMemo<ProcessFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
    }),
    [searchParams],
  );
  const isCreateMode = searchParams.get('mode') === 'create';
  const selectedId = isCreateMode ? null : Number(searchParams.get('sel') ?? '') || null;

  const list = useProcessList(filters);
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
      render: (process) => (
        <button
          type="button"
          className="link-cell"
          aria-current={process.processId === selectedId ? 'true' : undefined}
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
      render: (process) => (process.isActive ? '사용' : '미사용'),
    },
  ];

  const page = list.data?.page;
  const truncated = page !== undefined && isTruncated(page, processes.length);

  return (
    <>
      {truncated && page !== undefined && (
        <div className="banner-slot">
          <AlertBanner variant="warning">
            {t.listTruncated(processes.length, page.total)}
          </AlertBanner>
        </div>
      )}

      <div className="two-pane routing-process-layout">
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
          onApplyFilters={applyFilters}
          onAdd={() => {
            write.reset();
            setLocalErrors({});
            updateParams({ mode: 'create', sel: null });
          }}
        />

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

interface ProcessListPaneProps {
  processes: Process[];
  columns: Column<Process>[];
  filters: ProcessFilters;
  isLoading: boolean;
  loadError: ReactNode;
  onApplyFilters: (filters: ProcessFilters) => void;
  onAdd: () => void;
}

const ProcessListPane = ({
  processes,
  columns,
  filters,
  isLoading,
  loadError,
  onApplyFilters,
  onAdd,
}: ProcessListPaneProps) => {
  const [draft, setDraft] = useState(filters.q);

  useEffect(() => setDraft(filters.q), [filters.q]);

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
      <Table
        density="compact"
        columns={columns}
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
    );
  }

  return (
    <section className="pane" aria-label={t.panes.processList}>
      <div className="pane-heading-row">
        <h2 className="pane-title">{t.panes.processList}</h2>
        <Button onClick={onAdd}>{t.actions.addProcess}</Button>
      </div>
      <div className="filter-bar routing-process-filter">
        <SearchInput
          label={t.filters.processSearchLabel}
          placeholder={t.filters.processSearchPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onSearch={(value) => onApplyFilters({ ...filters, q: value })}
        />
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
        </div>
      </div>
      {listSlot}
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
        />
        <TextField
          label={t.fields.processName}
          value={values.processName}
          onChange={(event) => onChange({ processName: event.target.value })}
          error={fieldErrors.processName}
        />
        <div className="field-cell">
          <span className="field-label">
            <label htmlFor={typeId}>{t.fields.processType}</label>
          </span>
          <Select
            id={typeId}
            value={values.processTypeCode}
            options={typeOptions}
            onChange={(value) => onChange({ processTypeCode: value })}
            invalid={fieldErrors.processTypeCode !== undefined}
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
            <p>{active ? '사용' : '미사용'}</p>
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
