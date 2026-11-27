import {
  AlertBanner,
  Button,
  Dialog,
  Icon,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { InfoFacts } from '../../patterns/info-facts';
import { requireIfMatch, SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { Select } from '../../patterns/select';
import {
  isKnownReason,
  LOT_HOLD_RELEASE_REASON_GROUP,
  useLotHoldReasonOptions,
  type ReasonOptions,
} from './code-options';
import { isTransitionStale, transitionStaleMessage } from './transition-error';
import { usePlaceNames } from './place-names';

type LotHold = components['schemas']['LotHold'];
type LotHoldRelease = components['schemas']['LotHoldRelease'];
const t = messages.lotStatusTransition.release;
const tReason = messages.lotStatusTransition.reason;
const tHolds = messages.lotStatusTransition.preparation.holds;
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
  /** 팝업 사실 상자 — LOT 의 지금 상태 코드 · 고른 보류의 사유 이름 · 보류량(숫자 + 단위). */
  currentLotStatusCode: string;
  holdReasonLabel: string;
  holdQtyText: string;
  maxReleaseQty: number | undefined;
  warehouseId: number | undefined;
  locationId: number | undefined;
  targetLotStatusCode: string;
  statusLabel: (code: string) => string;
  onReleased: () => void;
  /** [취소] — 팝업을 닫는다(입력은 버린다). */
  onCancel: () => void;
  onConfirmationChange: (pinned: boolean) => void;
  onStale: () => void;
}

/**
 * 「해제 정보」 팝업(사용자 지시 2026-11-27 · omf-all-around#360) — [상태 변경 검토]를 누르면 뜬다. 위에 사실 상자
 * (LOT · 상태 변화 · 해제할 보류), 아래에 해제 방식 · (일부면 수량) · 해제 사유 · 비고, 단추 줄 [취소][상태 변경 및 보류 해제].
 * 필수를 다 채워야 실행 단추가 켜지고, 누르면 종전과 같은 요청을 보낸다. 팝업이 떠 있는 동안 조회를 멈춘다(pin).
 */
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
  const reasons = useLotHoldReasonOptions(LOT_HOLD_RELEASE_REASON_GROUP);
  const reasonId = useId();
  const reasonNoteId = `${reasonId}-note`;
  const validation = validate(draft, props.maxReleaseQty, props.targetLotStatusCode, reasons);
  /*
   * 빈 필수 칸은 글자 오류 없이 연한 빨간 바탕만(팝업 시안 1장) — 값을 넣었는데 틀린 경우(수량 범위 · 목록에 없는 사유)와
   * 사유 목록을 못 받은 사정만 글자로 알린다. 판정은 그대로다(실행 단추는 판정대로 잠긴다).
   */
  const quantityError = draft.releaseQty.trim() === '' ? undefined : validation.quantityError;
  const reasonError =
    reasons.unavailableReason ??
    (draft.releaseReasonCode === '' ? undefined : validation.releaseReasonError);
  const { onConfirmationChange } = props;
  /* 팝업이 떠 있는 동안 조회를 멈춘다 — 확인한 내용과 보내는 대상이 갈리지 않게(종전 확인 창과 같다). */
  useEffect(() => {
    onConfirmationChange(true);
    return () => onConfirmationChange(false);
  }, [onConfirmationChange]);
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
      props.onConfirmationChange(false);
      toast.show({ variant: 'success', description: t.success });
      props.onReleased();
    },
  });
  const stale = isTransitionStale(write.error);
  const closeDialog = (): void => {
    write.reset();
    props.onConfirmationChange(false);
    props.onCancel();
  };
  const reload = (): void => {
    write.reset();
    props.onConfirmationChange(false);
    props.onStale();
    void queryClient.invalidateQueries({ queryKey: ROOT_KEY });
  };
  const place = usePlaceNames(props.warehouseId, props.locationId);
  const location = t.impact.locationValue(
    place.warehouse ?? t.impact.unknown,
    place.location ?? t.impact.unknown,
  );

  return (
    <Dialog
      open
      size="md"
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
            disabled={stale || validation.body === null}
            onClick={() => {
              if (!write.isSaving && !stale && validation.body !== null)
                write.write(validation.body);
            }}
          >
            {t.confirm}
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
      <div className="lot-release-confirm">
        {/* 사실 상자 — 정보 표시 팝업 시안 상자(#360). 첫 줄 LOT(크게), 둘째 줄 상태 변화 · 해제할 보류 · 위치. */}
        <InfoFacts
          rows={[
            [{ label: t.dialogLot, value: props.lotNo, isKey: true }],
            [
              {
                label: t.dialogStatus,
                value: t.statusChange(
                  props.statusLabel(props.currentLotStatusCode),
                  props.statusLabel(props.targetLotStatusCode),
                ),
              },
              { label: tHolds.reason, value: props.holdReasonLabel },
              { label: tHolds.quantity, value: props.holdQtyText },
              { label: t.impact.location, value: location },
            ],
          ]}
        />
        <section className="lot-release-confirm" aria-label={t.pane}>
          {/* 해제 방식 → (일부면 수량) → 해제 사유 → 비고 순서로 한 줄기(사용자 지시). */}
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
                placeholder={t.quantityPlaceholder}
                value={draft.releaseQty}
                error={quantityError}
                disabled={write.isSaving}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, releaseQty: event.target.value }))
                }
              />
            )}
            {/* 규범 3 — Select 에 label prop 이 없어 라벨을 직접 세운다. 잠긴 사유는 상시 텍스트(규범 4). */}
            <div className="field-cell wide-select">
              <span className="field-label">
                <label htmlFor={reasonId}>{tReason.releaseLabel}</label>
                {/* 필수 표시는 라벨 밖 — 칸 이름에 `*` 가 섞이지 않게 한다. `.required-mark` 는 빈 칸 바탕(팝업 공통)의 표지. */}
                <span className="required-mark lot-status-transition-required" aria-hidden="true">
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
                onChange={(value) =>
                  setDraft((current) => ({ ...current, releaseReasonCode: value ?? '' }))
                }
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
              placeholder={t.remarksPlaceholder}
              value={draft.remarks}
              disabled={write.isSaving}
              onChange={(event) =>
                setDraft((current) => ({ ...current, remarks: event.target.value }))
              }
            />
          </div>
        </section>
        {/* 되돌릴 수 없는 사정만 작은 주의 상자(사용자 지시 — 종전 확인 창의 주의 두 줄). */}
        <div className="lot-release-confirm-caution" role="note" aria-label={t.impact.cautionTitle}>
          <Icon name="warning" size={18} />
          <div>
            <p>{t.impact.reHold}</p>
            <p>{t.impact.shipped}</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
