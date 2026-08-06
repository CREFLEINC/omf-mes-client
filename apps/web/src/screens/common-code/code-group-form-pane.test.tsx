import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeGroupFormPane } from './code-group-form-pane';
import type { CodeGroupFormValues } from './types';

const values: CodeGroupFormValues = {
  groupCode: 'SYN-GRP-01',
  groupName: '합성 코드그룹 A',
  description: '합성 설명 A',
};

const renderPane = (overrides: Partial<Parameters<typeof CodeGroupFormPane>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<CodeGroupFormValues>) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();
  const onDeactivate = vi.fn<() => void>();

  render(
    <CodeGroupFormPane
      mode="edit"
      values={values}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      codeLockReason={null}
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

describe('CodeGroupFormPane — 필드', () => {
  it('그룹코드·그룹명·설명 세 칸을 낸다', () => {
    renderPane();

    expect(screen.getByLabelText('그룹코드')).toHaveValue('SYN-GRP-01');
    expect(screen.getByLabelText('그룹명')).toHaveValue('합성 코드그룹 A');
    expect(screen.getByLabelText('설명')).toHaveValue('합성 설명 A');
  });

  /* 필수 표시가 없으면 저장을 눌러야 필수임을 알게 된다(배치 규범 3). */
  it('필수 칸에 필수 표시가 붙는다', () => {
    renderPane();

    expect(screen.getByLabelText('그룹코드')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('그룹명')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('설명')).not.toHaveAttribute('aria-required');
  });

  /* 사용 여부는 전용 액션으로만 바뀐다 — 입력칸을 두면 저장 본문에 실릴 여지가 생긴다. */
  it('사용 여부 입력칸을 두지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('값을 고치면 그 항목만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('그룹명'), 'X');

    expect(onChange).toHaveBeenCalledWith({ groupName: '합성 코드그룹 AX' });
  });

  it('인라인 오류를 그 칸에 낸다', () => {
    renderPane({ fieldErrors: { groupCode: '필수 입력 항목입니다.' } });

    expect(screen.getByText('필수 입력 항목입니다.')).toBeInTheDocument();
  });
});

describe('CodeGroupFormPane — 코드 잠금', () => {
  it('잠금 사유가 있으면 그룹코드 칸이 잠기고 사유가 보인다', () => {
    renderPane({ codeLockReason: '이미 다른 자료에서 사용 중이라 코드를 바꿀 수 없습니다.' });

    expect(screen.getByLabelText('그룹코드')).toBeDisabled();
    expect(
      screen.getByText('이미 다른 자료에서 사용 중이라 코드를 바꿀 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('잠금 사유가 없으면 그룹코드를 고칠 수 있다', () => {
    renderPane();

    expect(screen.getByLabelText('그룹코드')).toBeEnabled();
  });
});

describe('CodeGroupFormPane — 액션', () => {
  it('고친 것이 없으면 저장·취소가 막힌다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('고친 것이 있으면 저장할 수 있다', async () => {
    const { onSave, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('저장 중에는 저장이 막힌다 — 연타로 요청이 두 번 나가지 않는다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('등록 폼의 주 액션은 그룹 추가다', () => {
    renderPane({ mode: 'create', isDirty: true });

    expect(screen.getByRole('button', { name: '그룹 추가' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  });

  /* 아직 없는 자원이라 「언젠가 풀린다」가 아니라 애초에 해당하지 않는 액션이다. */
  it('등록 폼에는 사용 중지 자리가 없다', () => {
    renderPane({ mode: 'create' });

    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });

  it('사용 중지를 누르면 알린다', async () => {
    const { onDeactivate, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '사용 중지' }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  /* 배치 규범 4 — 비활성 컨트롤은 포커스를 받지 못해 사유를 시각으로만 두면 닿을 수 없다. */
  it('사용 중지가 막히면 사유가 보이고 버튼에 이어진다', () => {
    renderPane({
      deactivateDisabledReason: '사용 중지는 이미 미사용인 코드그룹에 다시 할 수 없습니다.',
    });

    const button = screen.getByRole('button', { name: '사용 중지' });
    expect(button).toBeDisabled();

    const noteId = button.getAttribute('aria-describedby');
    expect(noteId).not.toBeNull();
    expect(document.getElementById(noteId as string)).toHaveTextContent(
      '사용 중지는 이미 미사용인 코드그룹에 다시 할 수 없습니다.',
    );
  });

  it('저장 실패 배너를 폼 위에 담는다', () => {
    renderPane({ banner: <p>저장하지 못했습니다</p> });

    expect(screen.getByText('저장하지 못했습니다')).toBeInTheDocument();
  });
});
