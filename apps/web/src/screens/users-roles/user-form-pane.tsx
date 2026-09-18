import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

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
  statusOptions: SelectOption[];
  /** null이면 상태를 고를 수 있다. 값이 있으면 조회 상태에 따른 비활성 사유다. */
  statusDisabledReason: string | null;
  /** 참이면 사용 중지를 누를 수 없다(이미 미사용). 사유 문구는 내지 않는다 — 아래 액션 줄 주석. */
  isDeactivateDisabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDeactivate: () => void;
  /** 비밀번호 초기화 확인 창을 연다. 수정 모드에서만 쓴다. */
  onResetPassword: () => void;
}

/** 라벨과 값 한 쌍. **폼 컨트롤이 아니다** — 잠긴 입력칸은 「언젠가 열린다」는 뜻이 된다. */
const ValueField = ({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: string;
  note: string;
  className: string;
}) => {
  const labelId = useId();
  const noteId = useId();

  return (
    <div className={`field-cell ${className}`}>
      {/*
       * 안내는 입력칸 아래가 아니라 **라벨 오른쪽의 작은 보조 라벨**이다(사용자 지시 2026-09-18) —
       * 칸 아래에 두면 이 칸만 높아져 옆 칸들과 줄이 어긋난다. 값과의 연결(`aria-describedby`)은 그대로다.
       */}
      <span className="field-label readonly-label-row">
        <span id={labelId}>{label}</span>
        <span id={noteId} className="readonly-label-note">
          {note}
        </span>
      </span>
      {/* 입력칸이 아님을 읽기 쉬운 채로 보인다 — 흐린 비활성 입력칸으로 그리면 값이 잘 안 읽힌다. */}
      <p className="readonly-value" aria-labelledby={labelId} aria-describedby={noteId}>
        {value}
      </p>
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
  isDeactivateDisabled,
  isDirty,
  isSaving,
  onSave,
  onCancel,
  onDeactivate,
  onResetPassword,
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
    <section className="pane users-roles-pane users-roles-user-pane" aria-label={t.panes.userForm}>
      <h2 className="pane-title">{t.panes.userForm}</h2>
      {banner}

      <div
        className={
          mode === 'create'
            ? 'form-grid users-roles-user-form urf-create'
            : 'form-grid users-roles-user-form'
        }
      >
        {mode === 'create' ? (
          /*
           * 필수 표시는 디자인 시스템 내장 라벨에 끼울 자리가 없어 라벨을 직접 붙인다(배치 규범 3).
           * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
           */
          <div className="field-cell urf-login">
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
            className="urf-login"
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
         * 규칙 안내 도움말은 두지 않는다(사용자 지시 2026-09-18) — 규칙(숫자와 알파벳을 함께,
         * 최소 길이)은 입력하는 동안 어기면 서는 **오류 문구**(`initialPasswordWeak`)가 알린다.
         *
         * ⛔ **`.form-grid-full`을 쓰지 않는다.** 그것은 줄 전체가 필요한 표·배너의 처리이고,
         * 이 칸은 다른 입력칸과 같은 한 칸이다.
         *
         * ⛔ **보이기/숨기기 토글을 만들지 않는다.** 디자인 시스템에 그 부품이 없다 — 제품이
         * 원시 요소로 컨트롤을 새로 지으면 그것이 디자인 시스템 밖의 두 번째 시스템이 된다.
         * 대신 규칙 위반을 즉시 문장으로 말해 눈으로 확인할 필요를 줄인다.
         */}
        {mode === 'create' ? (
          <div className="field-cell urf-password">
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
              error={fieldErrors.password}
              aria-required
            />
          </div>
        ) : null}

        <div className="field-cell urf-name">
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
          className="urf-dept"
          label={t.user.fields.department}
          wide
          options={departmentOptions}
          value={values.departmentId}
          onChange={(value) => onChange({ departmentId: value })}
          error={fieldErrors.departmentId}
        />

        {/* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 필수 표시를 붙이지 않는다. */}
        <div className="field-cell urf-email">
          <FieldLabel htmlFor={emailId} label={t.user.fields.email} />
          <TextField
            id={emailId}
            value={values.email}
            onChange={(event) => onChange({ email: event.target.value })}
            error={fieldErrors.email}
          />
        </div>

        <SelectField
          className="urf-status"
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
         * 계정 관리 묶음 — 비밀번호 초기화·사용 중지. 폼의 「취소·저장」과 같은 줄 양 끝에 두되
         * 한 덩어리로 묶어 왼쪽에 모은다: 이 둘은 폼 값을 저장하지 않고 **바로 서버에 나가는
         * 계정 작업**이라, 폼 저장과 한 무리로 읽히면 안 된다. 등록 폼에는 두지 않는다 — 아직
         * 없는 사용자라 초기화할 비밀번호도, 중지할 계정도 없다.
         *
         * 비밀번호 초기화(설계 §5-1 「기본 정보 폼 · 항상」)는 사용 여부와 무관하게 누를 수 있어
         * 비활성 사유가 없다. 두 버튼 모두 외곽선 버튼이다(사용자 지시 2026-09-18) — 디자인 시스템에
         * 위험 동작 전용 버튼이 없다. 더 무거운 사용 중지(로그인 차단)는 확인 창이 되돌릴 수 없음을 밝힌다.
         */}
        {mode === 'edit' && (
          <div className="users-roles-account-actions form-actions-secondary">
            <Button variant="outlined" onClick={onResetPassword}>
              {t.actions.resetPassword}
            </Button>
            {/*
             * 이미 미사용이면 비활성이다. 사유 문구(「…이미 미사용인 사용자에게…」)는 내지 않는다 —
             * 규범 4(비활성 사유 상시 표시)의 예외, 사용자 지시 2026-09-18.
             */}
            <Button variant="outlined" disabled={isDeactivateDisabled} onClick={onDeactivate}>
              {messages.common.deactivate}
            </Button>
          </div>
        )}

        {/*
         * 등록에서 「취소」는 **폼을 닫는 것**이라 고친 것이 없어도 눌러야 한다.
         * 수정에서는 **기준값으로 되돌리는 것**이라 고친 것이 있을 때만 의미가 있다.
         */}
        <Button variant="outlined" disabled={mode === 'edit' && !isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {/*
         * 규범 4(비활성 사유 상시 표시)의 예외 — 사용자 지시 2026-09-18: 이 화면의 「저장」·
         * 「사용자 추가」 사유 문구를 내지 않는다. 고친 것이 없으면 비활성인 조건은 그대로다.
         */}
        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </section>
  );
};
