import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BomComponentFormDialog } from './bom-component-form-dialog';
import type { BomComponentFormValues } from './bom-component-mappers';
import type { SelectOption } from './types';

const ROUTING_OPERATIONS: SelectOption[] = [
  { value: '8001', label: 'Rev 2 · 1. 합성 공정 A' },
  { value: '8002', label: 'Rev 2 · 2. 합성 공정 B' },
];

const PROCESSES: SelectOption[] = [
  { value: '3001', label: 'SYN-PROC-01 · 합성 공정 가' },
  { value: '3002', label: 'SYN-PROC-02 · 합성 공정 나' },
];

const values = (overrides: Partial<BomComponentFormValues> = {}): BomComponentFormValues => ({
  routingOperationId: '8002',
  actualUseProcessId: '3001',
  lotTraceRequired: true,
  backflushAllowed: false,
  ...overrides,
});

const renderDialog = (overrides: Partial<Parameters<typeof BomComponentFormDialog>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<BomComponentFormValues>) => void>();
  const onSave = vi.fn<() => void>();
  const onClose = vi.fn<() => void>();

  render(
    <BomComponentFormDialog
      rowName="1. SYN-ITEM-02 · 합성 품목 B"
      loadError={null}
      values={values()}
      onChange={onChange}
      routingOperationOptions={() => ROUTING_OPERATIONS}
      processOptions={() => PROCESSES}
      fieldErrors={{}}
      banner={null}
      isDirty={false}
      isSaving={false}
      onSave={onSave}
      onClose={onClose}
      {...overrides}
    />,
  );

  return { onChange, onSave, onClose, user: userEvent.setup() };
};

/**
 * C14 — **창에 확장 열 넷뿐이다.**
 *
 * 계약의 `BomComponentUpdate`가 넷만 받는데 서버가 경계를 막지 않는다(실측 P) —
 * 창에 입력칸을 두지 않으면 실수로도 실을 수 없다.
 */
describe('BomComponentFormDialog — 확장 열 넷뿐이다 (C14)', () => {
  it('원본 열의 입력칸이 없다', () => {
    renderDialog();

    for (const label of ['순서', '구성품', '소요량', '단위', '스크랩률', '필수']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
  });

  it('확장 열 넷의 컨트롤이 있다', () => {
    renderDialog();

    expect(screen.getByLabelText('등록 공정')).toBeInTheDocument();
    expect(screen.getByLabelText('실사용 공정')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'LOT 추적 강제' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '백플러시 허용' })).toBeInTheDocument();
  });

  /* 입력칸 수를 세면 원본 열이 하나라도 늘었을 때 잡힌다. */
  it('폼 컨트롤이 넷뿐이다', () => {
    renderDialog();

    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  /* 없는 것을 찾다가 「화면이 빠뜨렸다」로 읽지 않게 한다. */
  it('원본 열이 여기서 바뀌지 않는다는 안내가 있다', () => {
    renderDialog();

    expect(
      screen.getByText(
        '원본 열은 외부 시스템이 소유해 여기서 바꿀 수 없습니다. 아래 네 가지만 저장됩니다.',
      ),
    ).toBeInTheDocument();
  });

  it('제목이 대상 줄을 담는다', () => {
    renderDialog();

    expect(
      screen.getByRole('dialog', { name: /1\. SYN-ITEM-02 · 합성 품목 B/ }),
    ).toBeInTheDocument();
  });
});

/**
 * §5.3 6행 — **잠금 토큰이 행 상세에만 온다.**
 * 목록만 받은 상태에서 저장을 누를 수 있게 두면 요청이 조용히 멈춘다.
 */
describe('BomComponentFormDialog — 상세를 받기 전에는 저장이 닫혀 있다', () => {
  it('값이 오기 전에는 자리표시를 내고 저장이 닫혀 있다', () => {
    renderDialog({ values: null });

    expect(screen.getByRole('status', { name: '구성품 정보를 불러오는 중' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.queryByLabelText('등록 공정')).not.toBeInTheDocument();
  });

  it('상세 조회 실패는 폼을 밀어낸다', () => {
    renderDialog({ values: null, loadError: <p>조회에 실패했습니다</p> });

    expect(screen.getByText('조회에 실패했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '구성품 정보를 불러오는 중' })).toBeNull();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('고친 것이 없으면 저장이 닫혀 있다', () => {
    renderDialog({ isDirty: false });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('고치면 저장이 열린다', () => {
    renderDialog({ isDirty: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('보내는 중에는 저장을 다시 누를 수 없다', () => {
    renderDialog({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });
});

describe('BomComponentFormDialog — 입력', () => {
  it('공정을 고르면 바깥에 알린다', async () => {
    const { onChange, user } = renderDialog();

    await user.click(screen.getByLabelText('등록 공정'));
    await user.click(screen.getByRole('option', { name: 'Rev 2 · 1. 합성 공정 A' }));

    expect(onChange).toHaveBeenCalledWith({ routingOperationId: '8001' });
  });

  /* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 선택지로 둔다. */
  it('공정을 비울 수 있다', async () => {
    const { onChange, user } = renderDialog();

    await user.click(screen.getByLabelText('등록 공정'));
    await user.click(screen.getByRole('option', { name: '지정 안 함' }));

    expect(onChange).toHaveBeenCalledWith({ routingOperationId: '' });
  });

  it('확장 표시를 끄면 바깥에 알린다', async () => {
    const { onChange, user } = renderDialog();

    await user.click(screen.getByRole('switch', { name: 'LOT 추적 강제' }));

    expect(onChange).toHaveBeenCalledWith({ lotTraceRequired: false });
  });

  it('저장과 취소가 바깥에 알린다', async () => {
    const { onSave, onClose, user } = renderDialog({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * 공정 흐름이 하나도 없으면 고를 값이 없다. **감추지 않고 사유를 붙인다**(배치 규범 4) —
   * 빈 선택칸만 두면 사용자가 목록이 안 나오는 것으로 읽는다.
   */
  it('공정 흐름이 없으면 등록 공정이 사유 붙은 비활성이다', () => {
    renderDialog({
      routingOperationOptions: () => [],
      routingOperationDisabledReason:
        '등록 공정은 이 품목에 등록된 공정 흐름이 없어 고를 수 없습니다. 공정 흐름을 먼저 등록한 뒤 다시 여세요.',
    });

    const select = screen.getByLabelText('등록 공정');
    expect(select).toBeDisabled();

    const describedBy = select.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy ?? '')?.textContent).toMatch(
      /공정 흐름을 먼저 등록한 뒤 다시 여세요/,
    );
  });

  /* 실사용 공정은 다른 자원이라 함께 막히지 않는다. */
  it('공정 흐름이 없어도 실사용 공정은 고를 수 있다', () => {
    renderDialog({
      routingOperationOptions: () => [],
      routingOperationDisabledReason: '등록 공정은 …',
    });

    expect(screen.getByLabelText('실사용 공정')).toBeEnabled();
  });

  it('서버 필드 오류를 그 칸에 낸다', () => {
    renderDialog({ fieldErrors: { routingOperationId: '없는 공정입니다.' } });

    expect(screen.getByText('없는 공정입니다.')).toBeInTheDocument();
  });

  /* 창을 닫으면 실패 이유가 사라진다 — 창 안에서 보여야 다시 시도할 수 있다. */
  it('저장 실패 배너를 창 안에 담는다', () => {
    renderDialog({ banner: <p>지금은 저장할 수 없는 상태입니다</p> });

    expect(screen.getByText('지금은 저장할 수 없는 상태입니다')).toBeInTheDocument();
  });
});
