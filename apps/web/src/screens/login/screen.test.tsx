import { messages } from '@omf-mes/i18n';
import { createEvent, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { errorResponseBody, loginFailureBody, sessionBody } from './fixtures';
import { LOGIN_ID_MAX_LENGTH } from './login-draft';
import { LoginScreen } from './screen';

const t = messages.login;

/** 합성값이다. 그럴듯한 자격이 되지 않게 대역을 드러내는 글자만 쓴다(공개 저장소 경계). */
const SYNTHETIC_LOGIN_ID = 'SYN-LOGIN-01';
const SYNTHETIC_PASSWORD = 'SYN-PW-VALUE-01';

const SESSIONS_PATH = '/app/sessions';
/** 로그인 화면이 서 있는 주소와, 성공했을 때 가야 할 곳. */
const LOGIN_ROUTE = '/login';
const HOME_ROUTE = '/';

const sessionsRoute = (respond: (request: Request) => Response): StubRoute => ({
  match: (request) => new URL(request.url).pathname === SESSIONS_PATH,
  respond,
});

/** 주소가 실제로 어떻게 바뀌는지 본다 — 이동 규칙을 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{location.pathname}</output>;
};

/** 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다. */
const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1);
      }}
    >
      뒤로
    </button>
  );
};

interface RenderOptions {
  /** 주지 않으면 하네스가 **모든 요청에 던진다** — 「이 갈래는 서버를 부르지 않는다」가 그대로 잰다. */
  fetch?: StubFetch;
  /** 주소 이동을 재는 시험에서만 켠다 — 다른 시험의 DOM을 넓히지 않는다. */
  probes?: boolean;
}

/**
 * **이 회차부터 하네스를 끼운다.** 앞 회차의 이 자리에는 「프로바이더 없이 렌더한다 —
 * 여기서 하네스가 필요해지는 순간이 곧 폼이 자기 힘으로 서지 못하게 됐다는 신호다」가
 * 적혀 있었다. 그 순간이 이 회차다: 화면이 서버를 부르고 주소를 옮긴다.
 *
 * **기본값은 스텁 없는 하네스다.** 요청이 나가면 하네스가 던지므로, 서버를 부르지 않아야 할
 * 갈래(폼 렌더·활성 조건)에서는 「부르지 않았다」가 저절로 측정된다.
 */
const renderScreen = (options: RenderOptions = {}) => {
  const user = userEvent.setup();
  const result = renderWithProviders(
    <>
      <LoginScreen />
      {options.probes === true && (
        <>
          <LocationProbe />
          <BackProbe />
        </>
      )}
    </>,
    { fetch: options.fetch, route: LOGIN_ROUTE },
  );

  return { user, ...result };
};

const loginIdBox = (): HTMLElement => screen.getByLabelText(t.fields.loginId);
const passwordBox = (): HTMLElement => screen.getByLabelText(t.fields.password);
const submitButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.submit });
const currentPath = (): string => screen.getByTestId('location').textContent ?? '';

/** 두 칸을 채워 로그인 버튼을 연다. 보내는 갈래의 시험은 전부 여기서 시작한다. */
const fillCredentials = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(loginIdBox(), SYNTHETIC_LOGIN_ID);
  await user.type(passwordBox(), SYNTHETIC_PASSWORD);
};

describe('LoginScreen — 셸 밖에 선다', () => {
  /**
   * 이 화면은 관리웹에서 **`AppShell`을 쓰지 않는 유일한 화면**이다(스펙 근거: omf-mes#155).
   * 아직 로그인하지 않은 사람에게 사이드바를 보이면 누를 수 없는 항목만 늘어선 화면이 된다.
   */
  it('자기 본문을 렌더하고 사이드바를 두지 않는다', () => {
    renderScreen();

    /* 양성 먼저 — 화면이 실제로 섰음을 잡은 **뒤에** 없음을 잰다. */
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();

    expect(screen.queryByRole('navigation')).toBeNull();
  });

  /**
   * 셸이 없어 이 표제가 **화면의 유일한 이름**이다. 셸이 있는 화면은 `AppShell`이 본문 이름을
   * 주지만(`mainLabel`) 여기에는 줄 사람이 없어 표제가 그 자리를 맡는다 — 표제를 지우면
   * 본문이 이름 없는 랜드마크로 남는다. 그 둘을 **한 시점에** 잰다.
   */
  it('표제가 서고 그것이 본문의 이름이 된다', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: t.title })).toBeInTheDocument();
  });
});

