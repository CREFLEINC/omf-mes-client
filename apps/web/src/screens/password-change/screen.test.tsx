import { messages } from '@omf-mes/i18n';
import { createEvent, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { passwordDraftFixture } from './fixtures';
import { MIN_NEW_PASSWORD_LENGTH, type PasswordDraft } from './password-draft';
import { PasswordChangeScreen } from './screen';

const t = messages.passwordChange;

/** 이 화면이 설 주소와, 직접 진입한 사람이 취소했을 때 가야 할 곳. */
const PASSWORD_CHANGE_ROUTE = '/system/password-change';
const HOME_ROUTE = '/';
/** 앞 화면 자리. **합성 주소다** — 실재하는 화면을 골라 두면 그 화면이 옮겨갈 때 함께 깨진다. */
const PREVIOUS_ROUTE = '/system/synthetic-previous';

const TOO_SHORT = 'S'.repeat(MIN_NEW_PASSWORD_LENGTH - 1);

/**
 * 화면 밖 문구가 섞이지 않게 이 블록의 문구만 훑는다. 함수 문구는 최소 길이를 넣어 펼친다 —
 * 이 블록의 문구 함수는 전부 숫자 하나를 받는다.
 *
 * ⚠ **인자 수를 함께 잰다.** 뒤 회차가 인자 형태가 다른 문구를 더하면 펼치기가 조용히
 * `undefined`가 섞인 문자열을 만들고, 그때 금칙어 훑기는 **약해진 줄 모르는 채** 통과한다.
 * 여기서 먼저 깨져야 그 자리를 함께 고친다.
 */
const blockTexts = (block: Record<string, unknown>): string[] =>
  Object.values(block).flatMap((value): string[] => {
    if (typeof value === 'string') return [value];

    if (typeof value === 'function') {
      expect(value).toHaveLength(1);

      return [String((value as (argument: number) => string)(MIN_NEW_PASSWORD_LENGTH))];
    }

    if (typeof value === 'object' && value !== null) {
      return blockTexts(value as Record<string, unknown>);
    }

    return [];
  });

/**
 * ⛔ **이 화면이 절대 말하지 않는 것들.** 전례(로그인)에서 한 글자도 넘어오면 안 되는 자리다.
 *
 * 잠금·남은 시도 횟수는 이 화면에 **없는 갈래**다 — 이미 인증된 본인이라 틀려도 잠그지 않는다.
 * 조합 규칙·재사용 금지는 설계가 범위에서 뺐고, 재로그인은 스펙이 금지했다. 문구가 먼저 생기면
 * 사용자는 그 규칙이 있다고 믿는다.
 */
const FORBIDDEN_PHRASES = [
  '잠기',
  '잠깁',
  '잠긴',
  '잠금',
  '시도 횟수',
  '남은 횟수',
  '강도',
  '대문자',
  '특수문자',
  '재사용',
  '다시 로그인',
  '로그아웃',
];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 취소의 이동 규칙을 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{location.pathname}</output>;
};

/** 앞 화면 대역. 여기서 눌러 들어가야 **히스토리가 두 칸**이 된다. */
const PreviousScreenStub = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(PASSWORD_CHANGE_ROUTE);
      }}
    >
      앞 화면에서 이동
    </button>
  );
};

/** 주소로 직접 들어온 자리 — 히스토리 항목이 하나뿐이다. */
const renderScreen = () => {
  const user = userEvent.setup();
  const result = renderWithProviders(
    <>
      <PasswordChangeScreen />
      <LocationProbe />
    </>,
    { route: PASSWORD_CHANGE_ROUTE },
  );

  return { user, ...result };
};

/** 앞 화면에서 눌러 들어온 자리 — 히스토리가 두 칸이다. */
const renderAfterNavigation = async () => {
  const user = userEvent.setup();
  const result = renderWithProviders(
    <>
      <Routes>
        <Route path={PREVIOUS_ROUTE} element={<PreviousScreenStub />} />
        <Route path={PASSWORD_CHANGE_ROUTE} element={<PasswordChangeScreen />} />
      </Routes>
      <LocationProbe />
    </>,
    { route: PREVIOUS_ROUTE },
  );

  await user.click(screen.getByRole('button', { name: '앞 화면에서 이동' }));

  return { user, ...result };
};

