import { Button, Card, Field, Icon, IconButton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ADMIN_PRODUCT_NAME, ADMIN_WEB_NAME } from '../../patterns/admin-brand';
import { AppVersionText } from '../../patterns/app-version-text';
import { LocaleSelect } from '../../patterns/locale-select';
import { localizedLabel } from '../../patterns/localized-label';
import { resolveReturnPath, useSession } from '../../patterns/session';

import {
  emptyLoginDraft,
  firstEmptyField,
  LOGIN_ID_MAX_LENGTH,
  type LoginDraft,
} from './login-draft';
import { LoginErrorBanner } from './login-error-banner';
import { useLogin } from './queries';

const t = messages.login;

/**
 * W-CO-01 — **관리웹에서 셸(`AppShell`)을 쓰지 않는 유일한 화면**이다(스펙 근거: omf-mes#155).
 *
 * 아직 로그인하지 않은 사람에게 사이드바를 보이면 누를 수 없는 항목만 늘어선 화면이 된다.
 * 그래서 이 화면은 **자기 `<main>`을 직접 렌더하고** 그 안에 카드 하나를 세운다 — 배치 규범 8이
 * 그 자리의 기본값과 이탈 조건을 적었다. 전역 `main`의 안쪽 여백과 블록 이음매(규범 1)는 그대로
 * 걸리므로, 규범 8이 더하는 것은 중앙 정렬과 폭 상한뿐이다.
 *
 * **카드 머리에 제품 이름을 둔다**(2026-11-27 시안 A). 셸이 없어 상단 바의 이름이 서지 않으므로,
 * 여기서 말하지 않으면 무슨 시스템에 들어가는지 알 수 없다. 버전은 카드 아래 작게 둔다 — 문의·
 * 장애 보고 때 로그인하지 못한 사람도 읽을 수 있게.
 *
 * **실패를 말하는 규율이 이 화면의 본론이다**(공유계약 F-7 · G-1).
 *
 * - **실패는 세 가지로만 말한다**(#1034) — 로그인 정보 오류 · 계정 잠김 · 서버 오류.
 *   갈래를 가르는 축은 **「사용자가 무엇을 하면 풀리는가」**다(`login-outcome.ts`).
 * - 어느 칸이 틀렸는지 **말하지 않는다.** 지목하는 문구는 계정이 있는지를 흘린다.
 * - **인라인으로 내리지 않는다.** 칸 옆에 붙은 오류는 문구를 뭉뚱그려도 **붙은 자리가**
 *   어느 칸이 문제인지 말한다. 그래서 실패는 화면 수준 배너 한 자리에만 선다.
 * - **가를 근거가 없는 응답에 자격 문구를 붙이지 않는다.** 「응답이 실패면 무조건 그 문구」는
 *   잠긴 계정·서버 장애에도 자격을 의심하게 만들어, 사용자가 시도를 되풀이하다 계정을 잠근다.
 *
 * **성공하면 세션을 담고 셸 안으로 넘긴다.** 담는 자리는 `patterns/session`이고 이 화면은
 * 그것을 채우기만 한다 — 셸이 같은 값을 읽어 상단 바에 이름을 세운다.
 *
 * ⭐ **막는 일은 이 화면이 하지 않는다.** 다른 주소를 막는 것은 라우트 표에 선 가드
 * (`patterns/session`)이고, 이 화면은 그 가드가 보낸 사람을 받아 **원래 가려던 자리로**
 * 돌려보낸다(#1019).
 */
