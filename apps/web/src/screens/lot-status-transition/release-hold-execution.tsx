import {
  AlertBanner,
  Button,
  Dialog,
  Icon,
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
import { requireIfMatch, SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import {
  isKnownReason,
  LOT_HOLD_RELEASE_REASON_GROUP,
  useLotHoldReasonOptions,
  type ReasonOptions,
} from './code-options';
import { isTransitionStale, transitionStaleMessage } from './transition-error';

type LotHold = components['schemas']['LotHold'];
type LotHoldRelease = components['schemas']['LotHoldRelease'];
const t = messages.lotStatusTransition.release;
const tReason = messages.lotStatusTransition.reason;
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
 * `releaseReasonCode`는 등록 사유와 대칭인 필수 축이고(스펙 §5-4) 값 목록은 공통코드
 * `LOT_HOLD_RELEASE_REASON`이 준다(코드 사전 등재). 목록이 서지 않으면 그 사유로 잠그고, 선택지에
 * 없는 값은 보내지 않는다(fail-closed) — 자유 입력으로 물러나지 않는다.
 */
const validate = (
  draft: Draft,
  maximum: number | undefined,
  target: string,
  reasons: ReasonOptions,
): Validation => {
  const text = draft.releaseQty.trim();
  const quantity = Number(text);
  const quantityError =
    draft.mode === 'FULL'
      ? undefined
      : text === '' || !Number.isFinite(quantity) || quantity <= 0
        ? t.quantityPositive
        : maximum === undefined || !Number.isFinite(maximum) || maximum <= 0
          ? t.quantityUnknown
          : quantity > maximum
            ? t.quantityMax(String(maximum))
            : undefined;
  const releaseReasonCode = draft.releaseReasonCode.trim();
  const releaseReasonError =
    reasons.unavailableReason ??
    (releaseReasonCode === ''
      ? tReason.required
      : isKnownReason(reasons.options, releaseReasonCode)
        ? undefined
        : tReason.unknown);
  const remarks = draft.remarks.trim();
  const remarksError = remarks === '' ? t.remarksRequired : undefined;
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
  /*
   * 오류는 그 칸을 건드린 뒤에만 보인다(사용자 지시) — 처음부터 빨간 칸이 서지 않게 한다. 판정은 그대로다
   * (실행 단추는 판정대로 잠긴다). 사유 목록을 못 받은 사정처럼 입력과 무관한 사유는 늘 보인다.
   */
  const [touched, setTouched] = useState({ quantity: false, reason: false, remarks: false });
  const reasons = useLotHoldReasonOptions(LOT_HOLD_RELEASE_REASON_GROUP);
  const reasonId = useId();
  const reasonNoteId = `${reasonId}-note`;
  const validation = validate(draft, props.maxReleaseQty, props.targetLotStatusCode, reasons);
  const quantityError = touched.quantity ? validation.quantityError : undefined;
  const reasonError =
    reasons.unavailableReason ?? (touched.reason ? validation.releaseReasonError : undefined);
  const remarksError = touched.remarks ? validation.remarksError : undefined;
  const write = useMasterWrite<LotHoldRelease, LotHold>({
    request: (body, headers) =>
      client.POST('/quality/lot-holds/{lotHoldId}:release', {
        params: {
          path: { lotHoldId: props.lotHoldId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            /* 토큰이 없으면 보내지 않는다 — 빈 If-Match 로 나가면 서버가 판정할 대상이 없다. */
            'If-Match': requireIfMatch(headers),
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
      toast.show({ variant: 'success', description: t.success });
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
  const location = t.impact.locationValue(
    props.warehouseId === undefined ? t.impact.unknown : String(props.warehouseId),
    props.locationId === undefined ? t.impact.unknown : String(props.locationId),
  );

  return (
    <section className="lot-status-transition-execution" aria-label={t.pane}>
      <h3 className="lot-status-transition-subtitle">{t.sectionTitle}</h3>
      {/* 해제 방식 → (일부면 수량) → 해제 사유 → 비고 → 실행 순서로 한 줄기(사용자 지시). */}
      <div className="lot-status-transition-mode">
        <span className="field-label">{t.modeLabel}</span>
        <RadioGroup
          name={`release-mode-${String(props.lotHoldId)}`}
          orientation="horizontal"
          value={draft.mode}
          disabled={write.isSaving}
          aria-label={t.scope}
          onChange={(value) => {
            setDraft({
              mode: value === 'PARTIAL' ? 'PARTIAL' : 'FULL',
              releaseQty: '',
              releaseReasonCode: '',
              remarks: '',
            });
            setTouched({ quantity: false, reason: false, remarks: false });
            setConfirmation(null);
            write.reset();
          }}
        >
          <Radio value="FULL">{t.full}</Radio>
          <Radio value="PARTIAL">{t.partial}</Radio>
        </RadioGroup>
      </div>
      <div className="lot-status-transition-execution-form">
        {draft.mode === 'PARTIAL' && (
          <TextField
            label={t.quantity}
            inputMode="decimal"
            required
            value={draft.releaseQty}
            error={quantityError}
            onBlur={() => setTouched((current) => ({ ...current, quantity: true }))}
            onChange={(event) =>
              setDraft((current) => ({ ...current, releaseQty: event.target.value }))
            }
          />
        )}
        {/* 규범 3 — Select 에 label prop 이 없어 라벨을 직접 세운다. 잠긴 사유는 상시 텍스트(규범 4). */}
        <div
          className="field-cell wide-select"
          /* 선택칸을 거쳐 나가면 「건드렸다」 — 고르지 않고 지나쳐도 필수 안내가 선다. */
          onBlur={() => setTouched((current) => ({ ...current, reason: true }))}
        >
          <span className="field-label">
            <label htmlFor={reasonId}>{tReason.releaseLabel}</label>
            {/* 필수 표시는 라벨 밖 — 칸 이름에 `*` 가 섞이지 않게 한다. */}
            <span className="lot-status-transition-required" aria-hidden="true">
              *
            </span>
          </span>
          <Select
            id={reasonId}
            options={reasons.options}
            value={draft.releaseReasonCode === '' ? null : draft.releaseReasonCode}
            placeholder={tReason.placeholder}
            disabled={write.isSaving || reasons.unavailableReason !== undefined}
            invalid={reasonError !== undefined && draft.releaseReasonCode !== ''}
            aria-required
            aria-describedby={reasonError === undefined ? undefined : reasonNoteId}
            onChange={(value) => {
              setTouched((current) => ({ ...current, reason: true }));
              setDraft((current) => ({ ...current, releaseReasonCode: value ?? '' }));
            }}
          />
          {reasonError === undefined ? null : (
            <p className="field-note" id={reasonNoteId}>
              {reasonError}
            </p>
          )}
        </div>
        <TextArea
          label={t.remarks}
          required
          fullWidth
          rows={2}
          value={draft.remarks}
          error={remarksError}
          onBlur={() => setTouched((current) => ({ ...current, remarks: true }))}
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
          title={t.dialogTitle}
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
                {t.release}
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
          {/*
           * 최종 실행 확인 — 어떤 LOT · 얼마나 · 어디서를 먼저, 결과 설명은 흐린 글자, 되돌릴 수 없는 사정만
           * 작은 주의 상자(사용자 지시). 큰 경고 상자 하나에 모두 담지 않는다.
           */}
          <div className="lot-release-confirm">
            <dl className="lot-release-confirm-lot">
              <dt>{t.dialogLot}</dt>
              <dd>{props.lotNo}</dd>
            </dl>
            <section className="lot-release-confirm-info" aria-label={t.impact.infoTitle}>
              <h3>{t.impact.infoTitle}</h3>
              <dl>
                <div>
                  <dt>{t.impact.quantity}</dt>
                  <dd>
                    {confirmation.releaseQty === undefined
                      ? t.impact.fullQuantity
                      : String(confirmation.releaseQty)}
                  </dd>
                </div>
                <div>
                  <dt>{t.impact.location}</dt>
                  <dd>{location}</dd>
                </div>
              </dl>
              <p className="lot-release-confirm-description">{t.impact.description}</p>
            </section>
            <div
              className="lot-release-confirm-caution"
              role="note"
              aria-label={t.impact.cautionTitle}
            >
              <Icon name="warning" size={18} />
              <div>
                <p>{t.impact.reHold}</p>
                <p>{t.impact.shipped}</p>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
};