describe('LoginScreen — 입력 칸', () => {
  it('아이디와 비밀번호 칸을 각각 이름으로 찾을 수 있다', () => {
    renderScreen();

    expect(loginIdBox()).toBeInTheDocument();
    expect(passwordBox()).toBeInTheDocument();
  });

  it('비밀번호 칸은 친 값을 가린다', () => {
    renderScreen();

    expect(passwordBox()).toHaveAttribute('type', 'password');
  });

  /** 계약이 정한 상한을 칸이 직접 막는다 — 넘겨 친 값이 요청에 실릴 자리를 만들지 않는다. */
  it('아이디 칸에 계약 상한이 걸려 있다', () => {
    renderScreen();

    expect(loginIdBox()).toHaveAttribute('maxlength', String(LOGIN_ID_MAX_LENGTH));
  });

  /**
   * **친 값을 다듬지 않는다 — 두 칸 다.** 앞뒤 공백은 비밀번호에서 값의 일부일 수 있어,
   * 화면이 걷어내면 사용자가 친 것과 다른 값이 서버로 간다. 공백만 있는지는 **판정할 때만**
   * 걷어내고 본다.
   *
   * ⚠ **비밀번호 칸을 반드시 함께 잰다.** 이 규칙의 근거가 비밀번호인데 아이디만 재면,
   * 비밀번호 쪽에 `.trim()`이 들어가도 아무 감지기가 울리지 않는다. 그러고도 이 화면은
   * 실패를 「아이디 또는 비밀번호가 맞지 않습니다」로만 뭉뚱그리므로(계정 열거 방지) 값이
   * 왜곡된 사실이 사용자에게도 화면에도 드러나지 않는다.
   */
  it('앞뒤 공백을 친 그대로 둔다', async () => {
    const { user } = renderScreen();

    await user.type(loginIdBox(), `  ${SYNTHETIC_LOGIN_ID}  `);
    await user.type(passwordBox(), `  ${SYNTHETIC_PASSWORD}  `);

    expect(loginIdBox()).toHaveValue(`  ${SYNTHETIC_LOGIN_ID}  `);
    expect(passwordBox()).toHaveValue(`  ${SYNTHETIC_PASSWORD}  `);
  });

  /**
   * `<form>` + `autocomplete`는 브라우저·비밀번호 관리자가 **자격 입력임을 알아보는 표준 짝**이다.
   * 값이 빠져도 화면에는 아무 표시가 나지 않는다 — 저장된 자격을 못 쓰게 되는 것만 조용히 남는다.
   */
  it('자격 입력임을 브라우저에 알린다', () => {
    renderScreen();

    expect(loginIdBox()).toHaveAttribute('autocomplete', 'username');
    expect(passwordBox()).toHaveAttribute('autocomplete', 'current-password');
  });
});

