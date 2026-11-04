import { Button, Checkbox, Chip, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId } from 'react';

import { ItemSelect } from '../../patterns/item-select';

import { INSPECTION_TYPE_OPTIONS, ensureOption } from './code-options';
import { FieldLabel } from './field-label';
import { formatApprovedAt } from './plan-mappers';
import { resolveVersionStatus } from './plan-version-status';
import type { RoutingRevision } from './queries';
import { SelectField } from './select-field';
import type { InspectionPlan, PlanFormValues, SelectOption } from './types';

const t = messages.inspectionStandard;

/** 품목 칸 맨 앞 — 비우면 「전 품목 공통」 기준이다. */
const ALL_ITEMS = [{ value: '', label: t.values.allItems }];

export type PlanPaneMode = 'edit' | 'create';

export interface PlanPaneProps {
  /** `create`면 아직 없는 기준을 만드는 폼이다 — 승인·사용 여부가 없고 주 액션이 등록이다. */
  mode: PlanPaneMode;
  /** 저장된 기준. 등록 폼에서는 null이며, 승인 여부·사용 여부를 값 표기로 낼 근거가 된다. */
  plan: InspectionPlan | null;
  values: PlanFormValues;
  onChange: (patch: Partial<PlanFormValues>) => void;
  /** 라우팅을 자동으로 채울 때 부른다. 없으면 `onChange` 로 넣는다. */
  onRoutingRefresh?: (routingId: string) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  itemOptions: SelectOption[];
  processOptions: SelectOption[];
  /** 그 품목의 라우팅 Rev 들 — 채운 Rev 를 코드 · 버전 · 상태로 보인다. */
  routingRevisions: RoutingRevision[];
  /** 라우팅 칸에 채울 값 — 그 품목의 작성 중 최신 Rev, 없으면 확정 최신 Rev(사용자 지시 2026-11-04). 받는 중이면 undefined, 없으면 null. */
  autoRoutingId?: string | null | undefined;
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
  onRoutingRefresh,
  fieldErrors,
  banner,
  optionsNotice,
  itemOptions,
  processOptions,
  routingRevisions,
  autoRoutingId,
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
  const codeLockNoteId = useId();
  const nameId = useId();
  const itemId = useId();
  const itemErrorId = useId();
  const itemOption = itemOptions.find((option) => option.value === values.itemId) ?? null;
  const routingId = useId();
  const routingHintId = useId();
  const isRoutingShown = routingDisabledReason === null;

  /*
   * 비어 있는 필수 칸은 처음부터 테두리만 빨갛게 한다(사용자 지시 2026-11-04) — 「필수 입력 항목입니다」 글은 화면에
   * 띄우지 않고 화면 읽기로만 남긴다. 검사 항목 추가 창(item-form-dialog)과 같은 규칙이고, 다른 오류(중복 등)는 글로 낸다.
   */
  const requiredMessage = t.validation.required;
  const isBlank = (value: string): boolean => value.trim() === '';
  const shownError = (key: string): string | undefined =>
    fieldErrors[key] === requiredMessage ? undefined : fieldErrors[key];
  const requiredText = (key: string, value: string) => {
    const error = shownError(key);
    if (error !== undefined) return { error };
    return isBlank(value)
      ? { error: requiredMessage, containerClassName: 'inspection-standard-border-only' }
      : {};
  };
  const isPqc = values.inspectionTypeCode === 'PQC';

  /*
   * 라우팅은 고르지 않고 자동으로 채운다(사용자 지시 2026-11-04) — 작성 중 최신 Rev, 없으면 확정 최신 Rev.
   * 이미 저장된 기준도 창을 열면 지금 Rev 로 다시 채운다. 품목을 비우면 라우팅도 비운다.
   */
  useEffect(() => {
    const refresh = onRoutingRefresh ?? ((routingId: string) => onChange({ routingId }));
    if (values.itemId === '') {
      if (values.routingId !== '') refresh('');
      return;
    }
    if (autoRoutingId === undefined) return;
    const next = autoRoutingId ?? '';
    if (values.routingId !== next) refresh(next);
  }, [values.itemId, values.routingId, autoRoutingId, onChange, onRoutingRefresh]);

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
        {/* 첫 줄 — 기본 생략 | 기준코드 · 기준명(사용자 시안 2026-11-04). */}
        <div className="inspection-standard-plan-head-row">
          {/* 기본 생략(omf-all-around#212) — 검사 유형을 고르면 IQC·PQC·OQC 모두 선다. */}
          {values.inspectionTypeCode !== '' && (
            <div className="inspection-standard-plan-skip">
              <Checkbox
                checked={values.defaultSkip}
                onChange={(event) => onChange({ defaultSkip: event.target.checked })}
              >
                {t.fields.defaultSkip}
              </Checkbox>
            </div>
          )}

