import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { messages } from '@omf-mes/i18n';

import { INITIAL_PASSWORD_MIN_LENGTH } from './initial-password';
import { UserFormPane, type UserFormPaneProps } from './user-form-pane';
import type { UserFormValues } from './types';

const values: UserFormValues = {
  loginId: 'SYN-LOGIN-01',
  // 합성 값이다 — 실제 계정에 쓰이는 값이 아니다. 규칙(숫자+알파벳, 8자 이상)을 통과하도록 지었다.
  password: 'SynPw1234',
  userName: '합성 사용자 A',
  departmentId: '3001',
  email: 'syn.user.a@example.invalid',
  statusCode: 'SYN-STATUS-A',
};

const departmentOptions = [
  { value: '', label: '지정하지 않음' },
  { value: '3001', label: 'SYN-DEPT-01 · 합성 부서 A' },
];
const statusOptions = [
  { value: 'SYN-STATUS-A', label: '재직' },
  { value: 'SYN-STATUS-B', label: '휴직' },
];

const renderPane = (overrides: Partial<UserFormPaneProps> = {}) => {
  const onChange = vi.fn<(patch: Partial<UserFormValues>) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();
  const onDeactivate = vi.fn<() => void>();
  const props: UserFormPaneProps = {
    mode: 'edit',
    values,
    onChange,
    fieldErrors: {},
    banner: null,
    departmentOptions,
    statusOptions,
    statusDisabledReason: null,
    deactivateDisabledReason: null,
    isDirty: true,
    isSaving: false,
    onSave,
    onCancel,
    onDeactivate,
    ...overrides,
  };

  render(<UserFormPane {...props} />);

  return { onChange, onSave, onCancel, onDeactivate, user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: '사용자 정보' });

/**
 * 그 칸에 **실제로 매인** 문구. `aria-describedby`가 가리키는 요소들을 따라간다.
 * 선례: `password-change/screen.test.tsx`의 `errorTextFor`.
 *
 * ⭐ 화면 어딘가에 문구가 있다는 것과 **그 칸에 붙어 있다**는 것은 다르다 — 붙은 자리를 재야
 * 디자인 시스템이 안내와 오류를 같은 자리에서 갈아끼우는지(오류가 서면 안내가 걷히는지)를 잡는다.
 */
