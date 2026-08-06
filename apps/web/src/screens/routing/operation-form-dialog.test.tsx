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

  it('관리 플래그 7종을 확인칸으로 낸다', () => {
    renderDialog();

    for (const name of [
      'MES 관리',
      '자재투입 관리',
      '실적 관리',
      '검사 관리',
      '산출 LOT 필수',
      '설비 필수',
      '금형 필수',
    ]) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    }
  });

  it('확인칸을 누르면 그 항목만 바꾼 패치를 올린다', async () => {
    const { props, user } = renderDialog();

    await user.click(screen.getByRole('checkbox', { name: '검사 관리' }));

    expect(props.onChange).toHaveBeenCalledWith({ inspectionManaged: true });
  });

  /*
   * 계약에 저장할 자리가 없다 — 감추면 사용자가 「이 화면에는 없는 항목」으로 오해한다.
   * 감추지 않고 사유와 함께 비활성으로 둔다.
   */
  it('외주 공정 확인칸은 비활성이고 사유가 함께 보인다', () => {
    renderDialog();

    expect(screen.getByRole('checkbox', { name: '외주 공정' })).toBeDisabled();
    expect(
      screen.getByText(
        '외주 공정은 아직 지정할 수 없습니다. 저장할 항목이 준비되면 이 확인칸을 쓸 수 있습니다.',
      ),
    ).toBeInTheDocument();
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
    expect(screen.getByLabelText('표준 수율(0~1)')).not.toHaveAttribute('aria-required');
  });

  it('표준 C/T와 표준 수율 라벨에 단위와 허용 범위를 적는다', () => {
    renderDialog();

    expect(screen.getByLabelText('표준 C/T(초)')).toBeInTheDocument();
    expect(screen.getByLabelText('표준 수율(0~1)')).toBeInTheDocument();
  });

  it('필드 오류를 그 입력칸 옆에 낸다', () => {
    renderDialog({ fieldErrors: { operationName: '필수 입력 항목입니다.' } });

    expect(screen.getByText('필수 입력 항목입니다.')).toBeInTheDocument();
  });

  /*
   * 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않는다.
   * 이 창의 확인이 서버 저장이 아니라는 것을 사용자가 알아야 한다.
   */
  it('확인이 서버 저장이 아니라는 사실을 밝힌다', () => {
    renderDialog();

    expect(
      screen.getByText('확인을 누르면 표에만 반영됩니다. 「저장」을 눌러야 서버에 반영됩니다.'),
    ).toBeInTheDocument();
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