describe('LoginScreen — 로그인 버튼의 활성 조건', () => {
  it('아무것도 치지 않았으면 잠겨 있고 사유가 보인다', () => {
    renderScreen();

    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.incomplete)).toBeInTheDocument();
  });

  /**
   * 사유는 감추지 않고 **항상 보이는 DOM 텍스트**로 렌더해 `aria-describedby`로 잇는다 —
   * 잠긴 버튼은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다
   * (배치 규범 4-1).
   */
  it('사유가 잠긴 버튼에 붙어 있다', () => {
    renderScreen();

    const reason = screen.getByText(t.actionReasons.incomplete);

    expect(reason.id).not.toBe('');
    expect(submitButton()).toHaveAttribute('aria-describedby', reason.id);
  });

  it('아이디만 치면 잠긴 채로 사유가 보인다', async () => {
    const { user } = renderScreen();

    await user.type(loginIdBox(), SYNTHETIC_LOGIN_ID);

    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.incomplete)).toBeInTheDocument();
  });

  it('비밀번호만 치면 잠긴 채로 사유가 보인다', async () => {
    const { user } = renderScreen();

    await user.type(passwordBox(), SYNTHETIC_PASSWORD);

    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.incomplete)).toBeInTheDocument();
  });

  it('둘 다 공백만 치면 잠긴 채로 사유가 보인다', async () => {
    const { user } = renderScreen();

    await user.type(loginIdBox(), '   ');
    await user.type(passwordBox(), '   ');

    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.incomplete)).toBeInTheDocument();
  });

  it('둘 다 치면 버튼이 열리고 사유가 사라진다', async () => {
    const { user } = renderScreen();

    await user.type(loginIdBox(), SYNTHETIC_LOGIN_ID);
    await user.type(passwordBox(), SYNTHETIC_PASSWORD);

    /* 양성 먼저 — 버튼이 실제로 열린 것을 잡은 **뒤에** 사유가 없음을 잰다. */
    expect(submitButton()).toBeEnabled();

    expect(screen.queryByText(t.actionReasons.incomplete)).toBeNull();
    expect(submitButton()).not.toHaveAttribute('aria-describedby');
  });
});

describe('LoginScreen — 두지 않은 것', () => {
  /**
   * 「로그인 상태 유지」와 초기 비밀번호 안내는 **두지 않기로 한 것**이다(착수 이슈 omf-mes#155).
   * 없음을 재는 단언이므로 **양성 단언이 화면을 잡은 뒤**에 잰다 — 렌더 전에 재면
   * 아직 아무것도 없는 화면에서 언제나 통과하는 무의미한 단언이 된다(사본 체크리스트).
   */
  it('「로그인 상태 유지」 컨트롤을 두지 않는다', () => {
    renderScreen();

    expect(loginIdBox()).toBeInTheDocument();
    expect(passwordBox()).toBeInTheDocument();

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/로그인 상태 유지/)).toBeNull();
  });

  it('초기 비밀번호 안내를 두지 않는다', () => {
    renderScreen();

    expect(loginIdBox()).toBeInTheDocument();
    expect(passwordBox()).toBeInTheDocument();

    expect(screen.queryByText(/초기 비밀번호/)).toBeNull();
  });

  /** 칸은 둘뿐이다 — 비밀번호 칸은 `textbox` 역할을 갖지 않으므로 남는 것은 아이디 하나다. */
  it('입력 칸을 더 두지 않는다', () => {
    renderScreen();

    expect(loginIdBox()).toBeInTheDocument();

    expect(screen.queryAllByRole('textbox')).toHaveLength(1);
  });
});

describe('LoginScreen — 폼의 기본 제출', () => {
  /**
   * ⛔ **기본 제출을 막지 않으면 비밀번호가 주소에 실린다.** `<form>`은 기본이 GET 제출이라
   * Enter 한 번에 값이 질의 문자열로 올라가고, 그 주소는 방문 기록·전달 경로에 그대로 남는다.
   * 이 저장소는 공개이고 그 노출은 되돌릴 수 없다 — 보내는 경로가 붙기 **전인 지금부터** 막는다.
   */
  it('기본 제출을 막는다', () => {
    renderScreen();

    const form = submitButton().closest('form');

    if (!(form instanceof HTMLFormElement)) {
      throw new Error('로그인 폼을 찾지 못했습니다');
    }

    const submitEvent = createEvent.submit(form);

    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
  });

  /** Enter로 보내는 길이 로그인의 기본 조작이라, 버튼은 폼의 제출 버튼이어야 한다. */
  it('로그인 버튼이 폼의 제출 버튼이다', () => {
    renderScreen();

    expect(submitButton()).toHaveAttribute('type', 'submit');
  });
});