const describedTextOf = (box: HTMLElement): string =>
  (box.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe('UserFormPane 초기 비밀번호', () => {
  /*
   * ⚠ `type="password"`인 칸은 `role="textbox"`로 잡히지 않는다 — `getByLabelText`로 찾는다.
   * 이 파일의 기존 `queryByRole('textbox', …)` 부재 단언들은 그래서 이 칸과 무관하며 그대로 둔다.
   */
  const passwordBox = (): HTMLElement => within(pane()).getByLabelText('초기 비밀번호');

  it('등록에서만 칸이 선다', () => {
    renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    expect(passwordBox()).toBeInTheDocument();
  });

  it('수정에는 칸이 없다 — 수정 요청 본문에 그 키가 없다', () => {
    renderPane({ mode: 'edit' });

    expect(within(pane()).queryByLabelText('초기 비밀번호')).not.toBeInTheDocument();
  });

  it('type이 password이고 새 비밀번호로 자동완성한다', () => {
    /*
     * ⭐ `autoComplete`이 `new-password`가 아니면(예: `current-password`이거나 없으면) 브라우저가
     * **관리자 자신의** 저장된 비밀번호를 이 칸에 채우려 하고, 그 값이 그대로 등록 요청에 실릴 수
     * 있다 — 남의 계정에 관리자 자신의 비밀번호가 초기값으로 걸리는 사고다.
     */
    renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    const input = passwordBox();

    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autoComplete', 'new-password');
  });

  it('필수 표시가 붙는다 — 저장을 눌러야 필수임을 알게 되면 안 된다', () => {
    renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    expect(passwordBox()).toHaveAttribute('aria-required', 'true');
  });

  it('규칙 안내가 칸에 이어져 있다', () => {
    renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    expect(describedTextOf(passwordBox())).toBe(
      messages.usersRoles.user.initialPasswordNotice(INITIAL_PASSWORD_MIN_LENGTH),
    );
  });

  /** 디자인 시스템이 `error`가 있으면 `helperText` 자리를 갈아끼운다(`TextFieldProps`). */
  it('오류가 서면 안내를 덮는다', () => {
    const errorText = '초기 비밀번호는 숫자와 알파벳을 함께 넣어 8자 이상이어야 합니다.';

    renderPane({
      mode: 'create',
      values: { ...values, loginId: '' },
      fieldErrors: { password: errorText },
    });

    expect(describedTextOf(passwordBox())).toBe(errorText);
    expect(
      within(pane()).queryByText(
        messages.usersRoles.user.initialPasswordNotice(INITIAL_PASSWORD_MIN_LENGTH),
      ),
    ).not.toBeInTheDocument();
  });

  it('타이핑하면 상위에 알린다', async () => {
    const { onChange, user } = renderPane({
      mode: 'create',
      values: { ...values, loginId: '', password: '' },
    });

    await user.type(passwordBox(), 'S');

    expect(onChange).toHaveBeenCalledWith({ password: 'S' });
  });
});

describe('UserFormPane 로그인 ID', () => {
  /** 계약의 수정 본문에 그 키가 아예 없다 — 잠긴 입력칸은 「언젠가 열린다」는 뜻이 된다. */
  it('수정에서는 입력칸이 아니라 값 표기다', () => {
    renderPane({ mode: 'edit' });

    expect(within(pane()).queryByRole('textbox', { name: '로그인 ID' })).not.toBeInTheDocument();
    expect(within(pane()).getByText('SYN-LOGIN-01')).toBeInTheDocument();
  });

  it('수정에서는 값 아래에 잠금 사유가 보인다', () => {
    renderPane({ mode: 'edit' });

    expect(within(pane()).getByText(/로그인 ID는 등록할 때만 정할 수 있고/)).toBeInTheDocument();
  });

  it('등록에서만 입력칸이다', async () => {
    const { onChange, user } = renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    const input = within(pane()).getByRole('textbox', { name: '로그인 ID' });

    await user.type(input, 'S');

    expect(onChange).toHaveBeenCalledWith({ loginId: 'S' });
  });

  it('등록에는 잠금 사유가 없다 — 아직 정할 수 있는 값이다', () => {
    renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    expect(within(pane()).queryByText(/로그인 ID는 등록할 때만/)).not.toBeInTheDocument();
  });
});

describe('UserFormPane 상태', () => {
  it('상태 목록에서 값을 고르면 상위에 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.click(within(pane()).getByLabelText('상태'));
    await user.click(screen.getByRole('option', { name: '휴직' }));

    expect(onChange).toHaveBeenCalledWith({ statusCode: 'SYN-STATUS-B' });
  });

  it('등록에서 상태를 비우면 재직 기본값 안내를 보인다', () => {
    renderPane({ mode: 'create', values: { ...values, loginId: '', statusCode: '' } });

    expect(within(pane()).getByLabelText('상태')).toHaveTextContent('기본값(재직)');
  });

  it('상태 목록 조회 실패 때만 선택을 막고 사유를 보인다', () => {
    renderPane({ statusOptions: [], statusDisabledReason: '상태 목록을 불러오지 못했습니다.' });

    expect(within(pane()).getByLabelText('상태')).toBeDisabled();
    expect(within(pane()).getByText('상태 목록을 불러오지 못했습니다.')).toBeInTheDocument();
  });
});