export const LoginScreen = () => {
  const [draft, setDraft] = useState<LoginDraft>(emptyLoginDraft);
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  /** 빈 칸인 채 보내려 하면 커서를 옮길 자리 */
  const loginIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const titleId = useId();
  const reasonId = useId();

  const navigate = useNavigate();
  const location = useLocation();

  const { signIn } = useSession();

  /**
   * 성공 뒤 갈 곳을 정할 근거. **가드가 막은 주소가 있으면 그리로 돌아간다**(#1019).
   *
   * ⭐ **들고 온 값을 렌더 시점에 잡아 둔다.** 성공 되먹임 안에서 읽으면 그 사이에 이동 상태가
   * 바뀐 경우 엉뚱한 곳으로 간다 — 이 값은 「이 화면에 «어떻게» 들어왔는가」이지 「지금
   * 어디인가」가 아니다.
   *
   * ⭐ **어디로 갈지는 로그인한 «뒤에» 정한다**(omf-all-around#188). 막힌 주소를 보던 사람과
   * 방금 로그인한 사람이 다르면 첫 화면으로 간다 — 누가 로그인할지는 성공 응답이 와야 안다.
   */
  const returnState: unknown = location.state;

  const login = useLogin({
    onSuccess: (session) => {
      /*
       * ⭐ **담고 나서 넘어간다 — 순서가 뜻을 정한다.**
       *
       * 먼저 넘어가면 세션 없이 앱 안에 서는 찰나가 생기고, 담는 일이 실패하면 **로그인은
       * 됐는데 누구인지 모르는 화면**이 남는다. 담기가 던지면 이동이 일어나지 않고 실패가
       * 배너로 서므로(요청 훅이 되먹임의 예외를 갈래로 옮긴다) 사용자는 같은 자리에서 다시
       * 시도할 수 있다.
       */
      signIn(session);

      /*
       * **`replace`로 넘긴다.** 밀어 넣으면 로그인 화면이 히스토리에 남아 뒤로가기 한 번에
       * 이미 로그인한 사람이 로그인 화면으로 되돌아간다 — 그 화면은 자기가 로그인된 줄
       * 모르므로 사용자는 자격을 한 번 더 친다.
       */
      void navigate(resolveReturnPath(returnState, session.userId), { replace: true });
    },
  });

  /**
   * 로그인 버튼이 잠긴 사유 — **나가는 동안뿐이다.** 열려 있으면 `undefined`.
   *
   * 빈 칸이어도 잠그지 않는다(2026-11-27 시안 A). 잠긴 회색 버튼과 늘 붙은 「모두 입력하면 쓸 수
   * 있습니다」 문장 대신, 누르면 요청 없이 빈 칸으로 커서를 옮긴다(`sendLogin`).
   */
  const blockReason = login.isSubmitting ? t.actionReasons.submitting : undefined;

  /**
   * Caps Lock 이 켜졌는지 키를 누를 때마다 읽는다 — 브라우저는 그 상태를 키 이벤트로만 알려 준다.
   * 비밀번호가 가려져 있으면 대문자로 친 것을 알아볼 수 없어 자격 오류로 이어진다.
   */
  const syncCapsLock = (event: KeyboardEvent<HTMLInputElement>): void => {
    setIsCapsLockOn(event.getModifierState('CapsLock'));
  };

  /**
   * 친 값을 고친다.
   *
   * **앞 시도의 실패를 함께 걷는다** — 값이 바뀌면 그 진술은 지금 화면에 있는 값에 대한 것이
   * 아니게 된다. 다만 **나가는 중인 요청은 끊지 않는다**(`resetIfIdle`): 끊으면 세션은
   * 만들어졌는데 로그인되지 않은 화면이 남는다.
   *
   * ⚠ **그래서 예외가 하나 생긴다 — 나가는 중에 고친 경우다.**
   *
   * 그 순간에는 되돌릴 것이 없어(`resetIfIdle`가 그대로 되돌아온다) 뒤늦게 도착한 실패가
   * **이미 고친 값 위에** 배너로 선다. 「값이 바뀌면 걷는다」의 유일한 반례이며 **일부러 이렇게
   * 둔다** — 그 시도는 **실제로 실패했고**, 화면이 아는 사실은 그것뿐이다.
   *
   * 감춘 쪽의 대가가 더 크다. 보낸 초안의 스냅숏과 견줘 배너를 세우지 않으면 **보낸 적이 있는데
   * 아무 말도 없는 화면**이 되고, 사용자는 자기 시도가 어떻게 됐는지 영영 알 수 없다.
   * 실패 갈래가 줄어도 이 판단은 그대로다 — 감지기가 그것을 고정한다.
   */
  const changeDraft = (patch: Partial<LoginDraft>): void => {
    setDraft((prev) => ({ ...prev, ...patch }));
    login.resetIfIdle();
  };

  /**
   * ⛔ **기본 제출을 막는다.** `<form>`은 기본이 GET 제출이라 Enter 한 번에 친 값이 질의
   * 문자열로 올라가고, 그 주소는 방문 기록·전달 경로에 그대로 남는다 — 비밀번호가 새는 길이다.
   *
   * **보낼 수 있을 때만 보낸다 — 버튼 잠금과 별개의 겹이다.** 폼은 버튼을 지나지 않는 제출
   * 경로를 갖는다(Enter · 프로그램적 제출). 그 길로 빈 자격이 나가면 서버는 **실패한 시도**로
   * 세고, 그 횟수는 계정을 잠그는 임계값을 향해 쌓인다 — 사용자가 아무것도 하지 않았는데도.
   *
   * 그래서 **보내는 문을 하나로 둔다**(`sendLogin`) — 폼 제출과 배너의 「다시 시도」가 같은
   * 문을 지나므로, 겹이 한쪽에만 걸리는 일이 생기지 않는다.
   *
   * **빈 칸이 있으면 그 칸으로 커서를 옮긴다** — 버튼을 잠그지 않으므로 이 자리가 할 일을 알려 준다.
   * 문구는 내지 않는다(`firstEmptyField`).
   */
  const sendLogin = (): void => {
    if (login.isSubmitting) return;

    const emptyField = firstEmptyField(draft);

    if (emptyField !== undefined) {
      (emptyField === 'loginId' ? loginIdRef : passwordRef).current?.focus();

      return;
    }

    login.submit(draft);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    sendLogin();
  };

  return (
    /*
     * **표제가 본문의 이름이 된다.** 셸이 있는 화면은 `AppShell`이 본문 이름을 주지만
     * (`mainLabel="본문"`) 이 화면에는 줄 사람이 없다 — 이름 없는 랜드마크로 남으면
     * 랜드마크 목록에서 무엇인지 알 수 없다.
     */
    <main className="login-shell" aria-labelledby={titleId}>
      {/*
       * 언어 칸은 **화면 오른쪽 위**에 선다(#1126 · 2026-11-27 시안 A). 셸이 없어 상단 바의 그 칸이
       * 서지 않는데, 공용 PC 에 처음 앉은 사람은 **여기서 바꾸지 못하면 바꿀 자리가 없다.**
       *
       * ⭐ **카드보다 앞, 폼 밖이다.** 고르면 새로고침하므로(`patterns/locale-select.tsx`) 치기 전에
       * 만나는 자리여야 이미 친 아이디·비밀번호를 잃지 않는다. 화면 읽기 차례도 카드보다 앞이다.
       *
       * ⛔ **친 값을 새로고침 넘어로 나르지 않는다.** 그러려면 비밀번호를 저장소에 두어야
       * 한다 — 칸이 둘뿐이라 다시 치는 대가가 그보다 작다.
       */}
      <div className="login-locale">
        <LocaleSelect />
      </div>

      <div className="login-stack">
        <Card className="login-card" surface="base" elevation={3}>
          <Card.Header className="login-head">
            <p className="login-brand">
              <strong>{ADMIN_PRODUCT_NAME}</strong>{' '}
              <span className="login-brand-app">{localizedLabel(ADMIN_WEB_NAME)}</span>
            </p>
            {/* 카드 제목이 이 화면의 유일한 표제다 — 셸이 없어 제목 줄도 없다. */}
            <h1 id={titleId} className="login-title">
              {t.title}
            </h1>
          </Card.Header>

          <Card.Body className="login-body">
            {/*
             * 실패는 **한 자리에만** 선다 — 화면 수준 배너다. 규범 6에 따라 화면이 직접 배치하는
             * 배너는 화면이 이음매(`.banner-slot`)를 붙인다.
             *
             * ⛔ **세 갈래가 다른 말을 한다.** 갈래를 보지 않고 「실패면 이 배너」로 두면 잠긴
             * 계정과 서버 장애에도 자격이 틀렸다고 말하게 된다. 그 판정은 배너가 소유한다.
             */}
            {login.outcome !== null && (
              <LoginErrorBanner outcome={login.outcome} onRetry={sendLogin} />
            )}

            <form onSubmit={handleSubmit}>
              <div className="login-fields">
                {/*
                 * 별표(*)를 그리지 않는다 — 칸이 둘뿐이고 둘 다 채워야 하는 것이 로그인이라 표시가
                 * 더하는 뜻이 없다. 보조 기술에는 `aria-required` 로 그대로 알린다.
                 */}
                <Field label={t.fields.loginId} fullWidth>
                  {({ controlId }) => (
                    <TextField
                      ref={loginIdRef}
                      id={controlId}
                      size="lg"
                      aria-required="true"
                      value={draft.loginId}
                      /* 계약 상한을 칸이 직접 막는다 — 넘겨 친 값이 요청에 실릴 자리를 만들지 않는다. */
                      maxLength={LOGIN_ID_MAX_LENGTH}
                      autoComplete="username"
                      /* 이 화면에서 할 일은 이 칸부터다 — 들어오자마자 칠 수 있게 커서를 둔다. */
                      autoFocus
                      fullWidth
                      onKeyDown={syncCapsLock}
                      onKeyUp={syncCapsLock}
                      onChange={(event) => {
                        changeDraft({ loginId: event.target.value });
                      }}
                    />
                  )}
                </Field>

                {/*
                 * Caps Lock 안내는 칸 아래 도움말 자리에 선다 — 실패가 아니라 지금 상태라, 「실패는
                 * 배너 한 자리」 규율과 부딪히지 않는다. 켜진 동안만 선다.
                 */}
                <Field
                  label={t.fields.password}
                  fullWidth
                  helperText={
                    isCapsLockOn ? (
                      <span className="login-caps">
                        <Icon name="keyboard_capslock" size={16} />
                        {t.hints.capsLock}
                      </span>
                    ) : undefined
                  }
                >
                  {({ controlId, describedById }) => (
                    <div className="login-password">
                      <TextField
                        ref={passwordRef}
                        id={controlId}
                        className="login-password-input"
                        size="lg"
                        aria-required="true"
                        aria-describedby={describedById}
                        type={isPasswordShown ? 'text' : 'password'}
                        value={draft.password}
                        autoComplete="current-password"
                        fullWidth
                        onKeyDown={syncCapsLock}
                        onKeyUp={syncCapsLock}
                        onChange={(event) => {
                          changeDraft({ password: event.target.value });
                        }}
                      />
                      {/*
                       * 눈 단추는 칸 위에 겹쳐 둔다 — DS `TextField` 의 끝 아이콘 자리는 보조 기술에서
                       * 숨겨져(`aria-hidden`) 그 안에 둔 단추는 누를 수 없는 것이 된다. 사용자 추가 창
                       * (`users-roles/user-form-pane.tsx`)과 같은 짜임이다.
                       */}
                      <IconButton
                        icon={isPasswordShown ? 'visibility_off' : 'visibility'}
                        aria-label={
                          isPasswordShown ? t.actions.hidePassword : t.actions.showPassword
                        }
                        onClick={() => {
                          setIsPasswordShown((shown) => !shown);
                        }}
                      />
                    </div>
                  )}
                </Field>
              </div>

              {/*
               * 잠긴 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다 —
               * 잠긴 버튼은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다
               * (배치 규범 4-1). 잠그는 것은 나가는 동안뿐이다.
               */}
              <div className="login-actions">
                <Button
                  type="submit"
                  variant="filled"
                  size="lg"
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
            </form>
          </Card.Body>
        </Card>

        <AppVersionText className="login-version" />
      </div>
    </main>
  );
};