describe('LoginScreen — 성공하면 관리웹으로 넘어간다', () => {
  /**
   * **`replace`로 넘긴다**(완료 조건 T2-4). 밀어 넣으면 로그인 화면이 히스토리에 남아
   * 뒤로가기 한 번에 **이미 로그인한 사람이 로그인 화면**으로 되돌아간다. 그 화면은 자기가
   * 로그인된 줄 모르므로 사용자는 자격을 한 번 더 친다.
   *
   * 뒤로가기를 **실제로 눌러** 잰다 — 히스토리가 늘었는지는 그 방법으로만 알 수 있다.
   */
  it('200이면 관리웹 첫 화면으로 넘어가고 뒤로가기가 로그인으로 돌아오지 않는다', async () => {
    const { user } = renderScreen({
      fetch: createStubFetch([sessionsRoute(() => jsonResponse(sessionBody()))]),
      probes: true,
    });

    expect(currentPath()).toBe(LOGIN_ROUTE);

    await fillCredentials(user);
    await user.click(submitButton());

    await waitFor(() => {
      expect(currentPath()).toBe(HOME_ROUTE);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    expect(currentPath()).not.toBe(LOGIN_ROUTE);
  });
});

describe('LoginScreen — 실패를 어떻게 알리는가', () => {
  const failing = (status: number, body: unknown): StubFetch =>
    createStubFetch([sessionsRoute(() => jsonResponse(body, { status }))]);

  /**
   * ⛔ **어느 칸이 틀렸는지 말하지 않는다**(공유계약 F-7). 「없는 아이디입니다」류의 문구는
   * 계정이 있는지를 흘려, 아이디 목록을 만드는 사람에게 그대로 답이 된다.
   */
  it('401이면 뭉뚱그린 문구가 화면 수준 배너로 뜬다', async () => {
    const { user } = renderScreen({ fetch: failing(401, loginFailureBody()) });

    await fillCredentials(user);
    await user.click(submitButton());

    const banner = await screen.findByRole('alert');

    expect(banner).toHaveTextContent(t.banner.mismatch);
  });

  /**
   * **인라인으로 내리지 않는다**(공유계약 G-1 · F-7). 칸 옆에 붙은 오류는 그 자체로 어느 칸이
   * 문제인지 가리키므로, 문구를 아무리 뭉뚱그려도 **붙은 자리가 답을 말한다.**
   *
   * 음성 단언이라 **배너를 잡은 뒤**에 잰다.
   */
  it('401에 아이디·비밀번호 칸의 인라인 오류가 붙지 않는다', async () => {
    const { user } = renderScreen({ fetch: failing(401, loginFailureBody()) });

    await fillCredentials(user);
    await user.click(submitButton());

    await screen.findByRole('alert');

    expect(loginIdBox()).not.toHaveAttribute('aria-invalid');
    expect(passwordBox()).not.toHaveAttribute('aria-invalid');
    expect(loginIdBox()).not.toHaveAccessibleDescription(t.banner.mismatch);
    expect(passwordBox()).not.toHaveAccessibleDescription(t.banner.mismatch);
  });

  /**
   * ⭐ **자격이 틀렸다는 말은 401에만 붙는다.** 실패를 뭉뚱그리는 화면이 저지르기 쉬운 실수가
   * 「응답이 실패면 무조건 그 문구」인데, 잠긴 계정에 그 말을 하면 사용자는 맞는 자격을
   * 의심하며 되풀이 시도한다 — 이미 잠긴 계정에 대고.
   *
   * 이 회차는 잠긴 계정 전용 안내를 아직 두지 않는다. **말하지 않는 것**까지가 이 회차의 몫이다.
   */
  it('423에는 아이디·비밀번호 문구를 내지 않는다', async () => {
    const { user } = renderScreen({ fetch: failing(423, errorResponseBody()) });

    await fillCredentials(user);
    await user.click(submitButton());

    /* 양성 먼저 — 시도가 끝나 버튼이 다시 열린 것을 잡은 뒤에 없음을 잰다. */
    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });

    expect(screen.queryByText(t.banner.mismatch)).toBeNull();
  });

  /** 값을 고치면 앞 시도의 실패는 그 값에 대한 진술이 아니게 된다. */
  it('아이디나 비밀번호를 고치면 실패 배너가 걷힌다', async () => {
    const { user } = renderScreen({ fetch: failing(401, loginFailureBody()) });

    await fillCredentials(user);
    await user.click(submitButton());
    await screen.findByRole('alert');

    await user.type(passwordBox(), 'X');

    expect(screen.queryByText(t.banner.mismatch)).toBeNull();
  });
});

