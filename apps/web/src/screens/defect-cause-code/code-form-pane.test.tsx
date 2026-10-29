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
    title: '불량코드 대분류 추가',
    values: { code: '', name: '', parentId: '' },
    onChange: vi.fn(),
    fieldErrors: {},
    banner: null,
    codeLockReason: null,
    parentOptions: PARENT_OPTIONS,
    parentLockReason: null,
    isDirty: false,
    isSaving: false,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };

  render(<CodeFormPane {...props} />);

  return { props, user: userEvent.setup() };
};

describe('CodeFormPane — 입력칸', () => {
  it('코드·명칭·상위 대분류를 입력할 수 있다', async () => {
    const { props, user } = renderPane();

    await user.type(screen.getByLabelText('불량코드'), 'D');
    await user.type(screen.getByLabelText('불량명'), '가');

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
      screen.getByText('대분류 목록은 임시이며, 확정 후 변경될 수 있습니다.'),
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
        '대분류는 모든 현장에서 공통으로 사용됩니다. 추가 시 신중하게 확인해 주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('상위를 고른 상세 등록에는 그 경고가 없다', () => {
    renderPane({ values: { code: '', name: '', parentId: '1001' } });

    expect(
      screen.queryByText(/대분류는 모든 현장에서 공통으로 사용됩니다/),
    ).not.toBeInTheDocument();
  });

  it('수정에는 그 경고가 없다', () => {
    renderPane({ mode: 'edit' });

    expect(
      screen.queryByText(/대분류는 모든 현장에서 공통으로 사용됩니다/),
    ).not.toBeInTheDocument();
  });
});

describe('CodeFormPane — 잠금과 사유', () => {
  it('코드가 잠기면 입력이 비활성이고 사유가 보인다', () => {
    renderPane({
      mode: 'edit',
      codeLockReason: '이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.',
    });

    expect(screen.getByLabelText('불량코드')).toBeDisabled();
    expect(
      screen.getByText('이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.'),
    ).toBeInTheDocument();
  });

  /* 배치 규범 4 — 비활성 컨트롤은 포커스를 받지 못해 사유를 DOM 텍스트로 내야 닿을 수 있다. */
  it('하위가 있으면 상위 선택칸이 비활성이고 사유가 보인다', () => {
    renderPane({
      mode: 'edit',
      parentLockReason: '이 대분류 아래에 상세 코드가 있어서 상위 대분류를 바꿀 수 없습니다.',
    });

    const parent = screen.getByRole('combobox', { name: '상위 대분류' });
    expect(parent).toBeDisabled();
    expect(parent).toHaveAttribute('aria-describedby');
    expect(
      screen.getByText(/이 대분류 아래에 상세 코드가 있어서 상위 대분류를 바꿀 수 없습니다/),
    ).toBeInTheDocument();
  });
});

describe('CodeFormPane — 저장·취소', () => {
  it('고친 것이 없으면 저장을 쓸 수 없다 — 취소는 창을 닫으므로 언제나 쓸 수 있다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeEnabled();
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

  it('취소하면 고친 값을 버리고 창을 닫는다', async () => {
    const { props, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(props.onCancel).toHaveBeenCalled();
  });
});

describe('CodeFormPane — 잠긴 코드 (#209 시안)', () => {
  it('잠긴 코드는 필수 표시 없이 자물쇠와 정보 안내 한 줄로 낸다', () => {
    renderPane({
      mode: 'edit',
      codeLockReason: '이 코드는 이미 다른 기록에서 쓰이고 있어서 바꿀 수 없습니다.',
    });

    const code = screen.getByLabelText('불량코드');
    expect(code).toBeDisabled();
    expect(code).not.toHaveAttribute('aria-required', 'true');
    expect(
      screen.getByText('이 코드는 이미 다른 기록에서 쓰이고 있어서 바꿀 수 없습니다.'),
    ).toBeInTheDocument();
    expect(code).toHaveAttribute('aria-describedby');
  });

  it('상위가 잠기면 대분류 임시 목록 안내를 내지 않는다', () => {
    renderPane({
      mode: 'edit',
      parentLockReason: '이 대분류 아래에 상세 코드가 있어서 상위 대분류를 바꿀 수 없습니다.',
    });

    expect(
      screen.getByText('이 대분류 아래에 상세 코드가 있어서 상위 대분류를 바꿀 수 없습니다.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('대분류 목록은 임시이며, 확정 후 변경될 수 있습니다.'),
    ).not.toBeInTheDocument();
  });
});

describe('CodeFormPane — 창 모양 (#209)', () => {
  it('머리 ✕ 없이 「취소」로 닫는다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: /닫기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
  });

  it('입력 안내가 칸 안에 보인다', () => {
    renderPane();

    expect(screen.getByPlaceholderText('불량코드를 입력하세요')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('불량명을 입력하세요')).toBeInTheDocument();
  });

  it('처음 열 때는 빨간 테두리 없이 필수 표시만 붙인다', () => {
    renderPane();

    expect(screen.getByLabelText('불량코드')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('불량명')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('*').length).toBeGreaterThanOrEqual(2);
  });

  it('비운 채 저장하면 그 칸은 글을 띄우지 않고 테두리만 빨갛게 한다', () => {
    renderPane({ fieldErrors: { code: '필수 입력 항목입니다.' } });

    expect(screen.getByLabelText('불량코드')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('불량명')).not.toHaveAttribute('aria-invalid', 'true');
    for (const node of screen.queryAllByText('필수 입력 항목입니다.')) {
      expect(node.closest('.inspection-standard-border-only')).not.toBeNull();
    }
  });
});

describe('CodeFormPane — 탭', () => {
  it('창 제목이 붙는다', () => {
    renderPane({ adapter: causeCodeAdapter, mode: 'edit', title: '원인코드 수정' });

    expect(screen.getByRole('dialog', { name: '원인코드 수정' })).toBeInTheDocument();
  });

  it('배너 슬롯을 그대로 낸다', () => {
    renderPane({ banner: <p>저장 실패 안내</p> });

    expect(screen.getByText('저장 실패 안내')).toBeInTheDocument();
  });
});