const currentBox = (): HTMLElement => screen.getByLabelText(t.fields.currentPassword);
const newBox = (): HTMLElement => screen.getByLabelText(t.fields.newPassword);
const confirmBox = (): HTMLElement => screen.getByLabelText(t.fields.confirmPassword);
const submitButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.submit });
const cancelButton = (): HTMLElement =>
  screen.getByRole('button', { name: messages.common.cancel });
const currentPath = (): string => screen.getByTestId('location').textContent ?? '';

/**
 * 그 칸에 **실제로 매인** 오류 문구. `aria-describedby`가 가리키는 요소를 따라간다.
 *
 * ⭐ 화면 어딘가에 문구가 있다는 것과 **그 칸에 붙어 있다**는 것은 다르다. 짝 제약을 한 칸에만
 * 세우는 결함은 문구 존재만 재는 시험을 그대로 통과한다 — 붙은 자리를 재야 걸린다.
 */
const errorTextFor = (box: HTMLElement): string =>
  (box.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

/** 세 칸을 한 번에 채운다. 규칙을 어기는 자리만 인자로 바꾼다. */
const fillDraft = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<PasswordDraft> = {},
): Promise<void> => {
  const draft = passwordDraftFixture(overrides);

  if (draft.currentPassword !== '') await user.type(currentBox(), draft.currentPassword);
  if (draft.newPassword !== '') await user.type(newBox(), draft.newPassword);
  if (draft.confirmPassword !== '') await user.type(confirmBox(), draft.confirmPassword);
};

describe('PasswordChangeScreen — 셸 안에 선다', () => {
  /**
   * 이 화면은 **셸 안 화면**이다 — 로그인과 정반대다. 이미 로그인한 사람이 자기 비밀번호를
   * 바꾸는 자리라 사이드바와 상단 바가 그대로 있어야 한다. 셸(`AppShell`)은 `AppLayout`이 주므로
   * 화면은 제목 줄만 세운다.
   */
  it('제목과 경로가 선다', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: t.title })).toBeInTheDocument();

    const breadcrumb = screen.getByRole('navigation');

    expect(breadcrumb).toHaveTextContent(t.breadcrumbRoot);
    expect(breadcrumb).toHaveTextContent(t.title);
  });

  it('세 칸이 접근 가능한 이름으로 서고 전부 가려진 칸이다', () => {
    renderScreen();

    for (const box of [currentBox(), newBox(), confirmBox()]) {
      expect(box).toHaveAttribute('type', 'password');
    }
  });

  /**
   * 브라우저·암호 관리자가 **어느 칸이 무엇인지** 알아야 현재 값을 채우고 새 값을 저장한다.
   * 세 칸이 같은 `autoComplete`를 쓰면 새 값 자리에 현재 값이 채워진다.
   */
  it('칸마다 자동완성 힌트가 제 몫으로 다르다', () => {
    renderScreen();

    expect(currentBox()).toHaveAttribute('autocomplete', 'current-password');
    expect(newBox()).toHaveAttribute('autocomplete', 'new-password');
    expect(confirmBox()).toHaveAttribute('autocomplete', 'new-password');
  });

  /**
   * 안내 문구는 **최소 길이 상수를 주입받아** 만들어진다. 문구에 숫자를 손으로 적으면 상수를
   * 바꿀 때 문구만 옛 값으로 남고, 그때 화면은 지키지 않는 규칙을 말하게 된다.
   */
  it('안내 문구가 최소 길이 상수를 주입받는다', () => {
    renderScreen();

    expect(screen.getByText(t.notice(MIN_NEW_PASSWORD_LENGTH))).toBeInTheDocument();

    /* 인자를 바꾸면 문구도 바뀌어야 한다 — 손으로 적은 숫자는 여기서 걸린다. */
    expect(t.notice(MIN_NEW_PASSWORD_LENGTH + 1)).not.toBe(t.notice(MIN_NEW_PASSWORD_LENGTH));
    expect(t.notice(MIN_NEW_PASSWORD_LENGTH)).toContain(String(MIN_NEW_PASSWORD_LENGTH));
  });
});

