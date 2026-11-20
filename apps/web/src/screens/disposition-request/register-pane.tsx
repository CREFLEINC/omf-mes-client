import { Button, TextArea } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { InfoLabel } from '../../patterns/info-tip';
import { SaveErrorBanner } from '../../patterns/master';
import { Select } from '../../patterns/select';
import type { Lock } from './lock';
import type { CodeOptionSource } from './lookups';
import type { NonconformanceFormErrors, NonconformanceFormValue } from './nonconformance-form';

export interface RegisterPaneProps {
  value: NonconformanceFormValue;
  errors: NonconformanceFormErrors;
  /** A-12 — 짧은 내용의 예고. 저장을 막지 않는다 */
  warning: string | undefined;
  severity: CodeOptionSource;
  departments: CodeOptionSource;
  lock: Lock;
  onCheckOutcome: () => void;
  writeError: ApiError | null;
  isSaving: boolean;
  canCancel: boolean;
  onChange: (value: NonconformanceFormValue) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
}

/** ① 부적합 등록. 심각도·내용 필수, 담당 부서 선택. 원천 입력 위젯은 그리지 않는다(§5-1-1 ⓓ). */
export const RegisterPane = ({
  value,
  errors,
  warning,
  severity,
  departments,
  lock,
  onCheckOutcome,
  writeError,
  isSaving,
  canCancel,
  onChange,
  onSave,
  onCancel,
  onReload,
}: RegisterPaneProps) => {
  const t = messages.dispositionRequest;
  const severityId = useId();
  const departmentId = useId();
  const lockReasonId = useId();
  const warningId = useId();
  const descriptionId = useId();
  const isLocked = lock.reason !== undefined;
  const severityPending = severity.options.length === 0;
  const describedBy = (...ids: (string | undefined)[]): string | undefined => {
    const joined = ids.filter((id): id is string => id !== undefined).join(' ');
    return joined === '' ? undefined : joined;
  };

  return (
    <div className="disposition-request-form" role="group" aria-label={t.panes.register}>
      <SaveErrorBanner error={writeError} onReload={onReload} />

      <div className="field-cell">
        <label className="field-label" htmlFor={severityId}>
          {t.register.severityLabel}
        </label>
        {/* G-2 — 값 목록이 비면 선택지를 지어내지 않고 비활성 + 사유. 저장 버튼도 같은 사유로 잠긴다. */}
        <Select
          id={severityId}
          options={severity.options}
          value={value.severityCode === '' ? null : value.severityCode}
          placeholder={severityPending ? t.codePlaceholder : t.register.severityPlaceholder}
          disabled={isLocked || severityPending}
          invalid={errors.severityCode !== undefined}
          aria-describedby={describedBy(isLocked ? lockReasonId : undefined)}
          onChange={(next) => onChange({ ...value, severityCode: next })}
        />
        {errors.severityCode !== undefined && (
          <span className="field-error">{errors.severityCode}</span>
        )}
      </div>

      {/*
       * 내용 — 판정자의 유일한 입력이다. 형식은 라벨 옆 ⓘ 로 유도한다(§5-3 · A-12 · 관리웹 정리 시안 A).
       * DS `TextArea` 라벨은 글자만 받아 라벨을 비우고 같은 `id` 로 잇는다. 라벨과 칸은 한 덩어리로
       * 묶는다 — 폼의 줄 간격이 라벨과 칸 사이에 끼지 않게.
       */}
      <div>
        <InfoLabel
          htmlFor={descriptionId}
          label={t.register.descriptionLabel}
          info={t.register.descriptionHelp}
        />
        <TextArea
          id={descriptionId}
          value={value.description}
          required
          fullWidth
          rows={3}
          disabled={isLocked}
          aria-describedby={describedBy(
            isLocked ? lockReasonId : undefined,
            warning === undefined ? undefined : warningId,
          )}
          error={errors.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </div>
      {warning !== undefined && (
        <p id={warningId} className="field-note">
          {warning}
        </p>
      )}

      <div className="field-cell">
        <label className="field-label" htmlFor={departmentId}>
          {t.register.departmentLabel}
        </label>
        <Select
          id={departmentId}
          options={[{ value: '', label: t.register.departmentNone }, ...departments.options]}
          value={value.departmentId}
          disabled={isLocked}
          onChange={(next) => onChange({ ...value, departmentId: next })}
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
        <p className="field-note form-actions-secondary">{t.register.irreversible}</p>
        <Button variant="outlined" disabled={!canCancel || isSaving} onClick={onCancel}>
          {t.actions.cancel}
        </Button>
        <Button
          disabled={isLocked || isSaving}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onClick={onSave}
        >
          {t.actions.register}
        </Button>
      </div>
    </div>
  );
};
