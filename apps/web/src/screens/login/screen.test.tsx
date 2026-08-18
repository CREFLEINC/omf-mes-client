import { messages } from '@omf-mes/i18n';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LOGIN_ID_MAX_LENGTH } from './login-draft';
import { LoginScreen } from './screen';

const t = messages.login;

/** 합성값이다. 그럴듯한 자격이 되지 않게 대역을 드러내는 글자만 쓴다(공개 저장소 경계). */
const SYNTHETIC_LOGIN_ID = 'SYN-LOGIN-01';
const SYNTHETIC_PASSWORD = 'SYN-PW-VALUE-01';

/**
 * **프로바이더 없이 렌더한다.** 이 회차의 화면은 서버도 주소도 부르지 않으므로, 하네스를
 * 끼우면 「무엇이 없어도 서는가」가 흐려진다. 나중에 조회가 붙어도 이 자리는 그대로 둔다 —
 * 여기서 하네스가 필요해지는 순간이 곧 「폼이 자기 힘으로 서지 못하게 됐다」는 신호다.
 */
const renderScreen = () => {
  const user = userEvent.setup();
  const result = render(<LoginScreen />);

  return { user, ...result };
};

const loginIdBox = (): HTMLElement => screen.getByLabelText(t.fields.loginId);
const passwordBox = (): HTMLElement => screen.getByLabelText(t.fields.password);
const submitButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.submit });

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
