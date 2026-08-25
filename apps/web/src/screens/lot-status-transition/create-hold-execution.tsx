import { AlertBanner, Button, Dialog, TextField, useToast } from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { TextArea } from '@omf-mes/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';

type LotHold = components['schemas']['LotHold'];
type LotHoldCreate = components['schemas']['LotHoldCreate'];
const ROOT_KEY = ['lot-status-transition'] as const;

interface Draft {
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
    text === '' || !Number.isFinite(quantity) || quantity <= 0
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
            holdQty: quantity,
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

export interface CreateHoldExecutionProps {
  lotId: number;
  lotNo: string;
  versionNo: number;
  maxHoldQty: number | undefined;
  targetLotStatusCode: string;
  onCreated: () => void;
}

export const CreateHoldExecution = (props: CreateHoldExecutionProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({ holdQty: '', reasonCode: '', remarks: '' });
  const [attempted, setAttempted] = useState(false);
  const [confirmation, setConfirmation] = useState<LotHoldCreate | null>(null);
  const validation = validate(draft, props);
  const write = useMasterWrite<LotHoldCreate, LotHold[]>({
    request: (body, headers) =>
      client.POST('/quality/lot-holds', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [ROOT_KEY],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setConfirmation(null);
      toast.show({ variant: 'success', description: 'LOT 보류를 등록했습니다.' });
      props.onCreated();
    },
  });
  const stale = isStale(write.error);
  const closeDialog = (): void => {
    setConfirmation(null);
    write.reset();
  };
  const reload = (): void => {
    closeDialog();
    void queryClient.invalidateQueries({ queryKey: ROOT_KEY });
  };

  return (
    <section aria-label="보류 등록 입력">
      <div className="form-grid">
        <TextField
          label="보류 수량"
          inputMode="decimal"
          required
          value={draft.holdQty}
          error={attempted ? validation.quantityError : undefined}
          onChange={(event) => setDraft((current) => ({ ...current, holdQty: event.target.value }))}
        />
        <TextField
          label="보류 사유"
          required
          value={draft.reasonCode}
          error={attempted ? validation.reasonError : undefined}
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
        disabled={write.isSaving}
        onClick={() => {
          setAttempted(true);
          if (validation.body !== null) setConfirmation(validation.body);
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
              LOT 정보가 변경되었습니다. 최신 정보를 불러온 뒤 다시 확인하세요.
            </AlertBanner>
          ) : (
            <SaveErrorBanner error={write.error} />
          )}
          <p>창고 사용과 출고·출하 및 피킹 가능 여부가 바뀝니다.</p>
          <p>이미 출고된 수량은 회수되지 않습니다.</p>
        </Dialog>
      )}
    </section>
  );
};
