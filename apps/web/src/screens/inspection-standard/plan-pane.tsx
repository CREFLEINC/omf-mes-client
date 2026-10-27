import { Button, Checkbox, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { INSPECTION_TYPE_OPTIONS, ensureOption } from './code-options';
import { FieldLabel } from './field-label';
import { formatApprovedAt } from './plan-mappers';
import { SelectField } from './select-field';
import type { InspectionPlan, PlanFormValues, SelectOption } from './types';

const t = messages.inspectionStandard;

export type PlanPaneMode = 'edit' | 'create';

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
  /** 버전 고르기 줄 — 기준 상세에 합쳐 둔다(omf-all-around#196). 등록 폼에는 없다 */
  versionSlot?: ReactNode;
  /** 「기본 정보 수정」 창 안이다 — 창 제목이 머리를 맡아 제목 · 칩을 두지 않는다(#196). */
  embedded?: boolean;
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
  versionSlot,
  embedded = false,
}: PlanPaneProps) => {
  const codeId = useId();
  const nameId = useId();

  const approvedAt = formatApprovedAt(plan?.approvedAt);
  /* 바꿀 수 없는 칸에는 필수 표시를 두지 않는다 — 고칠 수 없는 칸에 「꼭 채우라」는 뜻이 없다(사용자 지시 · #196). */
  const isCodeLocked = codeLockReason !== null;

  return (
    <section
      className={`${embedded ? '' : 'pane '}inspection-standard-plan-pane`}
      aria-label={t.panes.planForm}
    >
      {/*
       * 머리 — 제목과 승인 · 사용 상태 칩(omf-all-around#196). 둘 다 전용 액션으로만 바뀌어 값 표기로만 낸다.
       * 등록 전에는 서버가 채우는 값이 없어 칩을 지어내지 않는다.
       */}
      {!embedded && (
        <div className="inspection-standard-plan-head">
          <h2 className="pane-title">
            {mode === 'create' ? t.detail.createTitle : t.detail.title}
          </h2>
          {mode === 'edit' && plan !== null && (
            <div className="inspection-standard-plan-chips">
              <Chip variant="status" status={approvedAt === null ? 'warning' : 'success'}>
                {approvedAt === null ? t.detail.chipNotApproved : t.values.approvedAt(approvedAt)}
              </Chip>
              <Chip variant="status" status={plan.isActive ? 'success' : 'idle'}>
                {plan.isActive ? t.detail.chipActive : t.detail.chipInactive}
              </Chip>
            </div>
          )}
        </div>
      )}

      {optionsNotice}
      {banner}

      <div className="form-grid">
        {/*
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
         */}
        <div className="field-cell">
          <FieldLabel
            htmlFor={codeId}
            label={t.fields.inspectionPlanCode}
            required={!isCodeLocked}
          />
          <TextField
            id={codeId}
            value={values.inspectionPlanCode}
            onChange={(event) => onChange({ inspectionPlanCode: event.target.value })}
            disabled={isCodeLocked}
            disabledReason={codeLockReason}
            error={fieldErrors.inspectionPlanCode}
            aria-required={!isCodeLocked}
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
          placeholder={t.values.empty}
          onChange={(processId) => onChange({ processId })}
          error={fieldErrors.processId}
        />

        <SelectField
          label={t.fields.routing}
          options={[{ value: '', label: t.values.empty }, ...routingOptions]}
          value={values.routingId}
          placeholder={t.values.empty}
          onChange={(routingId) => onChange({ routingId })}
          disabled={routingDisabledReason !== null}
          disabledReason={routingDisabledReason ?? undefined}
          error={fieldErrors.routingId}
        />

        {/* PQC 생략 허용(omf-all-around#119) — PQC 기준에만 선다. 켜면 이 기준으로 배포한 W/O 의 PQC 가 생략된다. */}
        {values.inspectionTypeCode === 'PQC' && (
          <div className="field-cell">
            <Checkbox
              checked={values.pqcSkipAllowed}
              onChange={(event) => onChange({ pqcSkipAllowed: event.target.checked })}
            >
              {t.fields.pqcSkipAllowed}
            </Checkbox>
            <p className="field-note">{t.values.pqcSkipAllowedNote}</p>
          </div>
        )}
      </div>

      {versionSlot}

      {/* 아래 단추 줄 — 구분선 아래, 왼쪽 승인 · 사용 중지, 오른쪽 취소 · 저장(#196). */}
      <div className="form-actions inspection-standard-plan-footer">
        <div className="inspection-standard-plan-footer-start">{transitionActions}</div>

        {/* 창 안에서는 「취소」가 창을 닫는 길이라 늘 누를 수 있다(고친 값은 버린다 · #196). */}
        <Button variant="outlined" disabled={!embedded && !isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {mode === 'create' ? t.actions.addPlan : messages.common.save}
        </Button>
      </div>
    </section>
  );
};
