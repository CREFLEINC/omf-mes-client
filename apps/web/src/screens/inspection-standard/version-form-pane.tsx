import { AlertBanner, Button, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import {
  FREQUENCY_INTERVAL_UOM_OPTIONS,
  INSPECTION_FREQUENCY_OPTIONS,
  SAMPLING_METHOD_OPTIONS,
  ensureOption,
} from './code-options';
import { FieldLabel } from './field-label';
import type { VersionStatusView } from './plan-version-status';
import { SelectField } from './select-field';
import type { VersionFormValues } from './types';

const t = messages.inspectionStandard;

export type VersionFormMode = 'edit' | 'create';

export interface VersionFormPaneProps {
  /** `create`면 아직 없는 버전을 만드는 폼이다 — 판 번호·상태가 없고 주 액션이 등록이다. */
  mode: VersionFormMode;
  /** 판 번호는 시스템 채번이라 값 표기로만 낸다. 등록 전에는 없으므로 null이다. */
  planVersion: number | null;
  /** 상태도 서버가 정한다. 등록 전에는 없으므로 null이며, 없는 값을 지어내 보이지 않는다. */
  status: VersionStatusView | null;
  values: VersionFormValues;
  onChange: (patch: Partial<VersionFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장·전이 실패 배너 슬롯 */
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** 확정·폐기·비교·이력 액션 슬롯. 이 구획 밖의 사실이 조건에 들어가 화면이 판정한다 */
  transitionActions?: ReactNode;
}

/**
 * 우 중단 — 버전 헤더.
 *
 * **상태 잠금**: 확정·폐기 버전은 전 입력이 잠긴다. 푸는 방법은 신규 버전 발행이며
 * 구획 배너로 안내한다. 잠금의 최종 판정은 서버(400 `STATE_LOCKED`)가 한다.
 *
 * **샘플 수량은 개수다.** 라벨에 단위를 박고 그 아래에 「비율이 아니다」를 한 줄 더 적는다 —
 * 착수 이슈 #12 §4·§6이 밝혔듯 확정 스펙은 비율 입력인데 저장 자리는 수량이라,
 * 라벨만으로는 오해가 남는다.
 */
export const VersionFormPane = ({
  mode,
  planVersion,
  status,
  values,
  onChange,
  fieldErrors,
  banner,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  transitionActions,
}: VersionFormPaneProps) => {
  const versionLabelId = useId();
  const statusLabelId = useId();
  const effectiveFromId = useId();
  const samplingQtyId = useId();

  const isLocked = status !== null && !status.isEditable;
  const stateLockMessage = status?.status === 'obsolete' ? t.stateLock.obsolete : t.stateLock.confirmed;

  return (
    <section className="pane" aria-label={t.panes.versionForm}>
      {isLocked && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.stateLock.title}>
            {stateLockMessage}
          </AlertBanner>
        </div>
      )}

      {banner}

      <div className="form-grid">
        {/* 등록 전에는 판 번호가 없다 — 서버가 채우는 값을 미리 지어내 보이지 않는다. */}
        {planVersion !== null && (
          <div>
            <span className="field-label" id={versionLabelId}>
              {t.fields.planVersion}
            </span>
            <p aria-labelledby={versionLabelId}>{t.values.version(planVersion)}</p>
          </div>
        )}

        {/*
         * 상태 값 목록이 확정되지 않았다는 사실을 감추지 않는다.
         * 안내는 **여기 한 번만** 낸다 — 버전 목록 표의 행마다 되풀이하면 좁은 페인에서 표가 읽히지 않는다.
         */}
        {status !== null && (
          <div className="field-cell">
            <span className="field-label" id={statusLabelId}>
              {t.fields.status}
            </span>
            <p aria-labelledby={statusLabelId}>
              <Chip variant="status" status={status.tone}>
                {status.label}
              </Chip>
            </p>
            <span className="field-note">{t.fieldNotes.statusTemporary}</span>
          </div>
        )}

        {/* DS에 DatePicker가 없다(고정 커밋 기준). 날짜 입력은 TextField의 date 형을 쓴다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={effectiveFromId} label={t.fields.effectiveFrom} required />
          <TextField
            id={effectiveFromId}
            type="date"
            value={values.effectiveFrom}
            onChange={(event) => onChange({ effectiveFrom: event.target.value })}
            disabled={isLocked}
            error={fieldErrors.effectiveFrom}
            aria-required
          />
        </div>

        {/* 유효종료는 「지정하지 않음」이 정상 값이라 필수 표시를 붙이지 않는다. */}
        <TextField
          type="date"
          label={t.fields.effectiveTo}
          value={values.effectiveTo}
          onChange={(event) => onChange({ effectiveTo: event.target.value })}
          disabled={isLocked}
          error={fieldErrors.effectiveTo}
        />

        <SelectField
          label={t.fields.samplingMethod}
          required
          options={ensureOption(SAMPLING_METHOD_OPTIONS, values.samplingMethodCode)}
          value={values.samplingMethodCode}
          onChange={(samplingMethodCode) => onChange({ samplingMethodCode })}
          disabled={isLocked}
          note={messages.pendingCode.note}
          error={fieldErrors.samplingMethodCode}
        />

        {/*
         * **개수다.** 라벨에 단위를 박고 아래에 한 줄 더 적는다 —
         * 착수 이슈 #12 §4·§6이 밝혔듯 확정 스펙은 비율 입력인데 저장 자리는 수량이라,
         * 라벨만으로는 30을 30%로 읽는 오해가 남는다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={samplingQtyId} label={t.fields.samplingQty} />
          <TextField
            id={samplingQtyId}
            type="number"
            min={0}
            value={values.samplingQty}
            onChange={(event) => onChange({ samplingQty: event.target.value })}
            disabled={isLocked}
            error={fieldErrors.samplingQty}
          />
          <span className="field-note">{t.fieldNotes.samplingQty}</span>
        </div>

        <TextField
          type="number"
          label={t.fields.aqlValue}
          value={values.aqlValue}
          onChange={(event) => onChange({ aqlValue: event.target.value })}
          disabled={isLocked}
          error={fieldErrors.aqlValue}
        />

        {/* 계약 CHECK ≥ 0 — 0이 허용된다. 불합격판정개수와 하한이 다르다. */}
        <TextField
          type="number"
          min={0}
          label={t.fields.acceptanceNumber}
          value={values.acceptanceNumber}
          onChange={(event) => onChange({ acceptanceNumber: event.target.value })}
          disabled={isLocked}
          error={fieldErrors.acceptanceNumber}
        />

        {/* 계약 CHECK > 0 — 0은 「없음」이 아니라 위반이다. */}
        <TextField
          type="number"
          min={1}
          label={t.fields.rejectionNumber}
          value={values.rejectionNumber}
          onChange={(event) => onChange({ rejectionNumber: event.target.value })}
          disabled={isLocked}
          error={fieldErrors.rejectionNumber}
        />

        <SelectField
          label={t.fields.inspectionFrequency}
          required
          options={ensureOption(INSPECTION_FREQUENCY_OPTIONS, values.inspectionFrequencyCode)}
          value={values.inspectionFrequencyCode}
          onChange={(inspectionFrequencyCode) => onChange({ inspectionFrequencyCode })}
          disabled={isLocked}
          note={messages.pendingCode.note}
          error={fieldErrors.inspectionFrequencyCode}
        />

        <TextField
          type="number"
          label={t.fields.frequencyIntervalValue}
          value={values.frequencyIntervalValue}
          onChange={(event) => onChange({ frequencyIntervalValue: event.target.value })}
          disabled={isLocked}
          error={fieldErrors.frequencyIntervalValue}
        />

        {/*
         * 계약이 이 코드를 `/mdm/uoms`와 잇지 않았다 — 형태가 같다고 화면이 이으면 지어내는 것이다.
         * 자리표시로 두고 안내를 붙인다.
         */}
        <SelectField
          label={t.fields.frequencyIntervalUom}
          options={ensureOption(FREQUENCY_INTERVAL_UOM_OPTIONS, values.frequencyIntervalUomCode)}
          value={values.frequencyIntervalUomCode}
          onChange={(frequencyIntervalUomCode) => onChange({ frequencyIntervalUomCode })}
          disabled={isLocked}
          note={messages.pendingCode.note}
          error={fieldErrors.frequencyIntervalUomCode}
        />
      </div>

      <div className="form-actions">
        {transitionActions}

        <Button variant="outlined" disabled={!isDirty || isLocked} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {/* 잠긴 상태에서는 고칠 수도 없지만, 잠금 직전에 고친 값이 남아 있을 수 있어 함께 막는다. */}
        <Button disabled={!isDirty || isSaving || isLocked} loading={isSaving} onClick={onSave}>
          {mode === 'create' ? t.actions.createVersion : messages.common.save}
        </Button>
      </div>
    </section>
  );
};
