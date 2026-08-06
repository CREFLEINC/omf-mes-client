import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { DepartmentFormValues, SelectOption } from './types';

const t = messages.commonCode;

export type DepartmentFormMode = 'create' | 'edit';

export interface DepartmentFormPaneProps {
  /** `create`면 아직 없는 부서를 만드는 폼이다 — 사용 중지가 없고 주 액션이 등록이다. */
  mode: DepartmentFormMode;
  values: DepartmentFormValues;
  onChange: (patch: Partial<DepartmentFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯. 순환 참조 400도 여기로 온다 */
  banner: ReactNode;
  /** null이면 부서코드를 편집할 수 있다. */
  codeLockReason: string | null;
  /** null이면 사용 중지를 누를 수 있다. 값이 있으면 그것이 비활성 사유다. */
  deactivateDisabledReason: string | null;
  /**
   * 상위로 고를 수 있는 부서. **자기 자신만 빠져 있고 후손은 남아 있다** —
   * 순환은 계약이 서버 소관으로 정했다.
   */
  parentOptions: SelectOption[];
  /** null이면 상위 부서를 고를 수 있다. 값이 있으면 그것이 비활성 사유다 */
  parentDisabledReason: string | null;
  businessUnitOptions: SelectOption[];
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
}

/**
 * 우 칸 — 부서 정보.
 *
 * **사용 여부를 입력칸으로 두지 않는다.** 전용 액션(`:deactivate`)으로만 바뀌므로
 * 입력칸을 두면 저장 본문에 실릴 여지가 생긴다.
 *
 * **부서코드의 잠금은 서버가 준 편집 가능 여부만 읽는다.** 화면이 스스로 판정하지 않는다 —
 * 상위(`screen.tsx`)가 만든 사유를 그대로 받는다.
 *
 * ⚠ 수신본 편집 잠금이 서버에서 강제되지 않는다.
 *    수신본을 판정할 컬럼이 아직 없어(omf-mes#65) 이 자원은 잠정적으로 마스터 형(전 필드 편집
 *    가능)으로 열려 있다. 화면은 서버가 주는 편집 가능 여부만 읽고 스스로 잠그지 않는다 —
 *    화면이 먼저 잠그면 컬럼이 생겨 서버가 잠금을 열어 줄 때 화면만 잠긴 채 남는다.
 *    컬럼이 생기면 서버가 그 값으로 잠그고 이 주석을 걷는다.
 */
export const DepartmentFormPane = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  deactivateDisabledReason,
  parentOptions,
  parentDisabledReason,
  businessUnitOptions,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
}: DepartmentFormPaneProps) => {
  const codeId = useId();
  const nameId = useId();

  return (
    <section className="pane" aria-label={t.panes.departmentForm}>
      {banner}

      <div className="form-grid">
        {/*
         * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
         * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={codeId} label={t.department.fields.departmentCode} required />
          <TextField
            id={codeId}
            value={values.departmentCode}
            onChange={(event) => onChange({ departmentCode: event.target.value })}
            disabled={codeLockReason !== null}
            disabledReason={codeLockReason}
            error={fieldErrors.departmentCode}
            aria-required
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={nameId} label={t.department.fields.departmentName} required />
          <TextField
            id={nameId}
            value={values.departmentName}
            onChange={(event) => onChange({ departmentName: event.target.value })}
            error={fieldErrors.departmentName}
            aria-required
          />
        </div>

        {/*
         * 비우는 것이 정상 값이다 — 계약이 널을 허용하고 그것이 곧 뿌리 부서다.
         * 폼 그리드 안이라 규범 3-1이 이미 칸 폭에 맞춰 늘려 준다(`.wide-select`를 붙이지 않는다).
         */}
        <SelectField
          label={t.department.fields.parentDepartment}
          options={[{ value: '', label: t.department.values.noParent }, ...parentOptions]}
          value={values.parentDepartmentId}
          onChange={(value) => onChange({ parentDepartmentId: value })}
          disabled={parentDisabledReason !== null}
          disabledReason={parentDisabledReason ?? undefined}
          error={fieldErrors.parentDepartmentId}
        />

        <SelectField
          label={t.department.fields.businessUnit}
          options={[{ value: '', label: t.values.empty }, ...businessUnitOptions]}
          value={values.businessUnitId}
          onChange={(value) => onChange({ businessUnitId: value })}
          error={fieldErrors.businessUnitId}
        />
      </div>

      <div className="form-actions">
        {/*
         * 등록 폼에는 사용 중지 자리를 두지 않는다 — 아직 없는 자원이라
         * 「언젠가 풀린다」가 아니라 애초에 해당하지 않는 액션이다.
         */}
        {mode === 'edit' &&
          (deactivateDisabledReason === null ? (
            <div className="field-cell form-actions-secondary">
              <Button variant="outlined" onClick={onDeactivate}>
                {messages.common.deactivate}
              </Button>
            </div>
          ) : (
            <DisabledAction
              label={messages.common.deactivate}
              reason={deactivateDisabledReason}
              className="form-actions-secondary"
            />
          ))}

        {/*
         * 등록에서 「취소」는 **폼을 닫는 것**이라 고친 것이 없어도 눌러야 한다.
         * 수정에서는 **기준값으로 되돌리는 것**이라 고친 것이 있을 때만 의미가 있다.
         */}
        <Button variant="outlined" disabled={mode === 'edit' && !isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {mode === 'create' ? t.actions.addDepartment : messages.common.save}
        </Button>
      </div>
    </section>
  );
};
