import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Editability } from '../../patterns/master';
import { RoleFormPane, type RoleFormPaneProps } from './role-form-pane';
import type { RoleFormValues } from './types';

const VALUES: RoleFormValues = {
  roleCode: 'SYN-ROLE-01',
  roleName: '합성 역할 A',
  description: '합성 역할 A 설명',
};

const EDITABLE: Editability = { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 };

const renderPane = (overrides: Partial<RoleFormPaneProps> = {}) => {
  const onChange = vi.fn<(patch: Partial<RoleFormValues>) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();
  const onDeactivate = vi.fn<() => void>();

  render(
    <RoleFormPane
      mode="edit"
      values={VALUES}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      editability={EDITABLE}
      deactivateDisabledReason={null}
      isDirty={false}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      onDeactivate={onDeactivate}
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, onDeactivate, user: userEvent.setup() };
};

const codeField = (): HTMLElement => screen.getByLabelText(/역할 코드/);

describe('RoleFormPane 입력칸', () => {
  it('역할 코드·역할명·설명이 모두 입력칸이다', () => {
    renderPane();

    expect(codeField()).toBeInTheDocument();
    expect(screen.getByLabelText(/역할명/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^설명/)).toBeInTheDocument();
  });

  /**
   * 로그인 ID와 갈리는 자리다 — 그쪽은 계약의 수정 본문에 키가 아예 없어 값 표기로 두었고,
   * 역할 코드는 보낼 수 있는 값이라 입력칸이다.
   */
  it('역할 코드가 값 표기가 아니라 입력칸이다', () => {
    renderPane();

    expect(codeField()).toHaveValue('SYN-ROLE-01');
    expect(codeField().tagName).toBe('INPUT');
  });

  it('사용 여부를 고치는 칸이 없다 — 전용 액션으로만 바뀐다', () => {
    renderPane();

    expect(screen.queryByLabelText(/사용 여부/)).not.toBeInTheDocument();
  });

  it('고치면 그 칸만 상위에 올라간다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText(/역할명/), 'X');

    expect(onChange).toHaveBeenCalledWith({ roleName: '합성 역할 AX' });
  });

  it('필드 오류가 그 칸 옆에 나온다', () => {
    renderPane({ fieldErrors: { roleCode: '이미 쓰고 있는 역할 코드입니다.' } });

    expect(screen.getByText('이미 쓰고 있는 역할 코드입니다.')).toBeInTheDocument();
  });

  it('저장 실패 배너를 폼 위에 낸다', () => {
    renderPane({ banner: <p>저장 실패 표시</p> });

    expect(screen.getByText('저장 실패 표시')).toBeInTheDocument();
  });
});

/**
 * **판정의 주인은 `codeEditable`이다.** `reason`은 문구를 고를 때만 쓴다 —
 * 어긋난 조합이 실제로 내려오며, `reason`을 따라 읽으면 사용자가 고친 값이
 * 저장 시점에야 거부되거나(잠겨야 하는데 열림) 고칠 수 있는 값이 잠긴다.
 */