describe('PasswordChangeScreen — 인라인 오류', () => {
  /**
   * ⭐ **인라인으로 낸다 — 전례(로그인)와 반대다.** 로그인 화면이 칸을 지목하지 않는 것은 붙은
   * 자리가 「그 아이디는 있다」를 흘리기 때문인데, 여기서는 이미 인증된 본인만 보므로 흘릴 것이
   * 없다. 지목하지 않으면 세 칸 중 어디를 고쳐야 하는지 알 수 없다.
   */
  it('새 비밀번호가 최소 길이보다 짧으면 그 칸에 오류가 붙는다', async () => {
    const { user } = renderScreen();

    await user.type(newBox(), TOO_SHORT);

    expect(newBox()).toBeInvalid();
    expect(errorTextFor(newBox())).toContain(t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH));
  });

  it('최소 길이를 채우면 그 오류가 사라진다', async () => {
    const { user } = renderScreen();

    await user.type(newBox(), TOO_SHORT);

    /* 양성 먼저 — 오류가 실제로 선 것을 잡은 **뒤에** 사라짐을 잰다. */
    expect(newBox()).toBeInvalid();

    await user.type(newBox(), 'S');

    expect(newBox()).toBeValid();
    expect(screen.queryByText(t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH))).toBeNull();
  });

  /**
   * ⭐ **공유계약 A-2 — 짝 제약은 두 칸 모두에 선다.** 한쪽만 붉히면 새 값을 고쳐야 하는지 확인
   * 값을 고쳐야 하는지 알 수 없다. 형제 사본(`approval-route/route-validation.ts`)이 같은 형태의
   * 제약을 한 칸에만 세우므로, 그것을 그대로 옮겼는지 이 시험이 가른다.
   */
  it('새 비밀번호와 확인 값이 다르면 두 칸 모두에 오류가 붙는다', async () => {
    const { user } = renderScreen();

    await fillDraft(user, { confirmPassword: 'SYN-NEXT-0002' });

    expect(newBox()).toBeInvalid();
    expect(confirmBox()).toBeInvalid();
    expect(errorTextFor(newBox())).toContain(t.validation.confirmMismatch);
    expect(errorTextFor(confirmBox())).toContain(t.validation.confirmMismatch);
  });

  /**
   * 한 칸에는 한 문장이고 **자기 규칙이 짝 오류를 이긴다.** 그때도 확인 칸에는 짝 오류가 서므로
   * **두 칸이 함께 표시되는 사실은 유지된다** — 우선순위가 「두 칸 동시」를 깨뜨리지 않는다.
   */
  it('길이도 모자라고 확인 값도 다르면 두 칸에 각자의 문장이 붙는다', async () => {
    const { user } = renderScreen();

    await fillDraft(user, { newPassword: TOO_SHORT, confirmPassword: `${TOO_SHORT}-X` });

    expect(errorTextFor(newBox())).toContain(t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH));
    expect(errorTextFor(confirmBox())).toContain(t.validation.confirmMismatch);
    expect(newBox()).toBeInvalid();
    expect(confirmBox()).toBeInvalid();
  });

  it('새 비밀번호가 현재 비밀번호와 같으면 그 칸에 오류가 붙는다', async () => {
    const { user } = renderScreen();

    const same = 'SYN-CURRENT-0001';

    await fillDraft(user, { currentPassword: same, newPassword: same, confirmPassword: same });

    expect(errorTextFor(newBox())).toContain(t.validation.sameAsCurrent);
  });

  /**
   * 빈 칸에는 아무것도 그리지 않는다(결정 ④) — 첫 글자부터 붉은 글씨가 서면 치는 내내 오류를
   * 본다. 빈 칸의 사정은 **버튼 비활성 사유**가 말한다.
   */
  it('빈 칸에는 오류를 그리지 않는다', async () => {
    const { user } = renderScreen();

    await user.type(newBox(), TOO_SHORT);

    /* 양성 먼저 — 채운 칸에서 오류가 실제로 서는 것을 잡은 **뒤에** 빈 칸을 잰다. */
    expect(newBox()).toBeInvalid();

    expect(currentBox()).toBeValid();
    expect(confirmBox()).toBeValid();
  });
});

