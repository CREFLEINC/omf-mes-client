import {
  AlertBanner,
  Button,
  Dialog,
  Radio,
  RadioGroup,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { TextArea } from '@omf-mes/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';

type LotHold = components['schemas']['LotHold'];
type LotHoldCreate = components['schemas']['LotHoldCreate'];
const ROOT_KEY = ['lot-status-transition'] as const;
const HISTORY_KEY = ['lot-status-history'] as const;
const STALE_FALLBACK = 'LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.';

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

const validate = (draft: Draft, props: CreateHoldExecutionProps): Validation => {
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
  const reasonError = reasonCode === '' ? '보류 사유를 입력하세요.' : undefined;
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

const isStale = (error: ApiError | null): boolean =>
  error?.kind === 'conflict' ||
  (error?.kind === 'http' && (error.status === 409 || error.status === 412));
const staleMessage = (error: ApiError | null): string =>
  (error?.kind === 'conflict' || error?.kind === 'http') &&
  error.message !== undefined &&
  error.message.trim() !== ''
    ? error.message
    : STALE_FALLBACK;

export interface CreateHoldExecutionProps {
  lotId: number;
  lotNo: string;
  versionNo: number;
  maxHoldQty: number | undefined;
  warehouseId: number | undefined;
  locationId: number | undefined;
  targetLotStatusCode: string;
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
  const validation = validate(draft, props);
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
  const stale = isStale(write.error);
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
    <section aria-label="보류 등록 입력">
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
      <div className="form-grid">
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
        <TextField
          label="보류 사유"
          required
          value={draft.reasonCode}
          error={validation.reasonError}
          onChange={(event) =>
            setDraft((current) => ({ ...current, reasonCode: event.target.value }))
          }
        />
        <TextArea
          label="보류 비고"
          fullWidth
          rows={3}
          value={draft.remarks}
          onChange={(event) => setDraft((current) => ({ ...current, remarks: event.target.value }))}
        />
      </div>
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
              {staleMessage(write.error)}
            </AlertBanner>
          ) : (
            <SaveErrorBanner error={write.error} />
          )}
          <AlertBanner variant="warning" title="이 전이가 하는 일">
            <p>Hold는 대상 수량의 출고·출하 및 피킹을 막습니다.</p>
            <p>대상 수량: {confirmation.holdQty === undefined ? '전량' : confirmation.holdQty}</p>
            <p>대상 위치: {location}</p>
            <p>다시 사용하려면 Release 전이가 필요하며, 이미 출고된 수량은 회수되지 않습니다.</p>
          </AlertBanner>
        </Dialog>
      )}
    </section>
  );
};
