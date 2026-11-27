import { Button, Dialog, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { CodeLockLabel, LockedFieldIcon } from '../../patterns/master';
import { requiredEmptyClass } from '../users-roles/required-empty';
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
  /**
   * **막을 것 — 전역이다.** 이 화면의 부서 저장은 한 번에 하나뿐이라(훅 하나에 요청 하나),
   * 다른 부서의 저장이 나가는 중이면 여기서도 새 저장을 시작할 수 없다. 두 번째를 내면
   * 앞 저장의 무효화·성공·**실패**가 통째로 오지 않는다. 등록과 수정이 **한 저장 자리**를 쓰므로
   * 두 훅 중 하나라도 나가는 중이면 잠긴다.
   *
   * **입력칸은 잠그지 않는다.** 늦게 온 성공이 **남의** 폼을 덮지 않도록 상위가 대상을 견주므로,
   * 남의 저장을 기다리는 동안 편집을 막을 이유가 없다. 다만 **자기 저장 중의 편집은 그 성공이
   * 서버 값으로 덮는다** — 구획 전체를 잠가 그 갈래를 아예 닫는 자격 구획과 갈리는 자리다
   * (D-6·D-7 · 입력칸마다 사유를 붙이는 비용을 치르지 않기로 한 판단이다).
   */
  isLocked: boolean;
  /**
   * **가릴 것 — 지금 이 구획의 저장인가.** 진행 표시는 자기 저장에만 돈다 —
   * 남의 저장으로 스피너를 돌리면 화면이 손댄 적 없는 부서를 「저장 중」이라고 말한다.
   */
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
  isLocked,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
}: DepartmentFormPaneProps) => {
  const codeId = useId();
  const nameId = useId();

  /* 저장 자리 이름 — 등록 팝업은 「추가」 이름, 수정은 「저장」. */
  const saveLabel = mode === 'create' ? t.actions.addDepartment : messages.common.save;

  /** 저장 자리. 잠긴 까닭을 단추 아래 문구로 내지 않는다 — 꺼진 단추로만(사용자 지시 2026-11-25). */
  const saveAction = (): ReactNode => {
    /* 내 저장이 나가는 중이면 진행 표시가 사유 자리를 대신한다. */
    if (isSaving) {
      return (
        <Button disabled loading>
          {saveLabel}
        </Button>
      );
    }

    /* 남의 저장이 나가는 중이다 — 잠그기만 한다. 저장 단추 아래 사유 문구는 두지 않는다(사용자 지시 2026-11-25). */
    if (isLocked) {
      return <Button disabled>{saveLabel}</Button>;
    }

    return (
      <Button disabled={!isDirty} onClick={onSave}>
        {saveLabel}
      </Button>
    );
  };

  const formGrid = (
    <div className="form-grid">
      {/*
       * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
       * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
       */}
      <div className="field-cell">
        {/* 잠긴 코드는 사유 문장 대신 칸 이름 오른쪽 「변경 불가」 라벨(사용자 지시 2026-11-24). */}
        <CodeLockLabel reason={codeLockReason} reasonId={`${codeId}-lock`}>
          <FieldLabel htmlFor={codeId} label={t.department.fields.departmentCode} required />
        </CodeLockLabel>
        <TextField
          id={codeId}
          value={values.departmentCode}
          placeholder={t.department.placeholders.departmentCode}
          onChange={(event) => onChange({ departmentCode: event.target.value })}
          disabled={codeLockReason !== null}
          trailingIcon={
            codeLockReason === null ? undefined : <LockedFieldIcon reason={codeLockReason} />
          }
          aria-describedby={codeLockReason === null ? undefined : `${codeId}-lock`}
          /* 필수 칸이 비면 빨간 테두리 — 사용자 역할 화면과 같은 방식(#333). 잠긴 칸은 고칠 수 없어 뺀다. */
          containerClassName={
            codeLockReason === null ? requiredEmptyClass(values.departmentCode) : undefined
          }
          error={fieldErrors.departmentCode}
          aria-required
        />
      </div>

      <div className="field-cell">
        <FieldLabel htmlFor={nameId} label={t.department.fields.departmentName} required />
        <TextField
          id={nameId}
          value={values.departmentName}
          placeholder={t.department.placeholders.departmentName}
          onChange={(event) => onChange({ departmentName: event.target.value })}
          containerClassName={requiredEmptyClass(values.departmentName)}
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
        /* 등록 팝업에서는 잠긴 까닭 문장을 내지 않는다 — 꺼진 칸으로만(사용자 지시 · #360). */
        disabledReason={mode === 'create' ? undefined : (parentDisabledReason ?? undefined)}
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
  );

  /*
   * 등록은 팝업 — 사용자 추가 팝업과 같은 모양(사용자 지시 2026-11-25 · #333). 열고 닫힘은 종전대로 주소의 등록 상태가
   * 쥐고, 닫기(취소)는 등록 폼을 접는 같은 처리로 간다. 저장 자리 세 상태(진행 · 잠금 · 고친 것 없음)도 그대로다.
   */
  if (mode === 'create') {
    return (
      <Dialog
        className="dialog-icon-add"
        open
        onClose={onCancel}
        size="lg"
        title={t.actions.addDepartment}
        closeOnBackdropClick={false}
        showCloseButton={false}
        footer={
          <>
            <Button variant="outlined" onClick={onCancel}>
              {messages.common.cancel}
            </Button>
            {saveAction()}
          </>
        }
      >
        {banner}
        {formGrid}
      </Dialog>
    );
  }

  return (
    <section className="pane" aria-label={t.panes.departmentForm}>
      {/*
       * 사용자 관리 상세와 같은 머리 — 제목 줄 오른쪽에 「사용 중지」(사용자 지시 2026-11-24). 폼 값 저장과 따로 서버에
       * 바로 나가는 작업이라 아래 「취소 · 저장」과 떨어져 선다.
       */}
      <div className="pane-heading-row users-roles-heading">
        <h3 className="pane-title">{t.panes.departmentForm}</h3>
        <div className="users-roles-account-actions">
          <Button
            variant="outlined"
            size="sm"
            disabled={deactivateDisabledReason !== null}
            title={deactivateDisabledReason ?? undefined}
            leadingIcon={<Icon name="block" size={18} />}
            onClick={onDeactivate}
          >
            {messages.common.deactivate}
          </Button>
        </div>
      </div>
      {banner}

      {formGrid}

      <div className="form-actions">
        {/* 수정에서 「취소」는 **기준값으로 되돌리는 것**이라 고친 것이 있을 때만 의미가 있다. */}
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {saveAction()}
      </div>
    </section>
  );
};