describe('PasswordChangeScreen — 「변경」의 활성 조건', () => {
  it('아무것도 치지 않았으면 잠겨 있고 사유가 붙어 있다', () => {
    renderScreen();

    expect(submitButton()).toBeDisabled();

    const reason = screen.getByText(t.actionReasons.incomplete);

    expect(reason.id).not.toBe('');
    expect(submitButton()).toHaveAttribute('aria-describedby', reason.id);
  });

  /**
   * ⭐ **배치 규범 4-2 — 사유는 그 컨트롤 바로 아래, 왼쪽 가장자리를 맞춰 선다.** 그 세로 묶음이
   * 규범 2의 `.field-cell`이고, 형제 화면들이 예외 없이 그 형태를 쓴다(`stock-adjust` ·
   * `po-register` · `disposal-issue` · 부품 `users-roles/disabled-action.tsx`).
   *
   * ⚠ **이 감지기가 재는 CSS 전제**: 액션 줄 `.form-actions`는 `display:flex`에
   * `justify-content:flex-end`인 **행**이다(`app/app.css`). 그래서 사유를 그 **직속**에 두면
   * 버튼 아래가 아니라 **오른쪽**에 세 번째 항목으로 선다. 전례(`login/screen.tsx`)의 같은 자식
   * 구조가 성립했던 것은 그쪽 컨테이너가 flex가 아니라 **블록**(`.login-actions`)이었기
   * 때문이다 — **컨테이너를 바꿔 옮기면 자식 묶음도 함께 바꿔야 한다.**
   *
   * jsdom은 이 저장소의 CSS를 적용하지 않으므로(폭·정렬은 잴 수 없다) 형제 선례
   * (`item-extended-attrs/disabled-action.test.tsx`)와 같이 **묶음 구조**로 잰다.
   */
  it('사유가 「변경」과 같은 세로 묶음(.field-cell) 안에 선다', () => {
    renderScreen();

    const reason = screen.getByText(t.actionReasons.incomplete);
    const cell = submitButton().closest('.field-cell');

    expect(cell).not.toBeNull();
    expect(cell).toContainElement(reason);
  });

  /**
   * 칸 열과 액션 줄이 **같은 폭 상한 컨테이너 안**에 선다. 칸 열에만 상한을 주면 넓은 창에서
   * 칸은 왼쪽 24rem에 서고 취소·변경은 화면 오른쪽 끝으로 갈라진다 — 상한 값 자체는 CSS가
   * 소유하고(`.password-form`), 여기서는 **두 열이 같은 상한을 지난다**는 구조를 잰다.
   */
  it('칸 열과 액션 줄이 같은 폭 상한 컨테이너 안에 선다', () => {
    const { container } = renderScreen();

    const fields = container.querySelector('.password-fields');
    const actions = container.querySelector('.form-actions');
    const capped = fields?.closest('.password-form');

    expect(capped).not.toBeNull();
    expect(actions?.closest('.password-form')).toBe(capped);
  });

  it('칸은 다 찼지만 규칙이 깨졌으면 잠기고 사유가 칸의 오류를 가리킨다', async () => {
    const { user } = renderScreen();

    await fillDraft(user, { newPassword: TOO_SHORT, confirmPassword: TOO_SHORT });

    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.invalid)).toBeInTheDocument();
  });

  /**
   * 「공백만 친 칸도 채운 것으로 센다」의 **화면 계층 짝**이다. 판정은 초안이 소유하지만, 그
   * 판정이 사용자에게 드러나는 자리는 **가려진 칸이 있는 화면**이다 — 점이 보이는데 「모두
   * 입력하면 쓸 수 있습니다」가 서 있으면 무엇을 더 쳐야 하는지 알 수 없다.
   */
  it('세 칸에 공백만 쳐도 「변경」이 열린다', async () => {
    const { user } = renderScreen();

    const spaces = ' '.repeat(MIN_NEW_PASSWORD_LENGTH);

    await user.type(currentBox(), 'SYN-CURRENT-0002');
    await user.type(newBox(), spaces);
    await user.type(confirmBox(), spaces);

    expect(submitButton()).toBeEnabled();
    expect(screen.queryByText(t.actionReasons.incomplete)).toBeNull();
  });

  it('세 칸이 규칙을 만족하면 열리고 사유가 사라진다', async () => {
    const { user } = renderScreen();

    await fillDraft(user);

    /* 양성 먼저 — 버튼이 실제로 열린 것을 잡은 **뒤에** 사유가 없음을 잰다. */
    expect(submitButton()).toBeEnabled();

    expect(screen.queryByText(t.actionReasons.incomplete)).toBeNull();
    expect(screen.queryByText(t.actionReasons.invalid)).toBeNull();
    expect(submitButton()).not.toHaveAttribute('aria-describedby');
  });

  /**
   * ⛔ **기본 제출을 막지 않으면 비밀번호가 주소에 실린다.** `<form>`은 기본이 GET 제출이라
   * Enter 한 번에 세 값이 질의 문자열로 올라가고, 그 주소는 방문 기록·전달 경로에 남는다.
   * **보내는 경로가 붙기 전인 지금부터** 막는다 — 폼은 이미 실재하고 Enter는 이미 눌린다.
   */
  it('기본 제출을 막는다', async () => {
    const { user } = renderScreen();

    await fillDraft(user);

    const form = submitButton().closest('form');

    if (!(form instanceof HTMLFormElement)) {
      throw new Error('비밀번호 변경 폼을 찾지 못했습니다');
    }

    const submitEvent = createEvent.submit(form);

    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
  });
});

