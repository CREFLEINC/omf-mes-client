import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { pendingCodeOptions } from './code-options';
import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { SelectOption, UserFormValues } from './types';

const t = messages.usersRoles;

export type UserFormMode = 'create' | 'edit';

export interface UserFormPaneProps {
  /** `create`면 아직 없는 사용자를 만드는 폼이다 — 사용 중지가 없고 주 액션이 등록이다. */
  mode: UserFormMode;
  values: UserFormValues;
  onChange: (patch: Partial<UserFormValues>) => void;
  /** 필드별 인라인 오류 — 로컬 검증 결과와 서버 필드 오류를 상위가 병합해 넘긴다. */
  fieldErrors: Record<string, string>;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  departmentOptions: SelectOption[];
  /** null이면 사용 중지를 누를 수 있다. 값이 있으면 그것이 비활성 사유다. */
  deactivateDisabledReason: string | null;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
}

/** 라벨과 값 한 쌍. **폼 컨트롤이 아니다** — 잠긴 입력칸은 「언젠가 열린다」는 뜻이 된다. */
const ValueField = ({ label, value, note }: { label: string; value: string; note: string }) => {
  const labelId = useId();
  const noteId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId} aria-describedby={noteId}>
        {value}
      </p>
      <span id={noteId} className="field-note">
        {note}
      </span>
    </div>
  );
};

/**
 * 우 칸 위쪽 — 사용자 정보.
 *
 * **로그인 ID는 등록에서만 입력칸이다.** 계약의 수정 요청 본문에 그 키가 **아예 없어**
 * 보낼 자리가 없다 — 잠긴 입력칸으로 두면 「언젠가 열린다」는 뜻이 되므로 값 표기로 둔다
 * (배치 규범 3이 정한 처리 · 계획 결정 10).
 *
 * **상태는 두 모드 모두 비활성 + 사유다.** 값 목록이 확정되지 않아 고를 값이 없다.
 * 수정에서는 서버가 준 값이 그대로 보이고 그대로 되돌아 나가며, 등록에서는 서버가 채운다.
 *
 * **사용 여부를 입력칸으로 두지 않는다.** 전용 액션(`:deactivate`)으로만 바뀌므로
 * 입력칸을 두면 저장 본문에 실릴 여지가 생긴다.
 */
export const UserFormPane = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  departmentOptions,
  deactivateDisabledReason,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
}: UserFormPaneProps) => {
  const loginIdId = useId();
  const userNameId = useId();
  const emailId = useId();
  const saveLabel = mode === 'create' ? t.actions.addUser : messages.common.save;

  return (
    <section className="pane" aria-label={t.panes.userForm}>
      {banner}

      <div className="form-grid">
        {mode === 'create' ? (
          /*
           * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
           * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
           */
          <div className="field-cell">
            <FieldLabel htmlFor={loginIdId} label={t.user.fields.loginId} required />
            <TextField
              id={loginIdId}
              value={values.loginId}
              onChange={(event) => onChange({ loginId: event.target.value })}
              error={fieldErrors.loginId}
              aria-required
            />
          </div>
        ) : (
          <ValueField
            label={t.user.fields.loginId}
            value={values.loginId}
            note={t.actionReasons.loginIdLocked}
          />
        )}

        <div className="field-cell">
          <FieldLabel htmlFor={userNameId} label={t.user.fields.userName} required />
          <TextField
            id={userNameId}
            value={values.userName}
            onChange={(event) => onChange({ userName: event.target.value })}
            error={fieldErrors.userName}
            aria-required
          />
        </div>

        {/*
         * 규범 3-2 — 「SYN-DEPT-01 · 합성 부서 A」는 트리거 폭에 갇혀 잘린다.
         * 계약이 널을 허용하므로 선택지에 빈 값을 두어 다시 비울 수 있게 한다.
         */}
        <SelectField
          label={t.user.fields.department}
          wide
          options={departmentOptions}
          value={values.departmentId}
          onChange={(value) => onChange({ departmentId: value })}
          error={fieldErrors.departmentId}
        />

        {/* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={emailId} label={t.user.fields.email} />
          <TextField
            id={emailId}
            value={values.email}
            onChange={(event) => onChange({ email: event.target.value })}
            error={fieldErrors.email}
          />
        </div>

        {/*
         * 상태는 **비활성 + 사유**다(배치 규범 4). 등록과 수정의 사유가 다르다 —
         * 등록에서는 서버가 기본값으로 채우고, 수정에서는 받은 값이 그대로 유지된다.
         * 문구가 짧아 `.wide-select`를 붙이지 않는다.
         */}
        <SelectField
          label={t.user.fields.status}
          options={pendingCodeOptions(values.statusCode)}
          value={values.statusCode}
          onChange={() => undefined}
          disabled
          disabledReason={
            mode === 'create'
              ? t.actionReasons.statusFieldOnCreate
              : t.actionReasons.statusFieldPending
          }
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

        {/*
         * 고친 것이 없으면 주 액션을 **비활성 + 사유**로 둔다(배치 규범 4) —
         * 사유가 없으면 사용자는 버튼이 왜 안 눌리는지 알 방법이 없다.
         * 저장 중에는 진행 표시가 그 자리를 대신하므로 사유를 내지 않는다.
         */}
        {isDirty || isSaving ? (
          <Button disabled={isSaving} loading={isSaving} onClick={onSave}>
            {saveLabel}
          </Button>
        ) : (
          <DisabledAction
            variant="filled"
            label={saveLabel}
            reason={mode === 'create' ? t.actionReasons.addNoInput : t.actionReasons.saveNoChanges}
          />
        )}
      </div>
    </section>
  );
};