describe('LoginScreen — 보내는 동안과 그 뒤', () => {
  /**
   * ⭐ **두 스텁 형태 — 호출 횟수에 따라 내용이 달라진다**(사본 체크리스트).
   *
   * 같은 응답을 되돌리는 스텁으로는 「다시 시도가 실제로 나갔다」를 잴 수 없다.
   * 1회차 401 → 2회차 200이라야 두 번째 요청이 정말 새로 나갔고 그 답이 화면을 옮겼음이 잡힌다.
   */
  it('실패한 뒤 다시 눌러 성공할 수 있다', async () => {
    let calls = 0;
    const { user } = renderScreen({
      fetch: createStubFetch([
        sessionsRoute(() => {
          calls += 1;

          return calls === 1
            ? jsonResponse(loginFailureBody(), { status: 401 })
            : jsonResponse(sessionBody());
        }),
      ]),
      probes: true,
    });

    await fillCredentials(user);
    await user.click(submitButton());
    await screen.findByRole('alert');

    await waitFor(() => {
      expect(submitButton()).toBeEnabled();
    });

    await user.click(submitButton());

    await waitFor(() => {
      expect(currentPath()).toBe(HOME_ROUTE);
    });

    expect(calls).toBe(2);
    expect(screen.queryByText(t.banner.mismatch)).toBeNull();
  });

  /**
   * 나가는 동안 버튼을 잠근다 — 연타가 그대로 요청 두 벌이 되고, 시도마다 새 멱등 키를 만들므로
   * 서버에는 서로 다른 시도로 보인다. **잠갔으면 사유가 함께 선다**(배치 규범 4).
   */
  it('나가는 동안 버튼이 잠기고 그 사유가 보인다', async () => {
    let release = (): void => {
      /* 아래 Promise 생성자가 곧바로 채운다. */
    };
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stub = createStubFetch([sessionsRoute(() => jsonResponse(sessionBody()))]);
    const { user } = renderScreen({
      fetch: async (request) => {
        await gate;

        return stub(request);
      },
      probes: true,
    });

    await fillCredentials(user);
    await user.click(submitButton());

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });

    const reason = screen.getByText(t.actionReasons.submitting);

    expect(submitButton()).toHaveAttribute('aria-describedby', reason.id);

    release();

    await waitFor(() => {
      expect(currentPath()).toBe(HOME_ROUTE);
    });
  });

  /**
   * ⭐ **나가는 중에 값을 고쳐도 되먹임이 끊기지 않는다**(사본 체크리스트 `resetIfIdle` ·
   * `omf-mes#96`).
   *
   * 값을 고칠 때 실패 배너를 걷는데, 그 자리가 진행 중 요청까지 되돌리면 **세션은 만들어졌는데
   * 로그인되지 않은 화면**이 남는다. 요청은 이미 서버에 갔고 화면만 없던 일로 친 상태다.
   */
  it('나가는 중에 값을 고쳐도 성공 이동이 그대로 일어난다', async () => {
    let release = (): void => {
      /* 아래 Promise 생성자가 곧바로 채운다. */
    };
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stub = createStubFetch([sessionsRoute(() => jsonResponse(sessionBody()))]);
    const { user } = renderScreen({
      fetch: async (request) => {
        await gate;

        return stub(request);
      },
      probes: true,
    });

    await fillCredentials(user);
    await user.click(submitButton());

    await waitFor(() => {
      expect(submitButton()).toBeDisabled();
    });

    /* 나가는 중에 값을 고친다 — 되돌리는 자리를 지나지만 요청을 끊어서는 안 된다. */
    await user.type(loginIdBox(), 'X');

    release();

    await waitFor(() => {
      expect(currentPath()).toBe(HOME_ROUTE);
    });
  });
});