describe('PasswordChangeScreen — 취소', () => {
  /**
   * ⚠ **주소로 직접 들어온 사람을 앱 밖으로 내보내지 않는다.** 히스토리가 한 칸뿐일 때
   * `navigate(-1)`은 이 앱에 오기 전 페이지로 나간다 — 사용자는 취소를 눌렀을 뿐인데 앱을 떠난다.
   * 판별은 `useLocation().key`가 첫 항목에 주는 값으로 한다.
   */
  it('직접 진입이면 관리웹 첫 화면으로 간다', async () => {
    const { user } = renderScreen();

    expect(currentPath()).toBe(PASSWORD_CHANGE_ROUTE);

    await user.click(cancelButton());

    expect(currentPath()).toBe(HOME_ROUTE);
  });

  /**
   * 앞 화면에서 눌러 들어왔으면 **그 화면으로** 돌아간다. 첫 화면으로 보내면 하던 일이 끊긴다.
   * 앞 주소를 일부러 첫 화면이 아닌 곳으로 두어 「뒤로 갔다」와 「첫 화면으로 갔다」를 가른다.
   */
  it('앱 안에서 이동해 들어왔으면 앞 화면으로 돌아간다', async () => {
    const { user } = await renderAfterNavigation();

    expect(currentPath()).toBe(PASSWORD_CHANGE_ROUTE);

    await user.click(cancelButton());

    expect(currentPath()).toBe(PREVIOUS_ROUTE);
  });

  /** 취소는 보내는 버튼이 아니다 — 폼 안에 있어도 제출로 읽히면 Enter가 취소를 부른다. */
  it('취소는 제출 버튼이 아니다', () => {
    renderScreen();

    expect(cancelButton()).toHaveAttribute('type', 'button');
  });
});

describe('PasswordChangeScreen — 두지 않은 것', () => {
  /**
   * ⛔ **이 화면은 계정을 잠그지 않는다**(스펙 §5-2). 잠금·남은 시도 횟수는 전례(로그인)에 있고
   * 이 슬라이스는 그 전례의 사본으로 출발하므로, **한 글자도 넘어오지 않았음**을 직접 잰다.
   * 강도 표시기·조합 규칙도 설계가 뺀 것이라 같은 자리에서 함께 잰다.
   */
  it('잠금·시도 횟수·강도·조합 규칙을 말하지 않는다', async () => {
    const { user } = renderScreen();

    /* 양성 먼저 — 화면이 실제로 서고 규칙 문구가 나온 **뒤에** 없음을 잰다. */
    await fillDraft(user, { newPassword: TOO_SHORT, confirmPassword: TOO_SHORT });

    expect(errorTextFor(newBox())).toContain(t.validation.tooShort(MIN_NEW_PASSWORD_LENGTH));

    const text = document.body.textContent ?? '';

    for (const phrase of FORBIDDEN_PHRASES) {
      expect(text).not.toContain(phrase);
    }

    /* 강도 표시기는 문구가 아니라 눈금으로도 설 수 있다 — 그 자리도 함께 잰다. */
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  /**
   * 문구는 화면보다 오래 산다 — 지금 그리지 않아도 블록에 남아 있으면 다음 회차가 집어 쓴다.
   * 그래서 **문구 블록 자체**를 훑는다.
   */
  it('문구 블록에도 그 말들이 없다', () => {
    const texts = blockTexts(t);

    /* 양성 먼저 — 훑기가 실제로 문구를 잡고 있음을 확인한 뒤 없음을 잰다. */
    expect(texts).toContain(t.title);
    expect(texts).toContain(t.notice(MIN_NEW_PASSWORD_LENGTH));

    for (const phrase of FORBIDDEN_PHRASES) {
      for (const text of texts) {
        expect(text).not.toContain(phrase);
      }
    }
  });
});
