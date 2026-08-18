import { Breadcrumb, Button, PageHeader, TextField, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ChangeErrorBanner } from './change-error-banner';
import { boundField, splitInvalidErrors } from './change-outcome';
import {
  MIN_NEW_PASSWORD_LENGTH,
  canSubmit,
  emptyPasswordDraft,
  submitDisabledReason,
  validatePasswordDraft,
  type PasswordDraft,
  type PasswordFieldErrors,
} from './password-draft';
import { useChangePassword } from './queries';

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
 * **보내고 나서**는 네 갈래다.
 *
 * | 응답 | 어디에 선다 |
 * | --- | --- |
 * | 204 | 알림 + 세 칸 비우기. ⛔ 이동도 재로그인도 없다 |
 * | 401 | **현재 비밀번호 칸**에 인라인 |
 * | 400 | 지목한 칸이 이 화면에 있으면 그 칸에 인라인, **없거나 화면 수준이면 배너** |
 * | 응답 없음 · 가를 근거 없음 | 배너(통신 실패는 **실패를 단언하지 않는다**) |
 *
 * ⛔ **몇 번을 틀려도 계정은 잠기지 않는다.**
 */
export const PasswordChangeScreen = () => {
  const [draft, setDraft] = useState<PasswordDraft>(emptyPasswordDraft);

  const reasonId = useId();

  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const change = useChangePassword({
    onSuccess: () => {
      /*
       * ⭐ **알림 한 줄이 유일한 성공 신호다.** 이동하지도 다시 로그인시키지도 않으므로
       * (스펙 §5-3) 화면은 그대로 있고, 무엇이 달라졌는지는 이 문구만이 말한다.
       *
       * **세 칸을 비운다.** 스펙에 없는 추론이라 근거를 적는다 — 바뀐 값이 화면에 남아 있으면
       * ⓐ 자리를 뜬 사이 어깨너머로 읽히고 ⓑ 「변경」을 한 번 더 누르면 이번엔 현재 비밀번호가
       * 맞지 않아 실패한다. 비우면 둘이 함께 사라진다.
       *
       * ⚠ **여기에 던질 수 있는 일을 더하려면 `queries.ts`의 되먹임 주석을 먼저 본다.** 지금
       * 이 자리가 감싸이지 않은 것은 **던지는 경로가 없다는 실측**에 근거하며(알림은 상태 갱신 뒤
       * id를 돌려줄 뿐이다), 저장소·세션을 건드리는 일이 들어오는 순간 그 근거가 뒤집힌다 —
       * 그때는 전례처럼 예외를 갈래로 옮기고 감지기를 함께 둔다.
       */
      toast.show({ variant: 'success', description: t.toast.changed });
      setDraft(emptyPasswordDraft);
    },
  });

  /**
   * 서버가 세운 인라인 오류. **갈래마다 자리가 다르다.**
   *
   * ⭐ **401은 「어느 칸인가」를 `boundField`에게 묻는다** — 걷는 쪽(`changeDraft`)과 그리는 쪽이
   * 같은 근원을 지나야 한다. 둘이 각자 칸 이름을 들고 있으면 한쪽만 바뀌었을 때 **조용히
   * 어긋난다**(오류는 그 칸에 서는데 걷히지는 않는 상태).
   */
  const serverFieldErrors = ((): PasswordFieldErrors => {
    if (change.outcome === null) return {};

    if (change.outcome.kind === 'currentMismatch') {
      const field = boundField(change.outcome);

      return field === null ? {} : { [field]: t.validation.currentMismatch };
    }

    /* 400은 서버가 이름으로 지목한다 — 입력칸이 있는 이름만 내려온다(나머지는 배너로 올라간다). */
    return change.outcome.kind === 'invalid'
      ? splitInvalidErrors(change.outcome.errors).fieldErrors
      : {};
  })();

  /**
   * 이 칸에 설 한 문장.
   *
   * ⭐ **화면이 잡는 규칙과 서버가 준 진술이 한 자료구조에 모인다.** 둘을 따로 들면 「한 칸에 한
   * 문장」과 우선순위가 두 자리에서 각각 정해져, 새 갈래가 늘 때마다 어긋날 자리가 생긴다.
   * 현재 비밀번호 칸은 화면이 잡을 규칙이 없어(맞는지 아는 것은 서버뿐이다) 서버 쪽만 채운다.
   *
   * ⚠ **서버 진술이 화면 규칙을 이긴다 — 그 순서가 관찰되는 상태가 실재한다.**
   *
   * 도달 경로는 **나가는 중에 값을 고치는 자리**다(T2-10이 허용한다 — 그때 요청은 끊기지 않고
   * 갈래는 아직 `null`이라 걷을 것도 없다). 고친 값이 화면 규칙을 어기면 뒤늦게 도착한 서버 진술과
   * 화면 규칙이 **같은 칸에서 만난다.** 그때 서버의 지적이 가려지면 사용자는 길이만 고쳐
   * **서버가 거절한 그 값을 다시 보낸다.**
   *
   * ⚠ **이 자리는 한때 「도달 불가」로 잘못 적혀 있었다** — 상태 공간을 정적으로 세면서 「응답이
   * 오는 동안 값이 그대로」라는 가정을 눈치채지 못한 결과다(독립 검증이 위 경로를 만들어 반증했다).
   * 감지기 둘이 그 경로를 지킨다 — 「나가는 중 규칙을 깨뜨린 칸에 서버 문구가 도착하면 서버 문구가
   * 선다」와 그 짝.
   */
  const errors: PasswordFieldErrors = {
    ...validatePasswordDraft(draft),
    ...serverFieldErrors,
  };

  /**
   * 「변경」이 막힌 사유. **순서가 뜻을 정한다** — 나가는 중이 맨 앞이다. 그 사정을 뒤에 두면
   * 값을 다 채운 사용자가 「채우면 쓸 수 있습니다」를 읽고도 잠긴 버튼을 본다.
   */
  const blockReason = change.isSubmitting
    ? t.actionReasons.submitting
    : submitDisabledReason(draft);

  /**
   * 친 값을 고친다.
   *
   * ⚠ **걷는 범위를 갈래의 성격이 정한다 — 전례(로그인)와 다른 자리다.** 그쪽의 실패는 어느
   * 칸이 틀렸는지 말하지 않는 화면 수준 진술이라 아무 칸이나 고치면 걷는 것이 맞다. 여기서는
   * 갈래가 둘로 갈린다.
   *
   * - **그 칸에 매인 진술**(현재 비밀번호 불일치): 그 칸이 바뀔 때만 걷는다. 새 비밀번호를
   *   고쳤다고 「현재 비밀번호가 맞지 않는다」가 거짓이 되지 않는다.
   * - **칸에 매이지 않은 진술**(통신 실패 · 가를 근거 없음 · 서버가 보낸 본문 전체를 두고 한 400):
   *   어느 칸을 고쳐도 걷는다. 배너가 그 자리를 그리므로 규칙이 없으면 **지나간 배너가 새 값 위에
   *   그대로 선다.**
   *
   * **나가는 중인 요청은 끊지 않는다**(`resetIfIdle`) — 끊으면 비밀번호는 바뀌었는데 바뀐 줄
   * 모르는 화면이 남는다.
   */
  const changeDraft = (patch: Partial<PasswordDraft>): void => {
    setDraft((prev) => ({ ...prev, ...patch }));

    const bound = change.outcome === null ? null : boundField(change.outcome);

    if (bound === null || patch[bound] !== undefined) change.resetIfIdle();
  };

  /**
   * ⛔ **기본 제출을 막는다.** `<form>`은 기본이 GET 제출이라 Enter 한 번에 세 값이 질의
   * 문자열로 올라가고, 그 주소는 방문 기록·전달 경로에 그대로 남는다 — 비밀번호가 새는 길이다
   * (전례 `login/screen.tsx`가 같은 자리에 같은 겹을 세웠다).
   *
   * **보낼 수 있을 때만 보낸다 — 버튼 잠금과 별개의 겹이다.** 폼은 버튼을 지나지 않는 제출
   * 경로를 갖는다(Enter · 프로그램적 제출). 그 길로 규칙을 어긴 값이 나가면 서버가 실패한
   * 시도로 세고, 되돌릴 수 없는 쓰기에서는 그 한 번이 값을 바꿔 놓을 수도 있다.
   *
   * 그래서 **보내는 문을 하나로 둔다**(`sendChange`) — **폼 제출과 Enter가 이 문을 지난다.**
   *
   * ⚠ **배너의 「다시 시도」는 이 문을 지나지 않는다**(`change.retry`). 그것이 보내는 것은 지금
   * 화면의 값이 아니라 **이미 나간 그 시도**이고, 나가는 중에 값이 깨졌더라도 눌러야 하기
   * 때문이다 — 이 문에 붙이면 `canSubmit`이 거짓인 동안 **누를 수 있는데 아무 일도 없는 버튼**이
   * 된다(감지기 「나가는 중 값을 깨뜨린 뒤 통신 실패해도 다시 시도가 같은 키로 되보낸다」가 잰다).
   */
  const sendChange = (): void => {
    if (change.isSubmitting || !canSubmit(draft)) return;

    change.submit(draft);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    sendChange();
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
      {/*
       * 화면 수준 실패만 여기 선다 — 칸에 붙일 수 있는 것은 그 칸 옆에 있다. 배너 부품이
       * 「세우지 않아야 하는 갈래」에 `null`을 주므로 화면은 갈래를 다시 가르지 않는다.
       */}
      {change.outcome !== null && (
        <ChangeErrorBanner outcome={change.outcome} onRetry={change.retry} />
      )}

      <form className="password-form" onSubmit={handleSubmit}>
        <div className="password-fields">
          {/*
           * 이 칸의 오류는 **서버만 안다** — 화면이 스스로 잡을 규칙이 없다. 그래서 401이 이 칸에
           * 인라인으로 선다(배너로 올리지 않는다 — 이미 인증된 본인이라 붙은 자리가 흘릴 것이 없다).
           */}
          <TextField
            label={t.fields.currentPassword}
            type="password"
            value={draft.currentPassword}
            autoComplete="current-password"
            error={errors.currentPassword}
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
