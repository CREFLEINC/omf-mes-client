import {
  AlertBanner,
  Button,
  Dialog,
  Radio,
  RadioGroup,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { TextArea } from '@omf-mes/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { isTransitionStale, transitionStaleMessage } from './transition-error';

type LotHold = components['schemas']['LotHold'];
type LotHoldRelease = components['schemas']['LotHoldRelease'];
const ROOT_KEY = ['lot-status-transition'] as const;
const HISTORY_KEY = ['lot-status-history'] as const;

interface Draft {
  mode: 'FULL' | 'PARTIAL';
  releaseQty: string;
  releaseReasonCode: string;
  remarks: string;
}

interface Validation {
  body: LotHoldRelease | null;
  quantityError?: string;
  releaseReasonError?: string;
  remarksError?: string;
}

/**
 * client#601 2-2 — `releaseReasonCode`가 2026-08-30 되살아나 필수가 됐다(등록 사유와 대칭 축).
 * 값 목록이 아직 확정되지 않아 자유 입력으로 받는다 — 형제 폼(`create-hold-execution.tsx`의
 * `reasonCode`)이 같은 사정(등록 사유)에 이미 쓰고 있는 형태를 그대로 옮겼다.
 */
const validate = (draft: Draft, maximum: number | undefined, target: string): Validation => {
  const text = draft.releaseQty.trim();
  const quantity = Number(text);
  const quantityError =
    draft.mode === 'FULL'
      ? undefined
      : text === '' || !Number.isFinite(quantity) || quantity <= 0
        ? '해제 수량은 0보다 커야 합니다.'
        : maximum === undefined || !Number.isFinite(maximum) || maximum <= 0
          ? '해제 가능한 보류 수량을 확인하지 못했습니다.'
          : quantity > maximum
            ? `해제 수량은 보류 수량 ${String(maximum)} 이하여야 합니다.`
            : undefined;
  const releaseReasonCode = draft.releaseReasonCode.trim();
  const releaseReasonError = releaseReasonCode === '' ? '해제 사유를 입력하세요.' : undefined;
  const remarks = draft.remarks.trim();
  const remarksError = remarks === '' ? '비고를 입력하세요.' : undefined;
  return {
    quantityError,
    releaseReasonError,
    remarksError,
    body:
      quantityError === undefined && releaseReasonError === undefined && remarksError === undefined
        ? {
            targetLotStatusCode: target,
            ...(draft.mode === 'PARTIAL' ? { releaseQty: quantity } : {}),
            releaseReasonCode,
            remarks,
          }
        : null,
  };
};

export interface ReleaseHoldExecutionProps {
  etagPath: string;
  lotHoldId: number;
  lotNo: string;
  maxReleaseQty: number | undefined;
  warehouseId: number | undefined;
  locationId: number | undefined;
  targetLotStatusCode: string;
  statusLabel: (code: string) => string;
  onReleased: () => void;
  onConfirmationChange: (pinned: boolean) => void;
  onStale: () => void;
}

export const ReleaseHoldExecution = (props: ReleaseHoldExecutionProps) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({
    mode: 'FULL',
    releaseQty: '',
    releaseReasonCode: '',
    remarks: '',
  });
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
    invalidateKeys: [ROOT_KEY, HISTORY_KEY],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      setConfirmation(null);
      props.onConfirmationChange(false);
      toast.show({ variant: 'success', description: 'LOT 보류를 해제했습니다.' });
      props.onReleased();
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
    <section aria-label="보류 해제 입력">
      <RadioGroup
        name={`release-mode-${String(props.lotHoldId)}`}
        orientation="horizontal"
        value={draft.mode}
        disabled={write.isSaving}
        aria-label="해제 범위"
        onChange={(value) => {
          setDraft({
            mode: value === 'PARTIAL' ? 'PARTIAL' : 'FULL',
            releaseQty: '',
            releaseReasonCode: '',
            remarks: '',
          });
          setConfirmation(null);
          write.reset();
        }}
      >
        <Radio value="FULL">전량 해제</Radio>
        <Radio value="PARTIAL">일부 해제</Radio>
      </RadioGroup>
      <div className="form-grid">
        {draft.mode === 'PARTIAL' && (
          <TextField
            label="해제 수량"
            inputMode="decimal"
            required
            value={draft.releaseQty}
            error={validation.quantityError}
            onChange={(event) =>
              setDraft((current) => ({ ...current, releaseQty: event.target.value }))
            }
          />
        )}
        <TextField
          label="해제 사유"
          required
          value={draft.releaseReasonCode}
          error={validation.releaseReasonError}
          onChange={(event) =>
            setDraft((current) => ({ ...current, releaseReasonCode: event.target.value }))
          }
        />
        <TextArea
          label="비고"
          required
          fullWidth
          rows={3}
          value={draft.remarks}
          error={validation.remarksError}
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
              {transitionStaleMessage(write.error, props.statusLabel)}
            </AlertBanner>
          ) : (
            <SaveErrorBanner error={write.error} />
          )}
          <AlertBanner variant="warning" title="이 전이가 하는 일">
            <p>보류 해제는 대상 수량의 출고·출하 및 피킹 제한을 풉니다.</p>
            <p>
              대상 수량: {confirmation.releaseQty === undefined ? '전량' : confirmation.releaseQty}
            </p>
            <p>대상 위치: {location}</p>
            <p>
              다시 보류가 필요하면 새 Hold를 등록해야 하며, 이미 출고된 수량은 회수되지 않습니다.
            </p>
          </AlertBanner>
        </Dialog>
      )}
    </section>
  );
};
