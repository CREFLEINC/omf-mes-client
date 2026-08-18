import { Button, Card, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type FormEvent } from 'react';

import {
  emptyLoginDraft,
  submitDisabledReason,
  LOGIN_ID_MAX_LENGTH,
  type LoginDraft,
} from './login-draft';

const t = messages.login;

/**
 * W-CO-01 — **관리웹에서 셸(`AppShell`)을 쓰지 않는 유일한 화면**이다(스펙 근거: omf-mes#155).
 *
 * 아직 로그인하지 않은 사람에게 사이드바를 보이면 누를 수 없는 항목만 늘어선 화면이 된다.
 * 그래서 이 화면은 **자기 `<main>`을 직접 렌더하고** 그 안에 카드 하나를 세운다 — 배치 규범 8이
 * 그 자리의 기본값과 이탈 조건을 적었다. 전역 `main`의 안쪽 여백과 블록 이음매(규범 1)는 그대로
 * 걸리므로, 규범 8이 더하는 것은 중앙 정렬과 폭 상한뿐이다.
 *
 * **이 회차는 보내지 않는다.** 서버 호출·세션 보관·라우트 개방은 뒤따르는 회차가 붙인다 —
 * 지금 이 화면은 **무엇을 쳐야 로그인을 시작할 수 있는가**까지만 말한다.
 */
export const LoginScreen = () => {
  const [draft, setDraft] = useState<LoginDraft>(emptyLoginDraft);

  const titleId = useId();
  const reasonId = useId();

  /** 잠금과 사유가 **한 판정에서** 갈라 나온다 — 각자 재면 둘이 어긋난다. */
  const disabledReason = submitDisabledReason(draft);

  /**
   * ⛔ **기본 제출을 막는다.** `<form>`은 기본이 GET 제출이라 Enter 한 번에 친 값이 질의
   * 문자열로 올라가고, 그 주소는 방문 기록·전달 경로에 그대로 남는다 — 비밀번호가 새는 길이다.
   *
   * 보내는 경로가 **아직 없는 지금부터** 막아 둔다. 뒤따르는 회차가 이 자리에 요청을 잇는다.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
  };

  return (
    <main className="login-shell">
      <Card className="login-card" surface="default" elevation={2}>
        <Card.Header>
          {/* 카드 제목이 이 화면의 유일한 표제다 — 셸이 없어 제목 줄도 없다. */}
          <h1 id={titleId} className="login-title">
            {t.title}
          </h1>
        </Card.Header>

        <Card.Body>
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
                  setDraft((prev) => ({ ...prev, loginId: event.target.value }));
                }}
              />

              <TextField
                label={t.fields.password}
                type="password"
                value={draft.password}
                autoComplete="current-password"
                fullWidth
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, password: event.target.value }));
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
                disabled={disabledReason !== undefined}
                aria-describedby={disabledReason === undefined ? undefined : reasonId}
              >
                {t.actions.submit}
              </Button>
              {disabledReason !== undefined && (
                <span id={reasonId} className="field-note">
                  {disabledReason}
                </span>
              )}
            </div>
          </form>
        </Card.Body>
      </Card>
    </main>
  );
};
