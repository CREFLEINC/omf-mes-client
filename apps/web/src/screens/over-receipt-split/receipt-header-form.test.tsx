import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReceiptHeaderForm } from './receipt-header-form';
import { EMPTY_HEADER_DRAFT } from './types';

const t = messages.overReceiptSplit;

const renderForm = (
  overrides: Partial<Parameters<typeof ReceiptHeaderForm>[0]> = {},
): { onChange: ReturnType<typeof vi.fn>; user: ReturnType<typeof userEvent.setup> } => {
  const onChange = vi.fn();

  render(
    <ReceiptHeaderForm
      values={EMPTY_HEADER_DRAFT}
      fieldErrors={{}}
      isSaving={false}
      onChange={onChange}
      {...overrides}
    />,
  );

  return { onChange, user: userEvent.setup() };
};

describe('ReceiptHeaderForm', () => {
  it('입하 일시·거래명세서번호·비고 세 칸이 라벨과 함께 있다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.deliveryNoteNo)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.remarks)).toBeInTheDocument();
  });

  /* 계약이 초까지 있는 시각을 요구하지만 사용자에게는 날짜와 시각을 함께 고르게 한다. */
  it('입하 일시는 날짜와 시각을 함께 고르는 칸이다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveAttribute(
      'type',
      'datetime-local',
    );
  });

  it('친 값을 바꿀 칸의 이름과 함께 올린다', async () => {
    const { onChange, user } = renderForm();

    await user.type(screen.getByLabelText(t.fields.deliveryNoteNo), 'A');

    expect(onChange).toHaveBeenCalledWith({ deliveryNoteNo: 'A' });
  });

  it('받은 값을 그대로 보인다', () => {
    renderForm({
      values: { ...EMPTY_HEADER_DRAFT, deliveryNoteNo: 'SAMPLE-DN-01', remarks: '합성 비고' },
    });

    expect(screen.getByLabelText(t.fields.deliveryNoteNo)).toHaveValue('SAMPLE-DN-01');
    expect(screen.getByLabelText(t.fields.remarks)).toHaveValue('합성 비고');
  });

  it('오류를 그 칸 옆에 낸다', () => {
    renderForm({ fieldErrors: { receiptDatetime: t.errors.receiptDatetimeRequired } });

    expect(screen.getByText(t.errors.receiptDatetimeRequired)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDatetime)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  /*
   * **머리 값 한 벌이 두 전표에 함께 실린다**는 사실은 화면에서 읽혀야 한다 —
   * 밝히지 않으면 초과분 전표에는 따로 적어야 하는 줄 안다.
   */
  it('두 전표에 같이 실린다는 사실을 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.notes.headerSharedByBoth)).toBeInTheDocument();
  });

  /*
   * **영업일에는 입력칸이 없다.** 입하 일시에서 파생하는데 그 사실을 밝히지 않으면
   * 영업일이 무엇으로 정해졌는지 사용자가 화면 어디에서도 읽을 수 없다(승인 13-5의 조건).
   */
  it('영업일이 입하 일시에서 나온다는 사실을 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.notes.businessDateDerived)).toBeInTheDocument();
  });

  /*
   * 전송 중에는 입력칸을 잠근다 — 보내는 중에 고친 값은 이번 요청에 실리지 않는데
   * 화면만 바뀌어 「고쳐서 보냈다」로 읽힌다.
   */
  it('전송 중에는 입력칸이 잠긴다', () => {
    renderForm({ isSaving: true });

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.deliveryNoteNo)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.remarks)).toBeDisabled();
  });

  /* 짝 방향 — 평상시에는 잠기지 않는다. 늘 잠겨 있으면 위 단언이 항상 참이 된다. */
  it('전송 중이 아니면 잠기지 않는다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.receiptDatetime)).toBeEnabled();
  });
});
