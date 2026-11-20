import { Button, TextArea, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { InfoLabel, InfoTip } from '../../patterns/info-tip';
import { SaveErrorBanner } from '../../patterns/master';
import type { Lock } from './lock';
import type { RequestFormErrors, RequestFormValue } from './request-form';

export interface RequestPaneProps {
  value: RequestFormValue;
  errors: RequestFormErrors;
  /** 의뢰 상한 — 대상 수량. 표시용 문자열과 단위 이름을 함께 받는다 */
  maxQtyText: string;
  uomLabel: string;
  lock: Lock;
  onCheckOutcome: () => void;
  writeError: ApiError | null;
  isSaving: boolean;
  canCancel: boolean;
  onChange: (value: RequestFormValue) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
}

/**
 * ② 판정 의뢰. 부적합이 등록된 뒤에만 열린다. 의뢰하면 품질 화면으로 넘어간다(§3 ②) — 그 말은 구획 제목
 * 옆 ⓘ 로 둔다(`screen.tsx`). 칸의 규칙(넣을 범위 · 누가 읽는지)은 칸 아래가 아니라 라벨 옆 ⓘ 로 둔다
 * (관리웹 정리 시안 A). DS 라벨은 글자만 받아 라벨을 비우고 같은 `id` 로 잇는다.
 */
export const RequestPane = ({
  value,
  errors,
  maxQtyText,
  uomLabel,
  lock,
  onCheckOutcome,
  writeError,
  isSaving,
  canCancel,
  onChange,
  onSave,
  onCancel,
  onReload,
}: RequestPaneProps) => {
  const t = messages.dispositionRequest;
  const lockReasonId = useId();
  const qtyId = useId();
  const remarksId = useId();
  const isLocked = lock.reason !== undefined;

  return (
    <div className="disposition-request-form" role="group" aria-label={t.panes.request}>
      <SaveErrorBanner error={writeError} onReload={onReload} />

      {/*
       * 라벨과 칸은 한 덩어리로 묶는다 — 폼의 줄 간격이 라벨과 칸 사이에 끼지 않게. 필수 표시를 지키려고
       * 이 라벨은 공용 `InfoLabel` 과 같은 짜임으로 이 자리에서 그린다.
       */}
      <div>
        <span className="info-label">
          <span className="field-label">
            <label htmlFor={qtyId}>
              {uomLabel === '' ? t.request.qtyLabel : `${t.request.qtyLabel} (${uomLabel})`}
            </label>
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          </span>
          <InfoTip text={t.request.qtyHelp(maxQtyText, uomLabel)} />
        </span>
        <TextField
          id={qtyId}
          value={value.qty}
          required
          fullWidth
          inputMode="decimal"
          disabled={isLocked}
          aria-describedby={isLocked ? lockReasonId : undefined}
          error={errors.requestedQty}
          onChange={(event) => onChange({ ...value, qty: event.target.value })}
        />
      </div>

      <div>
        <InfoLabel
          htmlFor={remarksId}
          label={t.request.remarksLabel}
          info={t.request.remarksHelp}
        />
        <TextArea
          id={remarksId}
          value={value.remarks}
          fullWidth
          rows={2}
          disabled={isLocked}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onChange={(event) => onChange({ ...value, remarks: event.target.value })}
        />
      </div>

      {isLocked && (
        <div className="form-actions">
          <p id={lockReasonId} className="field-note form-actions-secondary">
            {lock.reason}
          </p>
          {lock.isUncertain && (
            <Button variant="outlined" size="sm" onClick={onCheckOutcome}>
              {t.actions.checkOutcome}
            </Button>
          )}
        </div>
      )}

      <div className="form-actions">
        <p className="field-note form-actions-secondary">{t.request.irreversible}</p>
        <Button variant="outlined" disabled={!canCancel || isSaving} onClick={onCancel}>
          {t.actions.cancel}
        </Button>
        <Button
          disabled={isLocked || isSaving}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onClick={onSave}
        >
          {t.actions.request}
        </Button>
      </div>
    </div>
  );
};
