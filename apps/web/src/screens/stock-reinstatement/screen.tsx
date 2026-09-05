import {
  AlertBanner,
  Breadcrumb,
  Button,
  Checkbox,
  Chip,
  EmptyState,
  PageHeader,
  Progress,
  Select,
  SkeletonText,
  Stepper,
  Table,
  TextField,
  useToast,
  type Column,
  type StepperItem,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { ConfirmDialog, type ReinstatementSummary } from './confirm-dialog';
import {
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  validateDraft,
  type DraftErrors,
  type ReinstatementDraft,
} from './form';
import {
  useCandidates,
  useDecision,
  useLocations,
  useLookups,
  useLotDetail,
  useLotStatus,
  useNonconformance,
  useOpenHolds,
  useReinstate,
  type CandidateQuery,
} from './queries';
import {
  displayItem,
  remainingDays,
  remainingDecisionQty,
  type DecisionView,
  type SelectOption,
} from './types';

const t = messages.stockReinstatement;
const PAGE_SIZE = 50;

const conflictMessage = (error: ApiError | null): string | null => {
  if (error === null || error.kind !== 'http' || error.status !== 409) return null;
  switch (error.code) {
    case 'ALREADY_REINSTATED':
      return t.conflict.already;
    case 'HOLD_ALREADY_RELEASED':
      return t.conflict.released;
    case 'DISPOSITION_NOT_REINSTATABLE':
      return t.conflict.notEligible;
    case 'VERSION_CONFLICT':
      return t.conflict.version;
    default:
      return null;
  }
};

const ReinstatementErrorBanner = ({ error }: { error: ApiError | null }) => {
  const message = conflictMessage(error);
  return message === null ? (
    <SaveErrorBanner error={error} />
  ) : (
    <div className="banner-slot">
      <AlertBanner variant="error">{message}</AlertBanner>
    </div>
  );
};

const positiveInteger = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
};

const warehouseLabel = (code: string, name: string): string => `${code} · ${name}`;
const formatDateTime = (value: string): string => value.replace('T', ' ').slice(0, 16);

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  error?: string;
  note?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const SelectField = ({
  label,
  value,
  options,
  error,
  note,
  disabled,
  onChange,
}: SelectFieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;
  const noteId = `${id}-note`;
  const hasEmptyOption = options.some((option) => option.value === '');
  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        value={value === '' && !hasEmptyOption ? null : value}
        options={options}
        placeholder={t.form.selectPlaceholder}
        invalid={error !== undefined}
        disabled={disabled}
        aria-describedby={
          [error === undefined ? null : errorId, note === undefined ? null : noteId]
            .filter(Boolean)
            .join(' ') || undefined
        }
        onChange={onChange}
      />
      {error !== undefined && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
      {note !== undefined && (
        <span id={noteId} className="field-note">
          {note}
        </span>
      )}
    </div>
  );
};

