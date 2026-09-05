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
  const tReason = messages.lotStatusTransition.reason;
  const text = draft.holdQty.trim();
  const quantity = Number(text);
  const quantityError =
    draft.mode === 'FULL'
      ? undefined
      : text === '' || !Number.isFinite(quantity) || quantity <= 0
        ? '보류 수량은 0보다 커야 합니다.'
        : props.maxHoldQty === undefined || !Number.isFinite(props.maxHoldQty)
          ? '보류 가능 수량을 확인하지 못했습니다.'
          : quantity > props.maxHoldQty
            ? `보류 수량은 보류 가능 수량 ${String(props.maxHoldQty)} 이하여야 합니다.`
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
      toast.show({ variant: 'success', description: 'LOT 보류를 등록했습니다.' });
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
  const location = `창고 ${props.warehouseId === undefined ? '미확인' : String(props.warehouseId)} / Location ${props.locationId === undefined ? '미확인' : String(props.locationId)}`;

  return (
    <section className="lot-status-transition-execution" aria-label="보류 등록 입력">
      <RadioGroup
        name={`create-hold-mode-${String(props.lotId)}`}
        orientation="horizontal"
        value={draft.mode}
        disabled={write.isSaving}
        aria-label="보류 범위"
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
        <Radio value="FULL">전량 보류</Radio>
        <Radio value="PARTIAL">일부 보류</Radio>
      </RadioGroup>
      <div className="form-grid lot-status-transition-execution-form">
        {draft.mode === 'PARTIAL' && (
          <TextField
            label="보류 수량"
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
            {messages.lotStatusTransition.reason.holdLabel}
          </label>
          <Select
            id={reasonId}
            options={reasons.options}
            value={draft.reasonCode === '' ? null : draft.reasonCode}
            placeholder={messages.lotStatusTransition.reason.placeholder}
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
          label="보류 비고"
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
          등록 확인
        </Button>
      </div>
      {confirmation !== null && (
        <Dialog
          open
          closeOnBackdropClick={false}
          showCloseButton={false}
          title={`LOT 보류 등록 — ${props.lotNo}`}
          onClose={() => {
            if (!write.isSaving) closeDialog();
          }}
          footer={
            <>
              <Button variant="outlined" disabled={write.isSaving} onClick={closeDialog}>
                취소
              </Button>
              <Button
                loading={write.isSaving}
                disabled={stale}
                onClick={() => {
                  if (!write.isSaving && !stale) write.write(confirmation);
                }}
              >
                보류 등록
              </Button>
            </>
          }
        >
          {stale ? (
            <AlertBanner variant="error" action={<Button onClick={reload}>최신 불러오기</Button>}>
              {transitionStaleMessage(write.error, props.statusLabel)}
            </AlertBanner>
          ) : (
            <SaveErrorBanner error={write.error} />
          )}
          <AlertBanner variant="warning" title="이 전이가 하는 일">
            <p>Hold는 대상 수량의 출고·출하 및 피킹을 막습니다.</p>
            <p>대상 수량: {confirmation.holdQty === undefined ? '전량' : confirmation.holdQty}</p>
            <p>대상 위치: {location}</p>
            {(props.impact?.openPickingCount ?? 0) > 0 && (
              <p>피킹 중인 요청 {props.impact?.openPickingCount}건이 막힙니다.</p>
            )}
            {(props.impact?.shippedQty ?? 0) > 0 && (
              <p>이미 출고된 수량 {props.impact?.shippedQty}은 이 전이로 회수되지 않습니다.</p>
            )}
            <p>다시 사용하려면 Release 전이가 필요하며, 이미 출고된 수량은 회수되지 않습니다.</p>
          </AlertBanner>
        </Dialog>
      )}
    </section>
  );
};
