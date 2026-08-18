import { Breadcrumb, Button, PageHeader, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import {
  MIN_NEW_PASSWORD_LENGTH,
  emptyPasswordDraft,
  submitDisabledReason,
  validatePasswordDraft,
  type PasswordDraft,
} from './password-draft';

const t = messages.passwordChange;

/** 돌아갈 앞 화면이 없을 때 취소가 가는 곳 — 관리웹의 첫 화면이다. */
const FALLBACK_ROUTE = '/';

/**
 * 히스토리의 **첫 항목**에 붙는 키.
 *
 * react-router가 앱 안에서 만든 이동에는 무작위 키를 주고, 처음 선 자리에만 이 값을 준다
 * (브라우저·메모리 히스토리 모두 — 실측 7.18.2). 즉 이 값이면 **이 앱 안에서 한 번도 이동하지
 * 않았다**는 뜻이고, 뒤로 갈 자리가 이 앱 밖이라는 뜻이다.
 */
const FIRST_HISTORY_ENTRY_KEY = 'default';

/**
 * W-CO-10 비밀번호 변경 — 로그인한 사람이 **자기** 비밀번호를 바꾸는 자리.
 *
 * ⭐ **로그인 화면과 같아 보이지만 규율이 반대인 자리가 셋이다.** 이 슬라이스는 그 화면의
 * 사본으로 출발하므로 셋을 여기 적어 둔다.
 *
 * 1. **인라인 오류를 낸다.** 로그인은 칸을 지목하지 않는다 — 붙은 자리가 「그 아이디는 있다」를
 *    흘리기 때문이다. 여기서는 이미 인증된 본인만 보므로 흘릴 것이 없고, 지목하지 않으면 세 칸
 *    중 어디를 고쳐야 하는지 알 수 없다.
 * 2. **잠그지 않는다.** 현재 비밀번호를 몇 번 틀려도 계정이 잠기지 않는다(스펙 §5-2) — 본인이
 *    자기 계정을 잠그면 자가 복구 경로가 없다. 잠금·남은 시도 횟수는 이 화면에 **없는 갈래**다.
 * 3. **셸 안에 선다.** 사이드바와 상단 바는 `AppLayout`이 준다 — 이 화면은 제목 줄부터다.
 *
 * **치는 도중에 검증한다**(결정 ④). 「변경」의 활성 조건이 두 값의 일치를 요구하므로, 눌러야
 * 오류가 뜨는 형태로 두면 값이 다를 때 **버튼이 잠겨 오류를 볼 방법이 없는 화면**이 된다.
 * 다만 **빈 칸에는 그리지 않는다** — 첫 글자부터 붉은 글씨가 서면 치는 내내 오류를 본다.
 *
 * ⛔ **이 회차는 요청을 만들지 않는다.** 「변경」은 규칙을 만족할 때 열리기만 하고, 보내는 문은
 * 다음 회차가 붙인다. 그때까지도 폼은 실재하므로 기본 제출 차단은 지금부터 선다.
 */
export const PasswordChangeScreen = () => {
  const [draft, setDraft] = useState<PasswordDraft>(emptyPasswordDraft);

  const reasonId = useId();

  const navigate = useNavigate();
  const location = useLocation();

  /* 렌더마다 다시 판정한다 — 값이 곧 오류이고, 사이에 낄 상태를 두면 둘이 어긋난다. */
  const errors = validatePasswordDraft(draft);
  const blockReason = submitDisabledReason(draft);

  const changeDraft = (patch: Partial<PasswordDraft>): void => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  /**
   * ⛔ **기본 제출을 막는다.** `<form>`은 기본이 GET 제출이라 Enter 한 번에 세 값이 질의
   * 문자열로 올라가고, 그 주소는 방문 기록·전달 경로에 그대로 남는다 — 비밀번호가 새는 길이다
   * (전례 `login/screen.tsx`가 같은 자리에 같은 겹을 세웠다).
   *
   * **보내는 문은 아직 없다.** 그래도 막는 겹을 먼저 세우는 이유는, 요청이 붙기 전에도 폼과
   * Enter가 실재하기 때문이다 — 한 번 주소에 실린 값은 되돌릴 수 없다.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
  };

  /**
   * 취소 — **직전 화면으로 돌아간다.** 보낸 것이 없으므로 확인 창을 세우지 않는다.
   *
   * ⚠ **주소로 직접 들어온 사람은 앱 밖으로 나간다.** 그때 히스토리의 앞 칸은 이 앱이 아니라
   * 사용자가 오기 전 페이지다 — 취소를 눌렀을 뿐인데 앱을 떠나게 된다. 그 경우에만 첫 화면으로
   * 보낸다. 이 저장소의 제품 코드에서 `navigate(-1)`을 쓰는 첫 자리라 감지기를 함께 둔다.
   */
  const cancel = (): void => {
    if (location.key === FIRST_HISTORY_ENTRY_KEY) {
      void navigate(FALLBACK_ROUTE);

      return;
    }

    void navigate(-1);
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/*
       * 폼 전체가 **한 폭 상한 안**에 선다(`.password-form`). 칸 열에만 상한을 주면 넓은 창에서
       * 칸은 왼쪽에 서고 액션 줄은 화면 오른쪽 끝으로 갈라진다 — 액션이 자기가 딸린 칸에서
       * 멀어지면 무엇을 저장하는 버튼인지 읽히지 않는다.
       */}
      <form className="password-form" onSubmit={handleSubmit}>
        <div className="password-fields">
          {/*
           * 현재 비밀번호 칸에는 이 회차가 세울 오류가 없다 — 맞는지 아는 것은 서버뿐이고,
           * 그 답을 이 칸에 붙이는 일은 요청이 붙는 회차의 몫이다. 있지도 않은 값을 미리
           * 이어 두지 않는다.
           */}
          <TextField
            label={t.fields.currentPassword}
            type="password"
            value={draft.currentPassword}
            autoComplete="current-password"
            fullWidth
            onChange={(event) => {
              changeDraft({ currentPassword: event.target.value });
            }}
          />

          <TextField
            label={t.fields.newPassword}
            type="password"
            value={draft.newPassword}
            autoComplete="new-password"
            /* 규칙 안내는 이 칸의 도움말이다 — 오류가 서면 디자인 시스템이 그 자리를 오류로 바꾼다. */
            helperText={t.notice(MIN_NEW_PASSWORD_LENGTH)}
            error={errors.newPassword}
            fullWidth
            onChange={(event) => {
              changeDraft({ newPassword: event.target.value });
            }}
          />

          <TextField
            label={t.fields.confirmPassword}
            type="password"
            value={draft.confirmPassword}
            autoComplete="new-password"
            error={errors.confirmPassword}
            fullWidth
            onChange={(event) => {
              changeDraft({ confirmPassword: event.target.value });
            }}
          />
        </div>

        {/*
         * 잠긴 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다 —
         * 잠긴 버튼은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다
         * (배치 규범 4-1). **열려 있으면 그리지 않는다** — 늘 서 있으면 읽히지 않는다.
         *
         * ⚠ **사유는 버튼과 한 `.field-cell` 안에 든다**(규범 4-2 — 그 컨트롤 **바로 아래**,
         * 왼쪽 가장자리를 맞춰). 액션 줄 `.form-actions`는 **우측 정렬 flex 행**이라 사유를
         * 직속에 두면 버튼 아래가 아니라 **오른쪽**에 선다. 전례(`login/screen.tsx`)는 같은 자식
         * 구조를 쓰면서도 컨테이너가 **블록**(`.login-actions`)이라 성립했다 — 배치 클래스를
         * 바꿔 옮길 때는 그 클래스의 표시 형식까지 함께 옮겨 와야 한다. 형제 화면들이 예외 없이
         * 이 묶음을 쓴다(`stock-adjust` · `po-register` · `disposal-issue`).
         */}
        <div className="form-actions">
          <div className="field-cell">
            <Button type="button" variant="outlined" onClick={cancel}>
              {messages.common.cancel}
            </Button>
          </div>

          <div className="field-cell">
            <Button
              type="submit"
              variant="filled"
              disabled={blockReason !== undefined}
              aria-describedby={blockReason === undefined ? undefined : reasonId}
            >
              {t.actions.submit}
            </Button>

            {blockReason !== undefined && (
              <span id={reasonId} className="field-note">
                {blockReason}
              </span>
            )}
          </div>
        </div>
      </form>
    </>
  );
};
