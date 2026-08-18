import { AlertBanner, Button, Card, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import {
  canSubmit,
  emptyLoginDraft,
  submitDisabledReason,
  LOGIN_ID_MAX_LENGTH,
  type LoginDraft,
} from './login-draft';
import { useLogin } from './queries';

const t = messages.login;

/**
 * 성공 뒤 갈 곳.
 *
 * ⚠ **스펙은 「대시보드로」인데 통합 대시보드 화면이 아직 없다.** 지금 이 주소는 관리웹의
 * 첫 화면으로 넘겨 준다. **그 화면이 서면 이 한 줄을 바꾼다** — 그때까지 「대시보드」라는 이름을
 * 코드에 지어 두지 않는다. 없는 화면을 가리키는 상수는 있는 것처럼 읽힌다.
 */
const AFTER_LOGIN_ROUTE = '/';

/**
 * W-CO-01 — **관리웹에서 셸(`AppShell`)을 쓰지 않는 유일한 화면**이다(스펙 근거: omf-mes#155).
 *
 * 아직 로그인하지 않은 사람에게 사이드바를 보이면 누를 수 없는 항목만 늘어선 화면이 된다.
 * 그래서 이 화면은 **자기 `<main>`을 직접 렌더하고** 그 안에 카드 하나를 세운다 — 배치 규범 8이
 * 그 자리의 기본값과 이탈 조건을 적었다. 전역 `main`의 안쪽 여백과 블록 이음매(규범 1)는 그대로
 * 걸리므로, 규범 8이 더하는 것은 중앙 정렬과 폭 상한뿐이다.
 *
 * **실패를 말하는 규율이 이 화면의 본론이다**(공유계약 F-7 · G-1).
 *
 * - 어느 칸이 틀렸는지 **말하지 않는다.** 지목하는 문구는 계정이 있는지를 흘린다.
 * - **인라인으로 내리지 않는다.** 칸 옆에 붙은 오류는 문구를 뭉뚱그려도 **붙은 자리가**
 *   어느 칸이 문제인지 말한다. 그래서 실패는 화면 수준 배너 한 자리에만 선다.
 * - **가를 근거가 없는 응답에 자격 문구를 붙이지 않는다.** 「응답이 실패면 무조건 그 문구」는
 *   잠긴 계정·서버 장애에도 자격을 의심하게 만들어, 사용자가 시도를 되풀이하다 계정을 잠근다.
 *
 * **이 회차가 두지 않은 것**: 남은 시도 횟수 · 잠긴 계정 안내 · 통신 실패의 「다시 시도」 ·
 * 세션 보관 · 라우트 개방. 뒤따르는 회차가 붙인다. 그때까지 401 밖의 실패는 **아무 말도
 * 하지 않는다** — 틀린 말을 하는 것보다 낫다는 판단이고, 그 사실을 시험이 잰다.
 */
export const LoginScreen = () => {
  const [draft, setDraft] = useState<LoginDraft>(emptyLoginDraft);

  const titleId = useId();
  const reasonId = useId();

  const navigate = useNavigate();

  const login = useLogin({
    onSuccess: () => {
      /*
       * **`replace`로 넘긴다.** 밀어 넣으면 로그인 화면이 히스토리에 남아 뒤로가기 한 번에
       * 이미 로그인한 사람이 로그인 화면으로 되돌아간다 — 그 화면은 자기가 로그인된 줄
       * 모르므로 사용자는 자격을 한 번 더 친다.
       *
       * **세션을 보관하지 않는다** — 담을 자리를 뒤따르는 회차가 만든다.
       */
      void navigate(AFTER_LOGIN_ROUTE, { replace: true });
    },
  });

  /**
   * 로그인이 막힌 사유. 열려 있으면 `undefined`.
   *
   * **순서가 뜻을 정한다** — 나가는 중이 맨 앞이다. 그 사정을 뒤에 두면 값을 다 채운 사용자가
   * 「채우면 쓸 수 있습니다」를 읽고도 잠긴 버튼을 본다.
   */
  const blockReason = login.isSubmitting ? t.actionReasons.submitting : submitDisabledReason(draft);

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
   * 실패 갈래가 늘어나는 뒤 회차에서도 이 판단을 그대로 쓴다 — 감지기가 그것을 고정한다.
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
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (login.isSubmitting || !canSubmit(draft)) return;

    login.submit(draft);
  };

  return (
    /*
     * **표제가 본문의 이름이 된다.** 셸이 있는 화면은 `AppShell`이 본문 이름을 주지만
     * (`mainLabel="본문"`) 이 화면에는 줄 사람이 없다 — 이름 없는 랜드마크로 남으면
     * 랜드마크 목록에서 무엇인지 알 수 없다.
     */
    <main className="login-shell" aria-labelledby={titleId}>
      <Card className="login-card" surface="default" elevation={2}>
        <Card.Header>
          {/* 카드 제목이 이 화면의 유일한 표제다 — 셸이 없어 제목 줄도 없다. */}
          <h1 id={titleId} className="login-title">
            {t.title}
          </h1>
        </Card.Header>

        <Card.Body>
          {/*
           * 실패는 **한 자리에만** 선다 — 화면 수준 배너다. 규범 6에 따라 화면이 직접 배치하는
           * 배너는 화면이 이음매(`.banner-slot`)를 붙인다.
           *
           * ⛔ **`mismatch`에만 선다.** 갈래를 보지 않고 「실패면 이 배너」로 두면 잠긴 계정과
           * 서버 장애에도 자격이 틀렸다고 말하게 된다.
           */}
          {login.outcome?.kind === 'mismatch' && (
            <div className="banner-slot">
              <AlertBanner variant="error" title={t.banner.failureTitle}>
                {t.banner.mismatch}
              </AlertBanner>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-fields">
              <TextField
                label={t.fields.loginId}
                value={draft.loginId}
                /* 계약 상한을 칸이 직접 막는다 — 넘겨 친 값이 요청에 실릴 자리를 만들지 않는다. */
                maxLength={LOGIN_ID_MAX_LENGTH}
                autoComplete="username"
                fullWidth
                onChange={(event) => {
                  changeDraft({ loginId: event.target.value });
                }}
              />

              <TextField
                label={t.fields.password}
                type="password"
                value={draft.password}
                autoComplete="current-password"
                fullWidth
                onChange={(event) => {
                  changeDraft({ password: event.target.value });
                }}
              />
            </div>

            {/*
             * 잠긴 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다 —
             * 잠긴 버튼은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다
             * (배치 규범 4-1). **열려 있으면 사유를 그리지 않는다** — 늘 서 있으면 읽히지 않는다.
             */}
            <div className="login-actions">
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
          </form>
        </Card.Body>
      </Card>
    </main>
  );
};
