import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { causeCodeAdapter, defectCodeAdapter } from './adapters';
import { CodeFormPane, type CodeFormPaneProps } from './code-form-pane';

const PARENT_OPTIONS = [
  { value: '1001', label: 'DF-10 · 외관' },
  { value: '1004', label: 'DF-20 · 치수' },
];

const renderPane = (overrides: Partial<CodeFormPaneProps> = {}) => {
  const props: CodeFormPaneProps = {
    adapter: defectCodeAdapter,
    mode: 'create',
    values: { code: '', name: '', parentId: '' },
    onChange: vi.fn(),
    fieldErrors: {},
    banner: null,
    codeLockReason: null,
    parentOptions: PARENT_OPTIONS,
    parentLockReason: null,
    isActive: true,
    isDirty: false,
    isSaving: false,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onDeactivate: vi.fn(),
    ...overrides,
  };

  render(<CodeFormPane {...props} />);

  return { props, user: userEvent.setup() };
};

describe('CodeFormPane — 입력칸', () => {
  it('코드·명칭·상위 대분류를 입력할 수 있다', async () => {
    const { props, user } = renderPane();

    await user.type(screen.getByLabelText('코드'), 'D');
    await user.type(screen.getByLabelText('명칭'), '가');

    expect(props.onChange).toHaveBeenCalledWith({ code: 'D' });
    expect(props.onChange).toHaveBeenCalledWith({ name: '가' });
    expect(screen.getByRole('combobox', { name: '상위 대분류' })).toBeInTheDocument();
  });

  it('상위 선택지 맨 앞에 대분류로 두는 선택지가 있다', async () => {
    const { props, user } = renderPane({ values: { code: 'A', name: '가', parentId: '1001' } });

    await user.click(screen.getByRole('combobox', { name: '상위 대분류' }));
    await user.click(screen.getByRole('option', { name: '없음 (대분류)' }));

    expect(props.onChange).toHaveBeenCalledWith({ parentId: '' });
  });

  it('상위를 고르면 그 값이 올라간다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('combobox', { name: '상위 대분류' }));
    await user.click(screen.getByRole('option', { name: 'DF-20 · 치수' }));

    expect(props.onChange).toHaveBeenCalledWith({ parentId: '1004' });
  });

  it('상위 선택칸 아래에 임시 목록 안내가 보인다', () => {
    renderPane();

    expect(
      screen.getByText(
        '대분류 목록은 아직 임시입니다. 확정되면 이 항목의 선택지가 바뀔 수 있습니다.',
      ),
    ).toBeInTheDocument();
  });

  it('필드 오류는 그 입력칸 옆에 나온다', () => {
    renderPane({
      fieldErrors: { code: '이미 사용 중인 코드입니다.', parentId: '상위가 올바르지 않습니다.' },
    });

    expect(screen.getByText('이미 사용 중인 코드입니다.')).toBeInTheDocument();
    expect(screen.getByText('상위가 올바르지 않습니다.')).toBeInTheDocument();
  });
});

describe('CodeFormPane — 대분류 경고', () => {
  it('상위를 비운 채 등록하면 전사 공통 축이라는 경고가 보인다', () => {
    renderPane();

    expect(
      screen.getByText(
        '대분류는 전사에서 공통으로 쓰는 축입니다. 추가하면 모든 현장에서 함께 쓰이므로 신중히 정하세요.',
      ),
    ).toBeInTheDocument();
  });

  it('상위를 고른 상세 등록에는 그 경고가 없다', () => {
    renderPane({ values: { code: '', name: '', parentId: '1001' } });

    expect(screen.queryByText(/대분류는 전사에서 공통으로 쓰는 축입니다/)).not.toBeInTheDocument();
  });

  it('수정에는 그 경고가 없다', () => {
    renderPane({ mode: 'edit' });

    expect(screen.queryByText(/대분류는 전사에서 공통으로 쓰는 축입니다/)).not.toBeInTheDocument();
  });
});

describe('CodeFormPane — 잠금과 사유', () => {
  it('코드가 잠기면 입력이 비활성이고 사유가 보인다', () => {
    renderPane({
      mode: 'edit',
      codeLockReason: '이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.',
    });

    expect(screen.getByLabelText('코드')).toBeDisabled();
    expect(
      screen.getByText('이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.'),
    ).toBeInTheDocument();
  });

  /* 배치 규범 4 — 비활성 컨트롤은 포커스를 받지 못해 사유를 DOM 텍스트로 내야 닿을 수 있다. */
  it('하위가 있으면 상위 선택칸이 비활성이고 사유가 보인다', () => {
    renderPane({
      mode: 'edit',
      parentLockReason:
        '상위 대분류는 하위 코드가 있는 동안 바꿀 수 없습니다. 하위 코드를 다른 대분류로 옮기면 이 항목을 쓸 수 있습니다.',
    });

    const parent = screen.getByRole('combobox', { name: '상위 대분류' });
    expect(parent).toBeDisabled();
    expect(parent).toHaveAttribute('aria-describedby');
    expect(
      screen.getByText(/상위 대분류는 하위 코드가 있는 동안 바꿀 수 없습니다/),
    ).toBeInTheDocument();
  });
});

describe('CodeFormPane — 저장·취소', () => {
  it('고친 것이 없으면 저장과 취소를 쓸 수 없다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('고친 것이 있으면 저장할 수 있다', async () => {
    const { props, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(props.onSave).toHaveBeenCalled();
  });

  it('저장 중에는 다시 누를 수 없다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('취소하면 입력 전으로 되돌린다', async () => {
    const { props, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(props.onCancel).toHaveBeenCalled();
  });
});

describe('CodeFormPane — 사용 여부와 사용 중지', () => {
  it('수정에서는 지금 사용 여부를 값으로 보인다', () => {
    renderPane({ mode: 'edit', isActive: false });

    expect(screen.getByText('미사용')).toBeInTheDocument();
  });

  it('등록에는 아직 사용 여부도 사용 중지도 없다', () => {
    renderPane();

    expect(screen.queryByText('사용 중')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });

  it('사용 중인 코드는 사용 중지를 시작할 수 있다', async () => {
    const { props, user } = renderPane({ mode: 'edit', isActive: true });

    await user.click(screen.getByRole('button', { name: '사용 중지' }));

    expect(props.onDeactivate).toHaveBeenCalled();
  });

  it('이미 미사용이면 사용 중지가 비활성이고 사유가 보인다', () => {
    renderPane({ mode: 'edit', isActive: false });

    const button = screen.getByRole('button', { name: '사용 중지' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-describedby');
    expect(
      screen.getByText('사용 중지는 이미 미사용인 코드에는 할 수 없습니다.'),
    ).toBeInTheDocument();
  });
});

describe('CodeFormPane — 탭', () => {
  it('폼에 그 탭의 이름이 붙는다', () => {
    renderPane({ adapter: causeCodeAdapter });

    expect(screen.getByRole('region', { name: '원인코드 등록·편집' })).toBeInTheDocument();
  });

  it('배너 슬롯을 그대로 낸다', () => {
    renderPane({ banner: <p>저장 실패 안내</p> });

    expect(screen.getByText('저장 실패 안내')).toBeInTheDocument();
  });
});