          <div className="field-cell">
            <FieldLabel
              htmlFor={codeId}
              label={t.fields.inspectionPlanCode}
              required={!isCodeLocked}
              {...(codeLockReason !== null ? { hint: codeLockReason, hintId: codeLockNoteId } : {})}
            />
            <TextField
              id={codeId}
              value={values.inspectionPlanCode}
              onChange={(event) => onChange({ inspectionPlanCode: event.target.value })}
              disabled={isCodeLocked}
              /* 잠긴 칸은 자물쇠 표시 + 라벨 오른쪽 짧은 안내(사용자 시안 · #208 · 2026-11-04 라벨 옆으로). */
              trailingIcon={isCodeLocked ? <Icon name="lock" size={18} aria-hidden /> : undefined}
              aria-describedby={isCodeLocked ? codeLockNoteId : undefined}
              {...(isCodeLocked
                ? { error: fieldErrors.inspectionPlanCode }
                : requiredText('inspectionPlanCode', values.inspectionPlanCode))}
              aria-required={!isCodeLocked}
            />
          </div>

          <div className="field-cell">
            <FieldLabel htmlFor={nameId} label={t.fields.inspectionPlanName} required />
            <TextField
              id={nameId}
              value={values.inspectionPlanName}
              onChange={(event) => onChange({ inspectionPlanName: event.target.value })}
              {...requiredText('inspectionPlanName', values.inspectionPlanName)}
              aria-required
            />
          </div>
        </div>

        {/* 둘째 줄 — 검사 유형 · 공정(사용자 시안 2026-11-04). */}
        <SelectField
          label={t.fields.inspectionType}
          required
          options={ensureOption(INSPECTION_TYPE_OPTIONS, values.inspectionTypeCode)}
          value={values.inspectionTypeCode}
          onChange={(inspectionTypeCode) => onChange({ inspectionTypeCode })}
          error={shownError('inspectionTypeCode')}
          invalid={isBlank(values.inspectionTypeCode)}
        />

        {/* IQC · OQC 는 공정을 비워도 된다 — PQC 만 필수다. */}
        <SelectField
          label={t.fields.process}
          /* PQC 기준은 공정이 필수다 — 필수 표시 · 이름 오른쪽 안내 · 빈 칸 빨간 테두리(사용자 지시 2026-11-04). */
          required={isPqc}
          {...(isPqc ? { hint: t.actionReasons.pqcNeedsProcess } : {})}
          options={[{ value: '', label: t.values.notSelected }, ...processOptions]}
          value={values.processId}
          placeholder={t.values.notSelected}
          onChange={(processId) => onChange({ processId })}
          error={shownError('processId')}
          invalid={isPqc && isBlank(values.processId)}
        />

        {/* 셋째 줄 — 품목 · 라우팅(사용자 지시 2026-11-04). */}
        {/*
         * 비우면 「전 품목 공통 기준」이다 — 계약이 널을 허용한다.
         * 품목은 **칸에서 바로 검색해서 고른다**(사용자 지시 2026-11-04 — 품목 선택 창을 띄우지 않는다).
         * 검색어는 서버로 가 뒤쪽 품목도 찾는다. 조회 줄의 품목 조건과 같은 부품이고, 맨 앞 「전 품목 공통」이 비우는 자리다.
         */}
        <div className="field-cell search-select-cell">
          {/* 품목을 고르기 전에는 라우팅 칸 대신 품목 이름 오른쪽에 안내를 둔다(사용자 지시 2026-11-04). */}
          <FieldLabel
            htmlFor={itemId}
            label={t.fields.item}
            {...(routingDisabledReason !== null
              ? { hint: routingDisabledReason, hintId: routingHintId }
              : {})}
          />
          <ItemSelect
            id={itemId}
            selectedOption={itemOption}
            leadingOptions={ALL_ITEMS}
            value={values.itemId}
            placeholder={t.values.allItems}
            onChange={(value) => onChange({ itemId: value })}
            invalid={fieldErrors.itemId !== undefined}
            aria-describedby={fieldErrors.itemId === undefined ? undefined : itemErrorId}
          />
          {fieldErrors.itemId !== undefined && (
            <span id={itemErrorId} className="field-error">
              {fieldErrors.itemId}
            </span>
          )}
        </div>

        {/*
         * 라우팅은 품목에 딸려 있다 — 품목을 고르기 전에는 칸 전체를 두지 않는다(안내는 품목 이름 오른쪽).
         * 고르는 칸이 아니라 자동으로 채운 Rev 를 글자로만 보인다(사용자 지시 2026-11-04).
         */}
        {isRoutingShown && (
          <div className="field-cell">
            <span className="field-label" id={routingId}>
              {t.fields.routing}
            </span>
            {/* 입력칸 모양도 두지 않는다 — 값 글자만(사용자 지시 2026-11-04). */}
            <p className="inspection-standard-plan-routing" aria-labelledby={routingId}>
              <RoutingSummary
                revision={routingRevisions.find(
                  (revision) => revision.routingId === values.routingId,
                )}
              />
            </p>
            {fieldErrors.routingId !== undefined && (
              <span className="field-error">{fieldErrors.routingId}</span>
            )}
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

/** 라우팅 코드 · 버전 글자와 상태 칩(사용자 지시 2026-11-04 — 상태는 라벨 형식). 기준 상세 머리도 쓴다. */
export const RoutingSummary = ({ revision }: { revision: RoutingRevision | undefined }) => {
  if (revision === undefined) return <>-</>;
  const status = resolveVersionStatus(revision.statusCode);
  return (
    <>
      <span>{t.values.routingSummary(revision.routingCode, revision.routingVersion)}</span>
      <Chip variant="status" size="sm" status={status.tone}>
        {status.label}
      </Chip>
    </>
  );
};
