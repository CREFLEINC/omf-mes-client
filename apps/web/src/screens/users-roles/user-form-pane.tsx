import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import { INITIAL_PASSWORD_MIN_LENGTH } from './initial-password';
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
  statusOptions: SelectOption[];
  /** null이면 상태를 고를 수 있다. 값이 있으면 조회 상태에 따른 비활성 사유다. */
  statusDisabledReason: string | null;
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
 * **초기 비밀번호도 등록에서만 있는 칸이다** — 같은 근거(수정 본문에 그 키가 없다)이지만 처리가
 * 반대다. 로그인 ID는 수정에서 **값으로 보여 주고**, 초기 비밀번호는 수정에서 **아예 없다**.
 * 보여 줄 값이 아니기 때문이다 — 서버가 돌려주지 않고, 돌려준다 해도 화면에 낼 값이 아니다.
 *
 * 상태는 `APP_USER_STATUS` 조회값에서 고른다. 조회 실패·로딩·빈 목록일 때만 그 칸을 잠그고,
 * 사용자 정보의 다른 필드는 그대로 편집할 수 있게 둔다.
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
  statusOptions,
  statusDisabledReason,
  deactivateDisabledReason,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
}: UserFormPaneProps) => {
  const loginIdId = useId();
  /*
   * 초기 비밀번호 칸은 등록에서만 서지만 **id 는 조건 밖에서 받는다** — `useId`는 훅이라
   * 부르는 차례가 렌더마다 같아야 한다. 조건 안에서 부르면 모드가 바뀌는 순간 훅 차례가 어긋난다.
   */
  const passwordId = useId();
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
              /*
               * ⛔ **아래 비밀번호 칸이 생기면서 이 줄이 필요해졌다.** 두 칸을 나란히 두면
               *    브라우저가 「아이디 + 비밀번호」를 **이 출처의 자격증명 쌍**으로 읽고 저장을
               *    권할 수 있다. 그것을 누르면 **관리자 자신의** 저장된 비밀번호가 남의 초기
               *    비밀번호로 바뀐다. 비밀번호 칸의 `new-password` 는 «채우기»를 막을 뿐
               *    «저장 권유»를 막지 못하므로 이 칸에서도 신호를 준다.
               *
               * ⚠ 브라우저가 이 값을 무시하는 일이 있어 완전한 차단은 아니다. 이 파일에
               *   `<form>` 요소가 없어 발동 확률이 이미 낮다는 것이 함께 받치는 근거다.
               */
              autoComplete="off"
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

        {/*
         * 초기 비밀번호 — **등록에서만 있는 칸이다.** 계약의 수정 요청 본문에 그 키가 없고
         * (`types.ts`의 `UserFormValues.password`), 자기 비밀번호를 바꾸는 자리는 전용 화면
         * (`password-change`)이다. 이 화면은 남의 비밀번호를 고치는 통로가 아니다.
         *
         * ⛔ **위 삼항의 true 가지에 Fragment로 밀어 넣지 않는다.** 이 파일은 모드로 갈리는 자리를
         * 전부 자기 조건으로 가른다(액션 줄의 `mode === 'edit' && …`). 한 삼항이 두 칸을 쥐면
         * 등록에만 있는 칸이 늘어날 때마다 그 가지가 깊어지고, **어느 칸이 어느 모드의 것인지
         * 들여쓰기로만 읽힌다.** 칸마다 조건을 적으면 그 답이 칸 옆에 적혀 있다.
         *
         * 필수 표시는 로그인 ID 칸과 같은 근거로 라벨을 직접 붙인다(배치 규범 3) — 디자인 시스템
         * `TextField`의 `label` prop은 문자열이라 표시를 끼울 자리가 없고, 문자열에 `*`를 붙이면
         * **접근성 이름이 「이름 *」이 되어 라벨 조회가 깨진다**(`field-label.tsx`).
         *
         * 규칙 안내는 **이 칸의 `helperText`**다. 오류가 서면 디자인 시스템이 **그 자리를 오류로
         * 갈아끼우므로**(`TextFieldProps`의 `helperText` — 「error나 … 있으면 대체됨」) 규칙과
         * 오류가 같은 줄을 쓰고, 칸 높이가 오류 유무로 흔들리지 않는다. 안내를 따로 두면 규칙과
         * 「규칙을 어겼다」가 한 칸 아래 나란히 서서 어느 쪽이 지금 상태인지 읽히지 않는다.
         * 선례와 그 근거는 `password-change/screen.tsx`의 새 비밀번호 칸에 있다.
         *
         * ⛔ **`.field-note`를 직접 붙이지 않는다.** 배치 규범 4의 이탈 조건이 텍스트 입력에 대해
         * 「디자인 시스템이 이 처리를 내장하고 있으므로 직접 만들지 말고 그대로 쓴다」고 정했다
         * (그 조항이 이름으로 든 prop은 `disabledReason`이지만, `helperText`도 같은 자리에 서고
         * `error`에 같은 방식으로 대체되므로 같은 처리다). 직접 붙이면 오류가 설 때 안내가 걷히지
         * 않아 두 문장이 겹친다.
         *
         * ⛔ **`.form-grid-full`을 쓰지 않는다.** 그것은 줄 전체가 필요한 표·배너의 처리이고,
         * 이 칸은 다른 입력칸과 같은 한 칸이다.
         *
         * ⛔ **보이기/숨기기 토글을 만들지 않는다.** 디자인 시스템에 그 부품이 없다 — 제품이
         * 원시 요소로 컨트롤을 새로 지으면 그것이 디자인 시스템 밖의 두 번째 시스템이 된다.
         * 대신 규칙 위반을 즉시 문장으로 말해 눈으로 확인할 필요를 줄인다.
         */}
        {mode === 'create' ? (
          <div className="field-cell">
            <FieldLabel htmlFor={passwordId} label={t.user.fields.initialPassword} required />
            <TextField
              id={passwordId}
              type="password"
              /*
               * `new-password`다 — `current-password`로 두면 브라우저가 **관리자 자신의** 저장된
               * 비밀번호를 이 칸에 채우려 하고, 그 값이 등록 요청에 실린다.
               */
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => onChange({ password: event.target.value })}
              helperText={t.user.initialPasswordNotice(INITIAL_PASSWORD_MIN_LENGTH)}
              error={fieldErrors.password}
              aria-required
            />
          </div>
        ) : null}

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

        <SelectField
          label={t.user.fields.status}
          options={statusOptions}
          value={values.statusCode}
          placeholder={mode === 'create' ? t.user.statusDefault : undefined}
          onChange={(value) => onChange({ statusCode: value })}
          disabled={statusDisabledReason !== null}
          disabledReason={statusDisabledReason ?? undefined}
          error={fieldErrors.statusCode}
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
