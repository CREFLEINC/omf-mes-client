import {
  AlertBanner,
  Button,
  Dialog,
  Radio,
  RadioGroup,
  Select,
  TextArea,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import {
  isKnownReason,
  LOT_HOLD_REASON_GROUP,
  useLotHoldReasonOptions,
  type ReasonOptions,
} from './code-options';
import { isTransitionStale, transitionStaleMessage } from './transition-error';

type LotHold = components['schemas']['LotHold'];
type LotHoldCreate = components['schemas']['LotHoldCreate'];
type TransitionImpact = NonNullable<components['schemas']['LotStatusTransition']['impact']>;
const t = messages.lotStatusTransition.create;
const tReason = messages.lotStatusTransition.reason;
const ROOT_KEY = ['lot-status-transition'] as const;
const HISTORY_KEY = ['lot-status-history'] as const;

interface Draft {
  mode: 'FULL' | 'PARTIAL';
  holdQty: string;
  reasonCode: string;
  remarks: string;
}

interface Validation {
  body: LotHoldCreate | null;
  quantityError?: string;
  reasonError?: string;
}

/**
 * 보류 사유는 공통코드 선택지다(스펙 §5-4 · G-31) — 목록이 서지 않으면 그 사유로 잠그고, 선택지에
 * 없는 값은 보내지 않는다(fail-closed). 자유 입력으로 물러나지 않는다.
 */
const validate = (
  draft: Draft,
  props: CreateHoldExecutionProps,
  reasons: ReasonOptions,
): Validation => {
  const text = draft.holdQty.trim();
  const quantity = Number(text);
  const quantityError =
    draft.mode === 'FULL'
      ? undefined
      : text === '' || !Number.isFinite(quantity) || quantity <= 0
        ? t.quantityPositive
        : props.maxHoldQty === undefined || !Number.isFinite(props.maxHoldQty)
          ? t.quantityUnknown
          : quantity > props.maxHoldQty
            ? t.quantityMax(String(props.maxHoldQty))
            : undefined;
  const reasonCode = draft.reasonCode.trim();
  const reasonError =
    reasons.unavailableReason ??
    (reasonCode === ''
      ? tReason.required
      : isKnownReason(reasons.options, reasonCode)
        ? undefined
        : tReason.unknown);
  const remarks = draft.remarks.trim();
  return {
    quantityError,
    reasonError,
    body:
      quantityError === undefined && reasonError === undefined
        ? {
            lots: [{ lotId: props.lotId, versionNo: props.versionNo }],
            ...(draft.mode === 'PARTIAL' ? { holdQty: quantity } : {}),
            reasonCode,
            targetLotStatusCode: props.targetLotStatusCode,
            ...(remarks === '' ? {} : { remarks }),
          }
        : null,
  };
};

export interface CreateHoldExecutionProps {
  lotId: number;
  lotNo: string;
  versionNo: number;
  maxHoldQty: number | undefined;
  warehouseId: number | undefined;
  locationId: number | undefined;
  targetLotStatusCode: string;
  impact: TransitionImpact | null | undefined;
  statusLabel: (code: string) => string;
  onCreated: () => void;
  onConfirmationChange: (pinned: boolean) => void;
  onStale: () => void;
}

export const CreateHoldExecution = (props: CreateHoldExecutionProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({
    mode: 'FULL',
    holdQty: '',
    reasonCode: '',
    remarks: '',
  });
  const [confirmation, setConfirmation] = useState<LotHoldCreate | null>(null);
  const reasons = useLotHoldReasonOptions(LOT_HOLD_REASON_GROUP);
  const reasonId = useId();
  const reasonNoteId = `${reasonId}-note`;
  const validation = validate(draft, props, reasons);
  const write = useMasterWrite<LotHoldCreate, LotHold[]>({
    request: (body, headers) =>
      client.POST('/quality/lot-holds', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [ROOT_KEY, HISTORY_KEY],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setConfirmation(null);
      props.onConfirmationChange(false);
      toast.show({ variant: 'success', description: t.success });
      props.onCreated();
    },
  });
  const stale = isTransitionStale(write.error);
  const closeDialog = (): void => {
    setConfirmation(null);
    props.onConfirmationChange(false);
    write.reset();
  };
  const reload = (): void => {
    closeDialog();
    props.onStale();
    void queryClient.invalidateQueries({ queryKey: ROOT_KEY });
  };
  const location = t.impact.location(
    props.warehouseId === undefined ? t.impact.unknown : String(props.warehouseId),
    props.locationId === undefined ? t.impact.unknown : String(props.locationId),
  );

  return (
    <section className="lot-status-transition-execution" aria-label={t.pane}>
      <RadioGroup
        name={`create-hold-mode-${String(props.lotId)}`}
        orientation="horizontal"
        value={draft.mode}
        disabled={write.isSaving}
        aria-label={t.scope}
        onChange={(value) => {
          setDraft({
            mode: value === 'PARTIAL' ? 'PARTIAL' : 'FULL',
            holdQty: '',
            reasonCode: '',
            remarks: '',
          });
          setConfirmation(null);
          write.reset();
        }}
      >
        <Radio value="FULL">{t.full}</Radio>
        <Radio value="PARTIAL">{t.partial}</Radio>
      </RadioGroup>
      <div className="form-grid lot-status-transition-execution-form">
        {draft.mode === 'PARTIAL' && (
          <TextField
            label={t.quantity}
            inputMode="decimal"
            required
            value={draft.holdQty}
            error={validation.quantityError}
            onChange={(event) =>
              setDraft((current) => ({ ...current, holdQty: event.target.value }))
            }
          />
        )}
        {/* 규범 3 — Select 에 label prop 이 없어 라벨을 직접 세운다. 잠긴 사유는 상시 텍스트(규범 4). */}
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={reasonId}>
            {tReason.holdLabel}
          </label>
          <Select
            id={reasonId}
            options={reasons.options}
            value={draft.reasonCode === '' ? null : draft.reasonCode}
            placeholder={tReason.placeholder}
            disabled={write.isSaving || reasons.unavailableReason !== undefined}
            invalid={validation.reasonError !== undefined && draft.reasonCode !== ''}
            aria-required
            aria-describedby={validation.reasonError === undefined ? undefined : reasonNoteId}
            onChange={(value) => setDraft((current) => ({ ...current, reasonCode: value ?? '' }))}
          />
          {validation.reasonError === undefined ? null : (
            <p className="field-note" id={reasonNoteId}>
              {validation.reasonError}
            </p>
          )}
        </div>
        <TextArea
          label={t.remarks}
          fullWidth
          rows={3}
          value={draft.remarks}
          onChange={(event) => setDraft((current) => ({ ...current, remarks: event.target.value }))}
        />
      </div>
      <div className="form-actions lot-status-transition-execution-actions">
        <Button
          disabled={write.isSaving || validation.body === null}
          onClick={() => {
            if (validation.body !== null) {
              setConfirmation(validation.body);
              props.onConfirmationChange(true);
            }
          }}
        >
          {t.confirm}
        </Button>
      </div>
      {confirmation !== null && (
        <Dialog
          open
          closeOnBackdropClick={false}
          showCloseButton={false}
          title={t.dialogTitle(props.lotNo)}
          onClose={() => {
            if (!write.isSaving) closeDialog();
          }}
          footer={
            <>
              <Button variant="outlined" disabled={write.isSaving} onClick={closeDialog}>
                {t.cancel}
              </Button>
              <Button
                loading={write.isSaving}
                disabled={stale}
                onClick={() => {
                  if (!write.isSaving && !stale) write.write(confirmation);
                }}
              >
                {t.register}
              </Button>
            </>
          }
        >
          {stale ? (
            <AlertBanner variant="error" action={<Button onClick={reload}>{t.reload}</Button>}>
              {transitionStaleMessage(write.error, props.statusLabel)}
            </AlertBanner>
          ) : (
            <SaveErrorBanner error={write.error} />
          )}
          <AlertBanner variant="warning" title={t.impact.title}>
            <p>{t.impact.description}</p>
            <p>
              {t.impact.targetQuantity(
                confirmation.holdQty === undefined
                  ? t.impact.fullQuantity
                  : String(confirmation.holdQty),
              )}
            </p>
            <p>{t.impact.targetLocation(location)}</p>
            {(props.impact?.openPickingCount ?? 0) > 0 && (
              <p>{t.impact.openPicking(String(props.impact?.openPickingCount))}</p>
            )}
            {(props.impact?.shippedQty ?? 0) > 0 && (
              <p>{t.impact.shipped(String(props.impact?.shippedQty))}</p>
            )}
            <p>{t.impact.recovery}</p>
          </AlertBanner>
        </Dialog>
      )}
    </section>
  );
};
