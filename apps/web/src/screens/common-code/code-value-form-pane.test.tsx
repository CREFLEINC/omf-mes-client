import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeValueFormPane } from './code-value-form-pane';
import type { CodeValueFormValues } from './code-value-types';

const values: CodeValueFormValues = {
  code: 'SYN-CV-01',
  codeName: '합성 코드값 A',
  displayOrder: '10',
  effectiveFrom: '2026-07-01',
  effectiveTo: '2026-12-31',
};

const renderPane = (overrides: Partial<Parameters<typeof CodeValueFormPane>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<CodeValueFormValues>) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();
  const onDeactivate = vi.fn<() => void>();

  render(
    <CodeValueFormPane
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

describe('CodeValueFormPane — 필드', () => {
  it('코드·코드명·정렬 순서·유효 시작·유효 종료 다섯 칸을 낸다', () => {
    renderPane();

    expect(screen.getByLabelText('코드')).toHaveValue('SYN-CV-01');
    expect(screen.getByLabelText('코드명')).toHaveValue('합성 코드값 A');
    expect(screen.getByLabelText('정렬 순서')).toHaveValue(10);
    expect(screen.getByLabelText('유효 시작')).toHaveValue('2026-07-01');
    expect(screen.getByLabelText('유효 종료')).toHaveValue('2026-12-31');
  });

  it('필수 칸에 필수 표시가 붙고 유효기간에는 붙지 않는다', () => {
    renderPane();

    expect(screen.getByLabelText('코드')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('코드명')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('정렬 순서')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('유효 시작')).not.toHaveAttribute('aria-required');
    expect(screen.getByLabelText('유효 종료')).not.toHaveAttribute('aria-required');
  });

  /* 계약에 하한이 없다 — 화면이 min으로 막으면 서버가 받는 값을 브라우저가 거부한다. */
  it('정렬 순서 칸에 하한을 두지 않는다', () => {
    renderPane();

    expect(screen.getByLabelText('정렬 순서')).not.toHaveAttribute('min');
  });

  it('사용 여부 입력칸을 두지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('값을 고치면 그 항목만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('코드명'), 'X');

    expect(onChange).toHaveBeenCalledWith({ codeName: '합성 코드값 AX' });
  });

  it('짝 오류는 두 칸 모두에 보인다', () => {
    renderPane({
      fieldErrors: {
        effectiveFrom: '유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.',
        effectiveTo: '유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.',
      },
    });

    expect(screen.getAllByText('유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.')).toHaveLength(2);
  });
});

describe('CodeValueFormPane — 코드 잠금', () => {
  it('잠금 사유가 있으면 코드 칸이 잠기고 사유가 보인다', () => {
    renderPane({
      codeLockReason:
        '이 코드를 참조하는 자료의 수를 확인할 수 없어 코드를 잠급니다. 변경이 필요하면 담당자에게 문의하세요.',
    });

    expect(screen.getByLabelText('코드')).toBeDisabled();
    expect(
      screen.getByText(
        '이 코드를 참조하는 자료의 수를 확인할 수 없어 코드를 잠급니다. 변경이 필요하면 담당자에게 문의하세요.',
      ),
    ).toBeInTheDocument();
  });

  /* 아직 참조할 자료가 없다 — 등록에서 잠그면 코드를 넣을 수 없다. */
  it('등록 폼에서는 코드 칸이 열려 있다', () => {
    renderPane({ mode: 'create', codeLockReason: null });

    expect(screen.getByLabelText('코드')).toBeEnabled();
  });
});

describe('CodeValueFormPane — 액션', () => {
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

  it('등록 폼의 주 액션은 코드값 추가다', () => {
    renderPane({ mode: 'create', isDirty: true });

    expect(screen.getByRole('button', { name: '코드값 추가' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  });

  it('등록 폼에는 사용 중지 자리가 없다', () => {
    renderPane({ mode: 'create' });

    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });

  it('사용 중지를 누르면 알린다', async () => {
    const { onDeactivate, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '사용 중지' }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('사용 중지가 막히면 사유가 보이고 버튼에 이어진다', () => {
    renderPane({
      deactivateDisabledReason: '사용 중지는 이미 미사용인 코드값에 다시 할 수 없습니다.',
    });

    const button = screen.getByRole('button', { name: '사용 중지' });
    expect(button).toBeDisabled();

    const noteId = button.getAttribute('aria-describedby');
    expect(noteId).not.toBeNull();
    expect(document.getElementById(noteId as string)).toHaveTextContent(
      '사용 중지는 이미 미사용인 코드값에 다시 할 수 없습니다.',
    );
  });
});