export const StockReinstatementScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = positiveInteger(searchParams.get('page')) ?? 1;
  const warehouseId = positiveInteger(searchParams.get('warehouse'));
  const selectedId = positiveInteger(searchParams.get('decision'));
  const query = useMemo<CandidateQuery>(
    () => ({
      ...(warehouseId === null ? {} : { warehouseId }),
      reinstatable: true,
      followUpPending: true,
      ...(page === 1 ? {} : { page }),
      size: PAGE_SIZE,
    }),
    [page, warehouseId],
  );

  const candidates = useCandidates(query);
  const lookups = useLookups();
  const selectedFromList =
    candidates.data?.items.find((item) => item.dispositionDecisionId === selectedId) ?? null;
  const decision = useDecision(selectedId);
  const selected = decision.data ?? selectedFromList;
  const lotId = selected?.lotId ?? null;
  const rawDecision = decision.data;
  const nonconformance = useNonconformance(selected?.nonconformanceId ?? null);
  const resolvedItemId = selected?.itemId ?? nonconformance.data?.itemId ?? null;
  const lot = useLotDetail(lotId);
  const lotStatus = useLotStatus(lotId, resolvedItemId, selected?.lotNo ?? null);
  const holds = useOpenHolds(lotId);

  const [draft, setDraft] = useState<ReinstatementDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();
  const selectedWarehouse = lookups.data?.warehouses.find(
    (warehouse) => String(warehouse.warehouseId) === draft.toWarehouseId,
  );
  const locationRequired =
    selectedWarehouse !== undefined && selectedWarehouse.managementLevelCode !== 'WAREHOUSE';
  const locations = useLocations(locationRequired ? selectedWarehouse.warehouseId : null);
  const maxQty =
    lotStatus.data?.onHandQty ??
    (selected === null || selected === undefined ? null : remainingDecisionQty(selected));
  const onlyHold = holds.data?.length === 1 ? holds.data[0] : undefined;
  const relatedReadError =
    lookups.isError ||
    decision.isError ||
    nonconformance.isError ||
    lot.isError ||
    lotStatus.isError ||
    holds.isError ||
    locations.isError;

  useEffect(() => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setConfirming(false);
  }, [selectedId]);
  useEffect(() => {
    if (onlyHold !== undefined) {
      setDraft((current) =>
        current.lotHoldId === '' ? { ...current, lotHoldId: String(onlyHold.lotHoldId) } : current,
      );
    }
  }, [onlyHold]);
  useEffect(() => {
    if (maxQty !== null && draft.qty === '')
      setDraft((current) => ({ ...current, qty: String(maxQty) }));
  }, [draft.qty, maxQty]);

  const reinstate = useReinstate((result) => {
    setConfirming(false);
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('decision');
      return next;
    });
    toast.show({ variant: 'success', description: t.success(result.reinstatedQty) });
  });

  useEffect(() => {
    const error = reinstate.error;
    if (error === null) return;
    if (error.kind === 'conflict' || (error.kind === 'http' && error.status === 409)) {
      void candidates.refetch();
      void decision.refetch();
      void lotStatus.refetch();
      void holds.refetch();
    }
  }, [reinstate.error]);

  const setFilters = (nextWarehouseId: string, nextPage = 1): void => {
    const next = new URLSearchParams();
    if (nextWarehouseId !== '') next.set('warehouse', nextWarehouseId);
    if (nextPage > 1) next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const selectDecision = (row: DecisionView): void => {
    if (row.lotId === null) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('decision', String(row.dispositionDecisionId));
      return next;
    });
  };

  const requestConfirm = (): void => {
    const nextErrors = validateDraft({
      draft,
      maxQty,
      locationRequired,
      releaseReasonsReady: (lookups.data?.releaseReasons.length ?? 0) > 0,
      text: t.form,
    });
    setErrors(nextErrors);
    if (!hasErrors(nextErrors)) setConfirming(true);
  };

  const confirm = (): void => {
    if (
      selected === null ||
      selected === undefined ||
      lotId === null ||
      lotStatus.data === null ||
      lotStatus.data === undefined
    )
      return;
    reinstate.write(
      toCreateBody({
        draft,
        dispositionDecisionId: selected.dispositionDecisionId,
        lotId,
        versionNo: lotStatus.data.versionNo,
        uomId: lotStatus.data.uomId ?? selected.uomId,
        now: new Date(),
      }),
    );
  };

  const uom =
    lookups.data?.uoms.find(
      (option) => option.value === String(lotStatus.data?.uomId ?? selected?.uomId),
    )?.label ?? '';
  const currentWarehouse = lookups.data?.warehouses.find(
    (warehouse) => warehouse.warehouseId === lotStatus.data?.warehouseId,
  );
  const targetWarehouses = (lookups.data?.warehouses ?? [])
    .filter(
      (warehouse) =>
        warehouse.isActive && !warehouse.isDefect && warehouse.warehouseTypeCode === 'PRODUCT',
    )
    .map((warehouse) => ({
      value: String(warehouse.warehouseId),
      label: warehouseLabel(warehouse.warehouseCode, warehouse.warehouseName),
    }));
  const defectWarehouses = (lookups.data?.warehouses ?? [])
    .filter((warehouse) => warehouse.isActive && warehouse.isDefect)
    .map((warehouse) => ({
      value: String(warehouse.warehouseId),
      label: warehouseLabel(warehouse.warehouseCode, warehouse.warehouseName),
    }));
  const locationOptions = (locations.data ?? [])
    .filter((location) => location.isActive)
    .map((location) => ({
      value: String(location.locationId),
      label: `${location.locationCode} · ${location.locationName}`,
    }));
  const holdOptions = (holds.data ?? []).map((hold) => ({
    value: String(hold.lotHoldId),
    label: `${hold.reasonCode} · ${formatDateTime(hold.heldAt)}`,
  }));

  const days = remainingDays(lot.data?.lot.expiryDate ?? null, new Date());
  const historySteps: StepperItem[] = [
    ...(nonconformance.data === undefined
      ? []
      : [
          {
            label: t.history.opened,
            status: 'complete' as const,
            description: `${formatDateTime(nonconformance.data.openedAt)} · ${nonconformance.data.description}`,
          },
        ]),
    ...(holds.data ?? []).map((hold) => ({
      label: t.history.held,
      status: 'complete' as const,
      description: `${formatDateTime(hold.heldAt)} · ${hold.reasonCode}`,
    })),
    ...(rawDecision === undefined
      ? []
      : [
          {
            label: t.history.decided,
            status: 'complete' as const,
            description: `${formatDateTime(rawDecision.decidedAt)} · ${rawDecision.reason}`,
          },
        ]),
  ].sort((left, right) => String(left.description).localeCompare(String(right.description)));

  const columns: Column<DecisionView>[] = [
    {
      key: 'lot',
      header: t.fields.lot,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.selectRow(row.lotNo)}
          aria-current={row.dispositionDecisionId === selectedId ? 'true' : undefined}
          disabled={row.lotId === null}
          onClick={() => selectDecision(row)}
        >
          {row.lotNo}
        </button>
      ),
    },
    { key: 'item', header: t.fields.item, render: displayItem },
    {
      key: 'qty',
      header: t.fields.qty,
      align: 'end',
      render: (row) => String(remainingDecisionQty(row)),
    },
    {
      key: 'type',
      header: t.fields.disposition,
      render: (row) => (
        <Chip variant="status" status="success" size="sm">
          {row.dispositionTypeCode === 'NORMAL' ? t.values.normal : t.values.rework}
        </Chip>
      ),
    },
    {
      key: 'decidedAt',
      header: t.fields.decidedAt,
      render: (row) => formatDateTime(row.decidedAt),
    },
  ];
  const total = candidates.data?.page.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, start + (candidates.data?.items.length ?? 0) - 1);

  const summary: ReinstatementSummary = {
    lotNo: selected?.lotNo ?? t.values.empty,
    qty: Number(draft.qty),
    uom,
    fromWarehouse:
      currentWarehouse === undefined
        ? t.values.empty
        : warehouseLabel(currentWarehouse.warehouseCode, currentWarehouse.warehouseName),
    toWarehouse:
      selectedWarehouse === undefined
        ? t.values.empty
        : warehouseLabel(selectedWarehouse.warehouseCode, selectedWarehouse.warehouseName),
    toLocation:
      locations.data?.find((location) => String(location.locationId) === draft.toLocationId)
        ?.locationName ?? null,
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      <div className="banner-slot">
        <AlertBanner variant="info">{t.scopeNotice}</AlertBanner>
      </div>
      <div className="stock-reinstatement-workspace">
        <section className="pane stock-reinstatement-pane" aria-label={t.panes.candidates}>
          <h2 className="pane-title">{t.panes.candidates}</h2>
          <div className="stock-reinstatement-filter">
            <SelectField
              label={t.fields.sourceWarehouse}
              value={warehouseId === null ? '' : String(warehouseId)}
              options={[{ value: '', label: t.filters.allWarehouses }, ...defectWarehouses]}
              note={lookups.isError ? t.filters.noWarehouse : undefined}
              onChange={(value) => setFilters(value)}
            />
            <Checkbox checked disabled>
              {t.fields.completedOnly}
            </Checkbox>
          </div>
          {candidates.isPending ? (
            <div role="status" aria-label={t.accessibility.candidateLoading}>
              <SkeletonText lines={4} />
            </div>
          ) : candidates.isError ? (
            <AlertBanner variant="error">{messages.httpError.description}</AlertBanner>
          ) : (
            <div className="stock-reinstatement-table">
              <Table
                density="compact"
                caption={t.panes.candidates}
                columns={columns}
                rows={candidates.data?.items ?? []}
                getRowId={(row) => String(row.dispositionDecisionId)}
                empty={
                  <EmptyState size="sm" title={t.empty.title} description={t.empty.description} />
                }
              />
            </div>
          )}
          {!candidates.isPending && !candidates.isError && (
            <nav className="form-actions" aria-label={t.accessibility.pagination}>
              <p className="field-note form-actions-secondary">
                {t.values.page(start, end, total)}
              </p>
              <Button
                size="sm"
                variant="outlined"
                disabled={page <= 1}
                onClick={() =>
                  setFilters(warehouseId === null ? '' : String(warehouseId), page - 1)
                }
              >
                {t.actions.prevPage}
              </Button>
              <Button
                size="sm"
                variant="outlined"
                disabled={end >= total}
                onClick={() =>
                  setFilters(warehouseId === null ? '' : String(warehouseId), page + 1)
                }
              >
                {t.actions.nextPage}
              </Button>
            </nav>
          )}
        </section>

        <section className="pane stock-reinstatement-pane" aria-label={t.panes.detail}>
          <h2 className="pane-title">{t.panes.detail}</h2>
          {selectedId !== null && decision.isPending && selectedFromList === null ? (
            <div role="status" aria-label={t.empty.selectionLoading}>
              <SkeletonText lines={5} />
            </div>
          ) : selectedId !== null && decision.isError && selectedFromList === null ? (
            <AlertBanner variant="error">{t.empty.selectionLoadError}</AlertBanner>
          ) : selected === null || selected === undefined ? (
            <EmptyState
              size="sm"
              title={t.empty.selectionTitle}
              description={t.empty.selectionDescription}
            />
          ) : (
            <>
              {relatedReadError && (
                <AlertBanner variant="error">{t.empty.relatedLoadError}</AlertBanner>
              )}
              <dl className="stock-reinstatement-summary">
                <div>
                  <dt>{t.fields.lot}</dt>
                  <dd>{selected.lotNo}</dd>
                </div>
                <div>
                  <dt>{t.fields.item}</dt>
                  <dd>{displayItem(selected)}</dd>
                </div>
                <div>
                  <dt>{t.fields.qty}</dt>
                  <dd>
                    {String(maxQty ?? remainingDecisionQty(selected))} {uom}
                  </dd>
                </div>
                <div>
                  <dt>{t.fields.sourceWarehouse}</dt>
                  <dd>
                    {currentWarehouse === undefined
                      ? t.values.empty
                      : warehouseLabel(
                          currentWarehouse.warehouseCode,
                          currentWarehouse.warehouseName,
                        )}
                  </dd>
                </div>
                <div>
                  <dt>{t.fields.expiry}</dt>
                  <dd>
                    {lot.data?.lot.expiryDate ?? t.values.noExpiry}
                    {days === null
                      ? ''
                      : ` · ${days >= 0 ? t.values.remainingDays(days) : t.values.expiredDays(Math.abs(days))}`}
                  </dd>
                </div>
              </dl>
              {days !== null && (
                <Progress
                  min={0}
                  max={365}
                  value={Math.max(0, Math.min(365, days))}
                  thresholds={[
                    { upTo: 30, tone: 'error' },
                    { upTo: 180, tone: 'warning' },
                  ]}
                  tone="success"
                  size="sm"
                  label={t.fields.expiry}
                  valueText={
                    days >= 0 ? t.values.remainingDays(days) : t.values.expiredDays(Math.abs(days))
                  }
                />
              )}
              <div className="stock-reinstatement-section">
                <h3>{t.panes.history}</h3>
                {historySteps.length === 0 ? (
                  <p className="field-note">{t.history.noSource}</p>
                ) : (
                  <Stepper orientation="vertical" size="sm" steps={historySteps} />
                )}
              </div>
              <div className="stock-reinstatement-section">
                <h3>{t.panes.form}</h3>
                <div className="form-grid stock-reinstatement-form">
                  <SelectField
                    label={t.fields.targetWarehouse}
                    value={draft.toWarehouseId}
                    options={targetWarehouses}
                    error={errors.toWarehouseId ?? reinstate.fieldErrors.toWarehouseId}
                    onChange={(value) => {
                      setDraft((current) => ({
                        ...current,
                        toWarehouseId: value,
                        toLocationId: '',
                      }));
                      setErrors((current) => ({
                        ...current,
                        toWarehouseId: undefined,
                        toLocationId: undefined,
                      }));
                      reinstate.reset();
                    }}
                  />
                  <SelectField
                    label={t.fields.targetLocation}
                    value={draft.toLocationId}
                    options={locationOptions}
                    disabled={!locationRequired}
                    note={
                      locationRequired && !locations.isPending && locationOptions.length === 0
                        ? t.form.noLocations
                        : selectedWarehouse !== undefined && !locationRequired
                          ? t.form.warehouseOnly
                          : undefined
                    }
                    error={errors.toLocationId ?? reinstate.fieldErrors.toLocationId}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, toLocationId: value }))
                    }
                  />
                  <SelectField
                    label={t.fields.hold}
                    value={draft.lotHoldId}
                    options={holdOptions}
                    error={errors.lotHoldId ?? reinstate.fieldErrors.lotHoldId}
                    onChange={(value) => setDraft((current) => ({ ...current, lotHoldId: value }))}
                  />
                  <div className="field-cell">
                    <TextField
                      label={t.fields.qty}
                      type="number"
                      min={1}
                      max={maxQty ?? undefined}
                      value={draft.qty}
                      error={errors.qty ?? reinstate.fieldErrors.qty}
                      helperText={maxQty === null ? t.values.empty : t.values.holdingQty(maxQty)}
                      fullWidth
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, qty: event.target.value }))
                      }
                    />
                  </div>
                  <SelectField
                    label={t.fields.releaseReason}
                    value={draft.releaseReasonCode}
                    options={lookups.data?.releaseReasons ?? []}
                    note={lookups.isPending ? t.form.releaseReasonUnavailable : undefined}
                    error={errors.releaseReasonCode ?? reinstate.fieldErrors.releaseReasonCode}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, releaseReasonCode: value }))
                    }
                  />
                  <SelectField
                    label={t.fields.reason}
                    value={draft.reasonCode}
                    options={lookups.data?.reinstatementReasons ?? []}
                    note={
                      !lookups.isPending && (lookups.data?.reinstatementReasons.length ?? 0) === 0
                        ? t.form.optionalReasonEmpty
                        : undefined
                    }
                    onChange={(value) => setDraft((current) => ({ ...current, reasonCode: value }))}
                  />
                  <div className="field-cell stock-reinstatement-remarks">
                    <TextField
                      label={t.fields.remarks}
                      value={draft.remarks}
                      fullWidth
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, remarks: event.target.value }))
                      }
                    />
                  </div>
                </div>
                {maxQty !== null && Number(draft.qty) > 0 && (
                  <p className="field-note">
                    {Number(draft.qty) < maxQty
                      ? t.values.partial(maxQty - Number(draft.qty))
                      : t.values.full}
                  </p>
                )}
                {days !== null && days < 180 && (
                  <AlertBanner variant="warning">{t.warning.shelfLife(days)}</AlertBanner>
                )}
                <AlertBanner variant="warning" title={t.warning.title}>
                  <p>{t.warning.transition}</p>
                  <p>{t.warning.stock(Number(draft.qty) || 0)}</p>
                  <p>{t.warning.noUndo}</p>
                </AlertBanner>
                <div className="form-actions">
                  <Button
                    disabled={
                      lotStatus.data === null ||
                      lotStatus.data === undefined ||
                      relatedReadError ||
                      reinstate.isSaving
                    }
                    onClick={requestConfirm}
                  >
                    {t.actions.confirm}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={confirming}
        summary={summary}
        isSaving={reinstate.isSaving}
        error={<ReinstatementErrorBanner error={reinstate.error} />}
        onConfirm={confirm}
        onClose={() => {
          if (!reinstate.isSaving) setConfirming(false);
        }}
      />
    </>
  );
};
