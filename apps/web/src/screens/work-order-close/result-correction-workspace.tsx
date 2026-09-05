import {
  AlertBanner,
  Button,
  Dialog,
  EmptyState,
  Select,
  SkeletonText,
  Table,
  TextArea,
  TextField,
  useToast,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { WORK_ORDER_CLOSE_CODE_GROUPS } from './code-options';
import {
  isProductionResultApprovalRequired,
  useProductionResultApprovalRequest,
  useProductionResultCorrection,
} from './result-correction-mutations';
import {
  CORRECTION_QUANTITY_FIELDS,
  createProductionResultCorrectionDraft,
  formatProductionResultAt,
  toProductionResultCorrect,
  type CorrectionQuantityField,
  type ProductionResultCorrectionDraft,
  type ProductionResultRow,
} from './result-correction-model';
import {
  useWorkOrderCloseCodeValues,
  useWorkOrderCloseProductionResults,
  useWorkOrderCloseWorkers,
} from './queries';

const t = messages.workOrderClose.correction;

const quantityLabels: Record<CorrectionQuantityField, string> = {
  goodQty: t.fields.goodQty,
  defectQty: t.fields.defectQty,
  holdQty: t.fields.holdQty,
  scrapQty: t.fields.scrapQty,
  reworkQty: t.fields.reworkQty,
};

interface CorrectionDialogProps {
  workOrderNo: string;
  result: ProductionResultRow;
  reasonOptions: { value: string; label: string }[];
  reasonUnavailable: boolean;
  draft: ProductionResultCorrectionDraft;
  localErrors: Partial<Record<keyof ProductionResultCorrectionDraft, string>>;
  serverErrors: Record<string, string>;
  isSaving: boolean;
  banner: ReactNode;
  onChange: (field: keyof ProductionResultCorrectionDraft, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const CorrectionDialog = ({
  workOrderNo,
  result,
  reasonOptions,
  reasonUnavailable,
  draft,
  localErrors,
  serverErrors,
  isSaving,
  banner,
  onChange,
  onClose,
  onSave,
}: CorrectionDialogProps) => {
  const reasonId = `production-result-${String(result.productionResultId)}-reason`;

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      closeOnBackdropClick={false}
      title={t.dialog.title(workOrderNo, result.resultSequence)}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button
            loading={isSaving}
            disabled={isSaving || reasonUnavailable || draft.reasonCode.trim() === ''}
            onClick={onSave}
          >
            {t.actions.save}
          </Button>
        </>
      }
    >
      {banner}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.dialog.serverGrade}</AlertBanner>
      </div>
      {reasonUnavailable && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.reasonUnavailable}</AlertBanner>
        </div>
      )}
      <div className="form-grid production-result-correction-grid">
        {CORRECTION_QUANTITY_FIELDS.map((field) => (
          <TextField
            key={field}
            label={`${quantityLabels[field]} (${String(result[field])})`}
            inputMode="decimal"
            value={draft[field]}
            error={localErrors[field] ?? serverErrors[field]}
            onChange={(event) => onChange(field, event.target.value)}
          />
        ))}
        <div className="field-cell wide-select production-result-correction-reason">
          <label className="field-label" htmlFor={reasonId}>
            {t.fields.reason}
          </label>
          <Select
            id={reasonId}
            value={draft.reasonCode === '' ? null : draft.reasonCode}
            options={reasonOptions}
            disabled={reasonUnavailable}
            onChange={(value) => onChange('reasonCode', value)}
          />
          {(localErrors.reasonCode ?? serverErrors.reasonCode) === undefined ? null : (
            <p className="field-error">{localErrors.reasonCode ?? serverErrors.reasonCode}</p>
          )}
        </div>
        <TextArea
          label={t.fields.note}
          rows={3}
          value={draft.note}
          error={localErrors.note ?? serverErrors.note}
          onChange={(event) => onChange('note', event.target.value)}
        />
      </div>
    </Dialog>
  );
};

interface ApprovalDialogProps {
  reason: string;
  error: string | undefined;
  isSaving: boolean;
  banner: ReactNode;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const ApprovalDialog = ({
  reason,
  error,
  isSaving,
  banner,
  onReasonChange,
  onClose,
  onSubmit,
}: ApprovalDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    title={t.approval.title}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {t.actions.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving || reason.trim() === ''} onClick={onSubmit}>
          {t.actions.requestApproval}
        </Button>
      </>
    }
  >
    {banner}
    <div className="banner-slot">
      <AlertBanner variant="warning">{t.approval.required}</AlertBanner>
    </div>
    <TextArea
      label={t.approval.reason}
      rows={4}
      value={reason}
      error={error}
      placeholder={t.approval.reasonHint}
      onChange={(event) => onReasonChange(event.target.value)}
    />
    <p className="field-note">{t.approval.reasonHint}</p>
  </Dialog>
);

