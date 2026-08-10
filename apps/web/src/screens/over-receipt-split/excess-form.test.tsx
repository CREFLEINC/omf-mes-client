import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExcessForm } from './excess-form';
import { EMPTY_HEADER_DRAFT } from './types';

const t = messages.overReceiptSplit;

const renderForm = (
  overrides: Partial<Parameters<typeof ExcessForm>[0]> = {},
): { onChange: ReturnType<typeof vi.fn>; user: ReturnType<typeof userEvent.setup> } => {
  const onChange = vi.fn();

  render(
    <ExcessForm
      values={EMPTY_HEADER_DRAFT}
      fieldErrors={{}}
      isSaving={false}
      onChange={onChange}
      {...overrides}
    />,
  );

  return { onChange, user: userEvent.setup() };
};

describe('ExcessForm', () => {
  it('예외 유형과 초과 사유 두 칸이 라벨과 함께 있다', () => {
    renderForm();

    expect(screen.getByRole('combobox', { name: t.fields.exceptionType })).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.exceptionReason)).toBeInTheDocument();
  });

  /*
   * **C25** — 값 목록이 확정되지 않아 선택지가 비어 있다. 비어 있는 선택칸만 두면
   * 고장으로 읽히므로 **왜 비었는지**를 함께 낸다.
   */
  it('예외 유형 선택지가 비어 있고 그 사실을 안내한다', async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole('combobox', { name: t.fields.exceptionType }));

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
  });

  /*
   * **초과분에만 실린다**는 사실을 밝힌다 — 밝히지 않으면 두 전표 모두에 붙는 줄 안다.
   */
  it('초과분 전표에만 실린다는 사실을 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.notes.excessOnlyFields)).toBeInTheDocument();
  });

  /*
   * **초과분의 수입검사 대상 여부는 보내지 않는다** — 계약의 분리 등록 요청에 그 자리가 없다.
   * 지어내지 않고 안내만 남긴다(계획 결정 14).
   */
  it('초과분 수입검사를 보내지 않는다는 안내를 낸다', () => {
    renderForm();

    expect(screen.getByText(t.notes.excessInspection)).toBeInTheDocument();
  });

  it('친 사유를 올린다', async () => {
    const { onChange, user } = renderForm();

    await user.type(screen.getByLabelText(t.fields.exceptionReason), '가');

    expect(onChange).toHaveBeenCalledWith({ exceptionReason: '가' });
  });

  it('사유 오류를 그 칸 옆에 낸다', () => {
    renderForm({ fieldErrors: { exceptionReason: t.errors.exceptionReasonRequired } });

    expect(screen.getByText(t.errors.exceptionReasonRequired)).toBeInTheDocument();
  });

  it('전송 중에는 두 칸이 잠긴다', () => {
    renderForm({ isSaving: true });

    expect(screen.getByRole('combobox', { name: t.fields.exceptionType })).toBeDisabled();
    expect(screen.getByLabelText(t.fields.exceptionReason)).toBeDisabled();
  });

  /* 짝 방향 — 평상시에는 잠기지 않는다. */
  it('전송 중이 아니면 사유 칸이 열려 있다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.exceptionReason)).toBeEnabled();
  });
});
