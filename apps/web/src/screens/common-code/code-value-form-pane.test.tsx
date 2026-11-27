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

  render(
    <CodeValueFormPane
      mode="edit"
      values={values}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      codeLockReason={null}
      isDirty={false}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, user: userEvent.setup() };
};

describe('CodeValueFormPane — 필드', () => {
  it('코드·코드명·정렬 순서·유효 시작·유효 종료 다섯 칸을 낸다', () => {
    renderPane();

    expect(screen.getByLabelText('코드')).toHaveValue('SYN-CV-01');
    expect(screen.getByLabelText('코드명')).toHaveValue('합성 코드값 A');
    expect(screen.getByLabelText('정렬 순서')).toHaveValue(10);
    expect(screen.getByLabelText('유효 시작')).toHaveTextContent('2026-07-01');
    expect(screen.getByLabelText('유효 종료')).toHaveTextContent('2026-12-31');
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
  /* 사유 문장 대신 코드 이름 오른쪽 「변경 불가」 라벨 — 문장은 마우스 · 화면 읽기로(사용자 지시 2026-11-24). */
  it('잠금 사유가 있으면 코드 칸이 잠기고 「변경 불가」 라벨에 사유가 붙는다', () => {
    const reason =
      '이 코드를 참조하는 자료의 수를 확인할 수 없어 코드를 잠급니다. 변경이 필요하면 담당자에게 문의하세요.';
    renderPane({ codeLockReason: reason });

    expect(screen.getByLabelText('코드')).toBeDisabled();
    /* 칸 이름 옆 「변경 불가」 라벨은 두지 않는다(omf-all-around#360) — 사유는 이름의 title · 숨긴 설명으로. */
    expect(screen.queryByText('변경 불가')).toBeNull();
    expect(screen.getByTitle(reason)).toHaveTextContent(/^코드/);
    expect(screen.getByLabelText('코드')).toHaveAccessibleDescription(reason);
  });

  /* 아직 참조할 자료가 없다 — 등록에서 잠그면 코드를 넣을 수 없다. */
  it('등록 폼에서는 코드 칸이 열려 있다', () => {
    renderPane({ mode: 'create', codeLockReason: null });

    expect(screen.getByLabelText('코드')).toBeEnabled();
  });
});

describe('CodeValueFormPane — 액션', () => {
  it('고친 것이 없으면 저장이 막히고, 취소는 읽기 전용으로 돌아가는 길이라 눌린다', async () => {
    const { onCancel, user } = renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
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

  it('등록 · 수정 팝업에는 사용 중지 자리가 없다 — 표 줄의 단추가 맡는다(2026-11-26)', () => {
    renderPane({ mode: 'create' });
    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });

  it('수정은 「코드값 수정」 팝업이다', () => {
    renderPane();
    expect(screen.getByRole('dialog', { name: '코드값 수정' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });
});