interface CorrectionAttemptProps {
  workOrderId: number;
  workOrderNo: string;
  result: ProductionResultRow;
  reasonOptions: { value: string; label: string }[];
  reasonUnavailable: boolean;
  onDone: () => void;
  onCancel: () => void;
}

/** 쓰기 훅을 시도 단위로 소유한다. 승인 상신 뒤 unmount되어 다음 정정은 새 멱등 키로 시작한다. */
const CorrectionAttempt = ({
  workOrderId,
  workOrderNo,
  result,
  reasonOptions,
  reasonUnavailable,
  onDone,
  onCancel,
}: CorrectionAttemptProps) => {
  const toast = useToast();
  const [draft, setDraft] = useState(() => createProductionResultCorrectionDraft(result));
  const [localErrors, setLocalErrors] = useState<
    Partial<Record<keyof ProductionResultCorrectionDraft, string>>
  >({});
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalReasonError, setApprovalReasonError] = useState<string | undefined>();
  const correctWrite = useProductionResultCorrection(result.productionResultId, workOrderId, () => {
    toast.show({ variant: 'success', description: t.saved });
    onDone();
  });
  const approvalWrite = useProductionResultApprovalRequest(result.productionResultId, () => {
    toast.show({ variant: 'success', description: t.approval.submitted });
    onDone();
  });

  useEffect(() => {
    if (!isProductionResultApprovalRequired(correctWrite.error)) return;
    setApprovalReason(draft.note.trim());
    setApprovalReasonError(undefined);
    setApprovalOpen(true);
    correctWrite.reset();
  }, [correctWrite.error, correctWrite.reset, draft.note]);

  return (
    <>
      <CorrectionDialog
        workOrderNo={workOrderNo}
        result={result}
        reasonOptions={reasonOptions}
        reasonUnavailable={reasonUnavailable}
        draft={draft}
        localErrors={localErrors}
        serverErrors={correctWrite.fieldErrors}
        isSaving={correctWrite.isSaving}
        banner={<SaveErrorBanner error={correctWrite.error} />}
        onChange={(field, value) => {
          setDraft((current) => ({ ...current, [field]: value }));
          setLocalErrors((current) => ({ ...current, [field]: undefined }));
          correctWrite.clearFieldError(field);
        }}
        onClose={() => {
          if (correctWrite.isSaving) return;
          correctWrite.reset();
          onCancel();
        }}
        onSave={() => {
          const parsed = toProductionResultCorrect(result, draft);
          setLocalErrors(parsed.fieldErrors);
          if (parsed.body !== null) correctWrite.write(parsed.body);
        }}
      />
      {approvalOpen && (
        <ApprovalDialog
          reason={approvalReason}
          error={approvalReasonError ?? approvalWrite.fieldErrors.reason}
          isSaving={approvalWrite.isSaving}
          banner={<SaveErrorBanner error={approvalWrite.error} />}
          onReasonChange={(value) => {
            setApprovalReason(value);
            setApprovalReasonError(undefined);
            approvalWrite.clearFieldError('reason');
          }}
          onClose={() => {
            if (approvalWrite.isSaving) return;
            setApprovalOpen(false);
            approvalWrite.reset();
          }}
          onSubmit={() => {
            const reason = approvalReason.trim();
            if (reason === '') {
              setApprovalReasonError(t.approval.reasonRequired);
              return;
            }
            approvalWrite.write({ reason });
          }}
        />
      )}
    </>
  );
};

export interface WorkOrderResultCorrectionWorkspaceProps {
  workOrderId: number | null;
  workOrderNo: string;
}