describe('RoleFormPane 역할 코드 잠금', () => {
  it('codeEditable=true면 잠기지 않는다', () => {
    renderPane({ editability: { codeEditable: true, reason: 'EDITABLE' } });

    expect(codeField()).toBeEnabled();
  });

  it('codeEditable=false면 잠기고 사유가 보인다', () => {
    renderPane({ editability: { codeEditable: false, reason: 'REFERENCED', referenceCount: 3 } });

    expect(codeField()).toBeDisabled();
    expect(screen.getByText('이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.')).toBeInTheDocument();
  });

  /** 어긋난 조합 ① — 서버가 실제로 준다. `reason`을 따라 읽으면 잠겨야 하는 칸이 열린다. */
  it('codeEditable=false인데 reason=EDITABLE이어도 잠긴다', () => {
    renderPane({ editability: { codeEditable: false, reason: 'EDITABLE' } });

    expect(codeField()).toBeDisabled();
  });

  /** 어긋난 조합 ② — `reason`을 따라 읽으면 고칠 수 있는 칸이 잠긴다. */
  it('codeEditable=true인데 reason=REFERENCED여도 잠기지 않는다', () => {
    renderPane({ editability: { codeEditable: true, reason: 'REFERENCED', referenceCount: 7 } });

    expect(codeField()).toBeEnabled();
  });

  it('codeEditable=false·reason=RECEIVED_FROM_ERP도 잠긴다', () => {
    renderPane({ editability: { codeEditable: false, reason: 'RECEIVED_FROM_ERP' } });

    expect(codeField()).toBeDisabled();
  });

  /** 등록에는 잠글 대상이 없다 — 아직 만들어지지 않은 자원이라 상세도 `editability`도 없다. */
  it('등록에서는 editability가 없어도 열려 있다', () => {
    renderPane({ mode: 'create', editability: null });

    expect(codeField()).toBeEnabled();
  });

  /**
   * 셀 수 없다고 서버가 밝힌 자리에 건수를 함께 주는 일이 있다.
   * 그 값을 문구에 실으면 **셀 수 없다면서 수를 내는** 어긋난 안내가 된다 —
   * 잠금 문구의 주인이 `patterns/master`임을 이 부품에서도 고정한다.
   */
  it('셀 수 없다는 사유에는 건수를 내지 않는다', () => {
    renderPane({
      editability: { codeEditable: false, reason: 'NOT_COUNTABLE', referenceCount: 3 },
    });

    const pane = screen.getByRole('region', { name: '역할 정보' });

    expect(pane.textContent).toContain('확인할 수 없어');
    expect(pane.textContent).not.toContain('3건');
  });
});

describe('RoleFormPane 액션', () => {
  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByText('저장은 고친 내용이 있을 때 누를 수 있습니다.')).toBeInTheDocument();
  });

  it('고친 것이 있으면 저장을 누를 수 있다', async () => {
    const { onSave, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('보내는 중에는 저장을 다시 누를 수 없다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  /** 수정의 「취소」는 기준값으로 되돌리는 것이라 고친 것이 있을 때만 의미가 있다. */
  it('수정에서 고친 것이 없으면 취소도 비활성이다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  /** 등록의 「취소」는 폼을 닫는 것이라 고친 것이 없어도 눌러야 한다. */
  it('등록에서는 고친 것이 없어도 취소를 누를 수 있다', async () => {
    const { onCancel, user } = renderPane({ mode: 'create', editability: null });

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('등록의 주 액션은 「역할 추가」이고 입력 전에는 사유가 보인다', () => {
    renderPane({ mode: 'create', editability: null });

    expect(screen.getByRole('button', { name: '역할 추가' })).toBeDisabled();
    expect(screen.getByText('역할 추가는 입력한 내용이 있을 때 누를 수 있습니다.')).toBeInTheDocument();
  });

  /** 아직 없는 자원이라 「언젠가 풀린다」가 아니라 애초에 해당하지 않는 액션이다. */
  it('등록에는 사용 중지 자리가 없다', () => {
    renderPane({ mode: 'create', editability: null });

    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
    expect(screen.queryByText('사용 중지')).not.toBeInTheDocument();
  });

  it('수정에서 사용 중지를 누르면 상위에 알린다', async () => {
    const { onDeactivate, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '사용 중지' }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('이미 미사용이면 사용 중지가 비활성이고 사유가 보인다', () => {
    renderPane({ deactivateDisabledReason: '사용 중지는 이미 미사용인 역할에 다시 할 수 없습니다.' });

    expect(screen.getByRole('button', { name: '사용 중지' })).toBeDisabled();
    expect(
      screen.getByText('사용 중지는 이미 미사용인 역할에 다시 할 수 없습니다.'),
    ).toBeInTheDocument();
  });
});
