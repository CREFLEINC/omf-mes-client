import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserFormPane, type UserFormPaneProps } from './user-form-pane';
import type { UserFormValues } from './types';

const values: UserFormValues = {
  loginId: 'SYN-LOGIN-01',
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
