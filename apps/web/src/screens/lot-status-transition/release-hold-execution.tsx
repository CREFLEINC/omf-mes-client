import { AlertBanner, Button, Dialog, TextField, useToast } from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { TextArea } from '@omf-mes/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';

type LotHold = components['schemas']['LotHold'];
type LotHoldRelease = components['schemas']['LotHoldRelease'];
const ROOT_KEY = ['lot-status-transition'] as const;

interface Draft {
  releaseQty: string;
  remarks: string;
}

interface Validation {
  body: LotHoldRelease | null;
  quantityError?: string;
  remarksError?: string;
}

const validate = (draft: Draft, maximum: number | undefined, target: string): Validation => {
  const text = draft.releaseQty.trim();
  const quantity = Number(text);
  const quantityError =
    text === '' || !Number.isFinite(quantity) || quantity <= 0
      ? '해제 수량은 0보다 커야 합니다.'
      : maximum === undefined || !Number.isFinite(maximum) || maximum <= 0
        ? '해제 가능한 보류 수량을 확인하지 못했습니다.'
        : quantity > maximum
          ? `해제 수량은 보류 수량 ${String(maximum)} 이하여야 합니다.`
          : undefined;
  const remarks = draft.remarks.trim();
  const remarksError = remarks === '' ? '해제 사유 및 비고를 입력하세요.' : undefined;
  return {
    quantityError,
    remarksError,
    body:
      quantityError === undefined && remarksError === undefined
        ? { targetLotStatusCode: target, releaseQty: quantity, remarks }
        : null,
  };
};

const isStale = (error: ApiError | null): boolean =>
  error?.kind === 'conflict' ||
  (error?.kind === 'http' && (error.status === 409 || error.status === 412));

export interface ReleaseHoldExecutionProps {
  etagPath: string;
  lotHoldId: number;
  lotNo: string;
  maxReleaseQty: number | undefined;
  targetLotStatusCode: string;
  onReleased: () => void;
}

export const ReleaseHoldExecution = (props: ReleaseHoldExecutionProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({ releaseQty: '', remarks: '' });
  const [attempted, setAttempted] = useState(false);
  const [confirmation, setConfirmation] = useState<LotHoldRelease | null>(null);
  const validation = validate(draft, props.maxReleaseQty, props.targetLotStatusCode);
  const write = useMasterWrite<LotHoldRelease, LotHold>({
    request: (body, headers) =>
      client.POST('/quality/lot-holds/{lotHoldId}:release', {
        params: {
          path: { lotHoldId: props.lotHoldId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      }),
    etagPath: props.etagPath,
    invalidateKeys: [ROOT_KEY],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setConfirmation(null);
      toast.show({ variant: 'success', description: 'LOT 보류를 해제했습니다.' });
      props.onReleased();
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
    <section aria-label="보류 해제 입력">
      <div className="form-grid">
        <TextField
          label="해제 수량"
          inputMode="decimal"
          required
          value={draft.releaseQty}
          error={attempted ? validation.quantityError : undefined}
          onChange={(event) =>
            setDraft((current) => ({ ...current, releaseQty: event.target.value }))
          }
        />
        <TextArea
          label="해제 사유 및 비고"
          required
          fullWidth
          rows={3}
          value={draft.remarks}
          error={attempted ? validation.remarksError : undefined}
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
        해제 확인
      </Button>
      {confirmation !== null && (
        <Dialog
          open
          closeOnBackdropClick={false}
          showCloseButton={false}
          title={`LOT 보류 해제 — ${props.lotNo}`}
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
                보류 해제
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