describe('UserFormPane 입력', () => {
  it('이름·전자우편을 고치면 상위에 알린다', async () => {
    const { onChange, user } = renderPane({ values: { ...values, userName: '', email: '' } });

    await user.type(within(pane()).getByRole('textbox', { name: '이름' }), '가');
    expect(onChange).toHaveBeenCalledWith({ userName: '가' });

    await user.type(within(pane()).getByRole('textbox', { name: '전자우편' }), 'a');
    expect(onChange).toHaveBeenCalledWith({ email: 'a' });
  });

  it('부서를 고르면 상위에 알린다', async () => {
    const { onChange, user } = renderPane({ values: { ...values, departmentId: '' } });

    await user.click(within(pane()).getByLabelText('부서'));
    await user.click(await screen.findByRole('option', { name: /SYN-DEPT-01/ }));

    expect(onChange).toHaveBeenCalledWith({ departmentId: '3001' });
  });

  it('필수 칸에 표시가 붙는다 — 저장을 눌러야 필수임을 알게 되면 안 된다', () => {
    renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    expect(within(pane()).getByRole('textbox', { name: '로그인 ID' })).toHaveAttribute(
      'aria-required',
      'true',
    );
    expect(within(pane()).getByRole('textbox', { name: '이름' })).toHaveAttribute(
      'aria-required',
      'true',
    );
  });

  it('필드 오류가 그 칸 옆에 나온다', () => {
    renderPane({ fieldErrors: { userName: '필수 입력 항목입니다.' } });

    expect(within(pane()).getByText('필수 입력 항목입니다.')).toBeInTheDocument();
  });

  it('저장 실패 배너 슬롯을 그대로 낸다', () => {
    renderPane({ banner: <p>저장 실패 표시</p> });

    expect(within(pane()).getByText('저장 실패 표시')).toBeInTheDocument();
  });
});

describe('UserFormPane 액션', () => {
  /** 사유가 없으면 사용자는 버튼이 왜 안 눌리는지 알 방법이 없다(배치 규범 4). */
  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', () => {
    renderPane({ isDirty: false });

    const save = within(pane()).getByRole('button', { name: '저장' });

    expect(save).toBeDisabled();

    const describedBy = save.getAttribute('aria-describedby');

    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      '저장은 고친 내용이 있을 때 누를 수 있습니다.',
    );
  });

  it('등록의 사유는 그 액션의 이름으로 시작한다', () => {
    renderPane({ mode: 'create', isDirty: false, values: { ...values, loginId: '' } });

    expect(
      within(pane()).getByText('사용자 추가는 입력한 내용이 있을 때 누를 수 있습니다.'),
    ).toBeInTheDocument();
  });

  /** 등록에서 「취소」는 폼을 닫는 것이라 고친 것이 없어도 눌러야 한다. */
  it('등록의 취소는 고친 것이 없어도 누를 수 있다', () => {
    renderPane({ mode: 'create', isDirty: false, values: { ...values, loginId: '' } });

    expect(within(pane()).getByRole('button', { name: '취소' })).toBeEnabled();
  });

  it('수정의 취소는 고친 것이 있을 때만 의미가 있다', () => {
    renderPane({ mode: 'edit', isDirty: false });

    expect(within(pane()).getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('저장 중에는 저장을 다시 누를 수 없다', () => {
    renderPane({ isSaving: true });

    expect(within(pane()).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('등록의 주 액션은 「사용자 추가」다', () => {
    renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    expect(within(pane()).getByRole('button', { name: '사용자 추가' })).toBeInTheDocument();
    expect(within(pane()).queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  });

  /** 아직 없는 자원이라 「언젠가 풀린다」가 아니라 애초에 해당하지 않는 액션이다. */
  it('등록에는 사용 중지가 아예 없다', () => {
    renderPane({ mode: 'create', values: { ...values, loginId: '' } });

    expect(within(pane()).queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });

  it('수정에는 사용 중지가 있고 누르면 상위에 알린다', async () => {
    const { onDeactivate, user } = renderPane({ mode: 'edit' });

    await user.click(within(pane()).getByRole('button', { name: '사용 중지' }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('이미 미사용이면 사용 중지가 비활성이고 사유가 보인다', () => {
    renderPane({
      deactivateDisabledReason: '사용 중지는 이미 미사용인 사용자에게 다시 할 수 없습니다.',
    });

    expect(within(pane()).getByRole('button', { name: '사용 중지' })).toBeDisabled();
    expect(
      within(pane()).getByText('사용 중지는 이미 미사용인 사용자에게 다시 할 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('저장과 취소를 누르면 상위에 알린다', async () => {
    const { onSave, onCancel, user } = renderPane();

    await user.click(within(pane()).getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.click(within(pane()).getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