export const WorkOrderResultCorrectionWorkspace = ({
  workOrderId,
  workOrderNo,
}: WorkOrderResultCorrectionWorkspaceProps) => {
  const results = useWorkOrderCloseProductionResults(workOrderId);
  const workers = useWorkOrderCloseWorkers();
  const reasons = useWorkOrderCloseCodeValues(WORK_ORDER_CLOSE_CODE_GROUPS.correctionReason);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const rows = results.data?.items ?? [];
  const selected = rows.find((row) => row.productionResultId === selectedId) ?? null;

  useEffect(() => {
    setSelectedId(null);
    setEditing(false);
  }, [workOrderId]);

  useEffect(() => {
    if (selectedId !== null && !rows.some((row) => row.productionResultId === selectedId)) {
      setSelectedId(null);
      setEditing(false);
    }
  }, [rows, selectedId]);

  const reasonOptions = useMemo(
    () =>
      (reasons.data?.items ?? [])
        .filter((reason) => reason.isActive)
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((reason) => ({
          value: reason.code,
          label: reason.codeName.trim() === '' ? reason.code : reason.codeName,
        })),
    [reasons.data],
  );
  const reasonUnavailable =
    reasons.isPending ||
    reasons.isError ||
    reasons.data?.truncated === true ||
    reasonOptions.length === 0;
  const workerName = (workerId: number): string =>
    workers.data?.items.find((worker) => worker.workerId === workerId)?.workerName ??
    t.values.unknownWorker;
  const relation = (row: ProductionResultRow): string => {
    if (row.correctsProductionResultId === null) return t.values.original;
    const original = rows.find(
      (candidate) => candidate.productionResultId === row.correctsProductionResultId,
    );
    return t.values.correctionOf(original?.resultSequence ?? null);
  };
  const columns: Column<ProductionResultRow>[] = [
    {
      key: 'resultSequence',
      header: t.fields.sequence,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.select(row.resultSequence)}
          aria-current={selectedId === row.productionResultId ? true : undefined}
          onClick={() => setSelectedId(row.productionResultId)}
        >
          {row.resultSequence}
        </button>
      ),
    },
    {
      key: 'occurredAt',
      header: t.fields.occurredAt,
      render: (row) => formatProductionResultAt(row.occurredAt),
    },
    { key: 'goodQty', header: t.fields.goodQty, align: 'end' },
    { key: 'defectQty', header: t.fields.defectQty, align: 'end' },
    { key: 'holdQty', header: t.fields.holdQty, align: 'end' },
    { key: 'scrapQty', header: t.fields.scrapQty, align: 'end' },
    { key: 'reworkQty', header: t.fields.reworkQty, align: 'end' },
    { key: 'workerId', header: t.fields.worker, render: (row) => workerName(row.workerId) },
    { key: 'correctsProductionResultId', header: t.fields.relation, render: relation },
  ];

  if (workOrderId === null) {
    return (
      <section className="pane work-order-close-result-pane" aria-label={t.pane}>
        <EmptyState size="sm" title={t.selection.title} description={t.selection.description} />
      </section>
    );
  }

  return (
    <section className="pane work-order-close-result-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.heading(workOrderNo)}</h2>
      {results.isPending ? (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      ) : results.isError ? (
        <AlertBanner
          variant="error"
          title={t.loadFailed}
          action={<Button onClick={() => void results.refetch()}>{messages.common.retry}</Button>}
        />
      ) : results.data?.truncated === true ? (
        <AlertBanner variant="warning">{t.truncated}</AlertBanner>
      ) : (
        <>
          {(workers.isError || workers.data?.truncated === true) && (
            <AlertBanner variant="warning">{t.workersUnavailable}</AlertBanner>
          )}
          <div className="wide-table work-order-close-table production-result-correction-table">
            <Table
              density="compact"
              caption={
                <span className="work-order-close-table-caption">{t.heading(workOrderNo)}</span>
              }
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.productionResultId)}
              sort={null}
              empty={
                <EmptyState size="sm" title={t.empty.title} description={t.empty.description} />
              }
            />
          </div>
          <AlertBanner variant="info">{t.immutable}</AlertBanner>
          <div className="work-order-close-actions">
            <Button
              disabled={selected === null}
              onClick={() => {
                if (selected === null) return;
                setEditing(true);
              }}
            >
              {t.actions.correct}
            </Button>
          </div>
        </>
      )}
      {editing && selected !== null && workOrderId !== null && (
        <CorrectionAttempt
          key={selected.productionResultId}
          workOrderId={workOrderId}
          workOrderNo={workOrderNo}
          result={selected}
          reasonOptions={reasonOptions}
          reasonUnavailable={reasonUnavailable}
          onDone={() => {
            setEditing(false);
            setSelectedId(null);
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
      )}
    </section>
  );
};
