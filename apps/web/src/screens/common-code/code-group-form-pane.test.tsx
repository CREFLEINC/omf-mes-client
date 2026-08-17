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
      isLocked={false}
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

describe('CodeGroupFormPane — 다른 코드그룹의 저장이 나가는 중', () => {
  /**
   * **막는 것과 가리는 것이 갈린다.** 저장은 한 번에 하나뿐이라 다른 코드그룹의 저장이 나가는
   * 중이면 여기도 잠긴다(전역). 그러나 그것은 **다른 사실**이므로 사유가 붙어야 하고
   * 진행 표시는 돌지 않는다 — 사유 없는 비활성은 「고장」으로 읽힌다(배치 규범 4).
   *
   * **입력칸은 잠그지 않는다**(D-7). 늦게 온 성공이 남의 폼을 덮지 않도록 상위가 대상을
   * 견주므로, 여기서 편집까지 막으면 기다리는 동안 아무것도 못 하게 된다.
   */
  it('남의 저장이 나가는 중이면 저장이 사유와 함께 잠기고 입력칸은 열려 있다', () => {
    renderPane({ isDirty: true, isLocked: true, isSaving: false });

    const save = screen.getByRole('button', { name: '저장' });

    expect(save).toBeDisabled();
    expect(
      screen.getByText('저장은 다른 코드그룹의 저장이 끝난 뒤에 할 수 있습니다.'),
    ).toBeInTheDocument();
    expect(save).not.toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('그룹명')).toBeEnabled();
    expect(screen.getByLabelText('설명')).toBeEnabled();
  });

  /* 내 저장이 나가는 중이면 진행 표시가 사유 자리를 대신한다 — 두 사실을 한 문구로 뭉개지 않는다. */
  it('내 저장이 나가는 중이면 진행 표시가 돌고 남의 저장 사유를 내지 않는다', () => {
    renderPane({ isDirty: true, isLocked: true, isSaving: true });

    const save = screen.getByRole('button', { name: '저장' });

    expect(save).toHaveAttribute('aria-busy', 'true');
    expect(save).toBeDisabled();
    expect(screen.queryByText(/저장은 다른 코드그룹의 저장이 끝난 뒤에/)).not.toBeInTheDocument();
  });

  /*
   * 등록 폼도 같은 저장 자리를 쓴다 — 수정 저장이 나가는 중에 「그룹 추가」를 누르면 이 폼이
   * 그 잠금 안에서 열린다(D-3의 두 훅 잠금). 사유 없이 비활성으로 두면 사용자는 무엇을
   * 기다리는지 알 수 없다.
   */
  it('등록 폼의 주 액션도 남의 저장이 나가는 중이면 사유와 함께 잠긴다', () => {
    renderPane({ mode: 'create', isDirty: true, isLocked: true, isSaving: false });

    const add = screen.getByRole('button', { name: '그룹 추가' });

    expect(add).toBeDisabled();
    expect(
      screen.getByText('저장은 다른 코드그룹의 저장이 끝난 뒤에 할 수 있습니다.'),
    ).toBeInTheDocument();
  });
});
