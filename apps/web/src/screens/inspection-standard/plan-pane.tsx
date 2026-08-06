import { Button, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { INSPECTION_TYPE_OPTIONS, ensureOption } from './code-options';
import { FieldLabel } from './field-label';
import { formatApprovedAt } from './plan-mappers';
import type { InspectionPlan, PlanFormValues, SelectOption } from './types';

const t = messages.inspectionStandard;

export type PlanPaneMode = 'edit' | 'create';

interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** 비활성 사유. DS `Select`에는 `disabledReason`이 없어 화면이 직접 붙인다(배치 규범 4). */
  disabledReason?: string;
  error?: string;
  placeholder?: string;
}

/**
 * 디자인 시스템 `Select`에는 `label` prop이 없다(배치 규범 3) — 라벨을 직접 만들되
 * 내장 라벨과 같은 토큰을 써 라벨 층 높이를 맞춘다.
 *
 * 비활성 사유도 `TextField`와 달리 내장 자리가 없어 여기서 붙이고 `aria-describedby`로 잇는다.
 * 비활성 컨트롤은 포커스를 받지 못해 사유를 시각으로만 두면 보조기술이 닿을 수 없다.
 */
const SelectField = ({
  label,
  options,
  value,
  onChange,
  required = false,
  disabled = false,
  disabledReason,
  error,
  placeholder,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? (disabled ? disabledReason : undefined);

  return (
    <div className="field-cell">
      <FieldLabel htmlFor={id} label={label} required={required} />
      <Select
        id={id}
        options={options}
        value={value === '' ? null : value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        invalid={error !== undefined}
        aria-required={required || undefined}
        aria-describedby={note === undefined ? undefined : noteId}
      />
      {note !== undefined && (
        <span id={noteId} className={error === undefined ? 'field-note' : 'field-error'}>
          {note}
        </span>
      )}
    </div>
  );
};

export interface PlanPaneProps {
  /** `create`면 아직 없는 기준을 만드는 폼이다 — 승인·사용 여부가 없고 주 액션이 등록이다. */
  mode: PlanPaneMode;
  /** 저장된 기준. 등록 폼에서는 null이며, 승인 여부·사용 여부를 값 표기로 낼 근거가 된다. */
  plan: InspectionPlan | null;
  values: PlanFormValues;
  onChange: (patch: Partial<PlanFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  itemOptions: SelectOption[];
  processOptions: SelectOption[];
  routingOptions: SelectOption[];
  /**
   * 라우팅을 고를 수 없는 사유. null이면 고를 수 있다.
   * 계약의 라우팅 조회가 품목을 필수로 두어 「전 품목 공통 기준」에는 이을 라우팅이 없다.
   */
  routingDisabledReason: string | null;
  /** null이면 기준코드를 편집할 수 있다. */
  codeLockReason: string | null;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** 승인·사용 중지 액션 슬롯. 이 구획 밖의 사실이 조건에 들어가 화면이 판정한다 */
  transitionActions?: ReactNode;
}

/**
 * 우 상단 — 기준 헤더.
 *
 * **승인 여부와 사용 여부는 값 표기로만 낸다.** 둘 다 전용 액션(`:approve`·`:deactivate`)으로만
 * 바뀌므로 입력칸을 두면 저장 본문에 실릴 여지가 생긴다.
 *
 * **승인자 이름을 만들지 않는다** — 계약이 주는 것은 사용자 번호이고 이름을 만들려면
 * 이 화면의 관심사가 아닌 사용자 조회가 필요하다. 승인 여부와 승인 시각만 낸다.
 */
export const PlanPane = ({
  mode,
  plan,
  values,
  onChange,
  fieldErrors,
  banner,
  optionsNotice,
  itemOptions,
  processOptions,
  routingOptions,
  routingDisabledReason,
  codeLockReason,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  transitionActions,
}: PlanPaneProps) => {
  const codeId = useId();
  const nameId = useId();
  const approvalLabelId = useId();
  const activeLabelId = useId();

  const approvedAt = formatApprovedAt(plan?.approvedAt);

  return (
    <section className="pane" aria-label={t.panes.planForm}>
      {optionsNotice}
      {banner}

      <div className="form-grid">
        {/*
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={codeId} label={t.fields.inspectionPlanCode} required />
          <TextField
            id={codeId}
            value={values.inspectionPlanCode}
            onChange={(event) => onChange({ inspectionPlanCode: event.target.value })}
            disabled={codeLockReason !== null}
            disabledReason={codeLockReason}
            error={fieldErrors.inspectionPlanCode}
            aria-required
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={nameId} label={t.fields.inspectionPlanName} required />
          <TextField
            id={nameId}
            value={values.inspectionPlanName}
            onChange={(event) => onChange({ inspectionPlanName: event.target.value })}
            error={fieldErrors.inspectionPlanName}
            aria-required
          />
        </div>

        <SelectField
          label={t.fields.inspectionType}
          required
          options={ensureOption(INSPECTION_TYPE_OPTIONS, values.inspectionTypeCode)}
          value={values.inspectionTypeCode}
          onChange={(inspectionTypeCode) => onChange({ inspectionTypeCode })}
          error={fieldErrors.inspectionTypeCode}
        />

        {/* 비우면 「전 품목 공통 기준」이다 — 계약이 널을 허용한다. */}
        <SelectField
          label={t.fields.item}
          options={[{ value: '', label: t.values.allItems }, ...itemOptions]}
          value={values.itemId}
          onChange={(itemId) => onChange({ itemId })}
          error={fieldErrors.itemId}
        />

        {/* IQC 에는 공정이 없다 — 비우는 것이 정상 값이다. */}
        <SelectField
          label={t.fields.process}
          options={[{ value: '', label: t.values.empty }, ...processOptions]}
          value={values.processId}
          onChange={(processId) => onChange({ processId })}
          error={fieldErrors.processId}
        />

        <SelectField
          label={t.fields.routing}
          options={[{ value: '', label: t.values.empty }, ...routingOptions]}
          value={values.routingId}
          onChange={(routingId) => onChange({ routingId })}
          disabled={routingDisabledReason !== null}
          disabledReason={routingDisabledReason ?? undefined}
          error={fieldErrors.routingId}
        />

        {/*
         * 등록 전에는 승인·사용 여부가 없다 — 서버가 채우는 값을 미리 지어내 보이지 않는다.
         * 값을 보여 주기만 하는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다.
         */}
        {mode === 'edit' && plan !== null && (
          <>
            <div>
              <span className="field-label" id={approvalLabelId}>
                {t.fields.approval}
              </span>
              <p aria-labelledby={approvalLabelId}>
                {approvedAt === null ? t.values.notApproved : t.values.approvedAt(approvedAt)}
              </p>
            </div>

            <div>
              <span className="field-label" id={activeLabelId}>
                {t.fields.active}
              </span>
              <p aria-labelledby={activeLabelId}>
                {plan.isActive ? t.values.active : t.values.inactive}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="form-actions">
        {transitionActions}

        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {mode === 'create' ? t.actions.addPlan : messages.common.save}
        </Button>
      </div>
    </section>
  );
};
