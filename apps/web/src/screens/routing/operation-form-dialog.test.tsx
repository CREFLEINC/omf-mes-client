import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createOperationDraft } from './operation-order';
import { OperationFormDialog, type OperationFormDialogProps } from './operation-form-dialog';

const PROCESS_OPTIONS = [
  { value: '9001', label: '사출' },
  { value: '9002', label: '조립' },
];

const renderDialog = (overrides: Partial<OperationFormDialogProps> = {}) => {
  const props: OperationFormDialogProps = {
    open: true,
    mode: 'create',
    values: { ...createOperationDraft(), processId: '9001', operationName: '1차 사출' },
    onChange: vi.fn(),
    fieldErrors: {},
    processOptions: PROCESS_OPTIONS,
    isSubmitting: false,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };

  render(<OperationFormDialog {...props} />);

  return { props, user: userEvent.setup() };
};

describe('OperationFormDialog', () => {
  it('추가와 수정의 제목이 다르다', () => {
    const { unmount } = render(
      <OperationFormDialog
        open
        mode="create"
        values={createOperationDraft()}
        onChange={vi.fn()}
        fieldErrors={{}}
        processOptions={PROCESS_OPTIONS}
        isSubmitting={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('공정 추가')).toBeInTheDocument();
    unmount();

    renderDialog({ mode: 'edit' });
    expect(screen.getByText('공정 수정')).toBeInTheDocument();
  });

  /* 「검사 관리」는 두지 않는다 — PQC 대상은 공정이 아니라 품목이다(사용자 결정 2026-11-05). */
  it('관리 플래그 6종을 확인칸으로 내고 검사 관리는 두지 않는다', () => {
    renderDialog();

    for (const name of [
      'MES 관리',
      '자재 투입 관리',
      '실적 관리',
      '산출 LOT 필수',
      '설비 필수',
      '금형 필수',
    ]) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('checkbox', { name: '검사 관리' })).not.toBeInTheDocument();
  });

  it('확인칸을 누르면 그 항목만 바꾼 패치를 올린다', async () => {
    const { props, user } = renderDialog();

    await user.click(screen.getByRole('checkbox', { name: '금형 필수' }));

    expect(props.onChange).toHaveBeenCalledWith({ moldRequired: true });
  });

  /*
   * 계약에 저장할 자리가 없다 — 감추면 사용자가 「이 화면에는 없는 항목」으로 오해한다.
   * 감추지 않고 사유와 함께 비활성으로 둔다.
   */
  /* 외주 공정(#231) — 다른 관리 항목처럼 켜고 끈다. */
  it('외주 공정 확인칸을 누르면 그 값을 올린다', async () => {
    const { props, user } = renderDialog();

    const outsourced = screen.getByRole('checkbox', { name: '외주 공정' });
    expect(outsourced).toBeEnabled();
    await user.click(outsourced);
    expect(props.onChange).toHaveBeenCalledWith({ isOutsourced: true });
  });

  /*
   * 검증이 필수로 막는 칸에 표시가 없으면 저장을 눌러야 필수임을 알게 된다.
   * 표시를 라벨 글자에 붙이면 접근성 이름이 「이름 *」이 되어 라벨 조회가 깨지므로 밖에 둔다(배치 규범 3).
   */
  it('필수 입력칸에 표시를 붙이되 접근성 이름을 깨뜨리지 않는다', () => {
    renderDialog();

    // 라벨 조회가 표시 없이 그대로 동작한다.
    expect(screen.getByLabelText('공정명')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '공정' })).toBeInTheDocument();

    // 표시는 보이는 글자로 남되 보조기술에는 읽히지 않는다.
    const marks = screen.getAllByText('*', { selector: '[aria-hidden="true"]' });
    expect(marks).toHaveLength(2);
  });

  it('필수가 아닌 칸에는 표시를 붙이지 않는다', () => {
    renderDialog();

    expect(screen.getByLabelText('표준 C/T(초)')).not.toHaveAttribute('aria-required');
    expect(screen.getByLabelText('표준 수율(%)')).not.toHaveAttribute('aria-required');
  });

  it('표준 C/T와 표준 수율 라벨에 단위와 허용 범위를 적는다', () => {
    renderDialog();

    expect(screen.getByLabelText('표준 C/T(초)')).toBeInTheDocument();
    expect(screen.getByLabelText('표준 수율(%)')).toBeInTheDocument();
  });

  it('필드 오류를 그 입력칸 옆에 낸다', () => {
    renderDialog({ fieldErrors: { operationName: '필수 입력 항목입니다.' } });

    expect(screen.getByText('필수 입력 항목입니다.')).toBeInTheDocument();
  });

  /* 관리 항목 — 제목 옆에 켠 개수, 안내 문장 없이 X 단추도 없다(사용자 시안 · #231). */
  it('관리 항목 제목 옆에 켠 개수를 보이고, 우상단 X 단추를 두지 않는다', () => {
    renderDialog();

    expect(screen.getByRole('region', { name: '관리 설정' })).toHaveTextContent(/\d+개 선택/);
    expect(
      screen.queryByText('확인을 누르면 표에만 반영됩니다. 「저장」을 눌러야 서버에 반영됩니다.'),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /닫기/ })).toBeNull();
  });

  it('확인을 누르면 제출을 올리고 취소는 닫기를 올린다', async () => {
    const { props, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  /*
   * 표시 여부의 정본은 open 하나다. 닫힌 <dialog>는 브라우저가 감추므로
   * 여기서는 그 속성이 실제로 내려가는지만 본다 — 화면은 이 창을 필요할 때만 붙인다.
   */
  it('닫힌 상태가 dialog 요소에 그대로 내려간다', () => {
    renderDialog({ open: false });

    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
  });
});
