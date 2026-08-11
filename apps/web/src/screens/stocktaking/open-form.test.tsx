import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpenForm, type OpenFormProps } from './open-form';
import { EMPTY_OPEN_DRAFT } from './open-request';
import { OPEN_FIELD_NAMES } from './validation';

const t = messages.stocktaking;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';
const SAMPLE_COUNT_TYPE = 'SAMPLE_COUNT_TYPE_A';

const baseProps = (overrides: Partial<OpenFormProps> = {}): OpenFormProps => ({
  draft: EMPTY_OPEN_DRAFT,
  warehouseOptions: [{ value: '9101', label: WAREHOUSE_LABEL }],
  /* 지금의 사실 그대로 — 값 목록이 아직 없다(승인 G1). */
  countTypeOptions: [],
  fieldErrors: {},
  isLocked: false,
  onChangeCountType: vi.fn<(value: string) => void>(),
  onChangeWarehouse: vi.fn<(value: string) => void>(),
  onChangePlannedDate: vi.fn<(value: string) => void>(),
  onChangeBlindCount: vi.fn<(checked: boolean) => void>(),
  ...overrides,
});

const renderForm = (overrides: Partial<OpenFormProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<OpenForm {...props} />);

  return { ...result, ...props, user: userEvent.setup() };
};

describe('OpenForm — 개시 입력 칸', () => {
  it('칸이 넷이다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.countType)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.warehouse)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.plannedDate)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: t.fields.blindCount })).toBeInTheDocument();
  });

  /**
   * **C19 · G1** — 값 목록이 확정되지 않아 실사 유형 선택지가 비어 있다. 비어 있는 선택칸만
   * 두면 고장으로 읽히므로 왜 비었는지를 `aria-describedby`로 잇는다.
   */
  it('실사 유형 선택지가 비어 있고 안내가 붙는다', () => {
    renderForm();

    const countType = screen.getByLabelText(t.fields.countType);

    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
    expect(countType.getAttribute('aria-describedby')).not.toBeNull();
    /* 짝 방향 — 창고 선택지는 실제로 들어 있다(빈 것이 부품 탓이 아님을 밝힌다). */
    expect(screen.getByLabelText(t.fields.warehouse)).toBeInTheDocument();
  });

  /** 값 목록이 오면 안내가 걷힌다 — 남으면 고를 수 있는데도 준비 중이라 말하는 거짓말이 된다. */
  it('선택지가 차면 안내가 걷히고 고를 수 있다', async () => {
    const { user, onChangeCountType } = renderForm({
      countTypeOptions: [{ value: SAMPLE_COUNT_TYPE, label: SAMPLE_COUNT_TYPE }],
    });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(t.fields.countType));
    await user.click(screen.getByRole('option', { name: SAMPLE_COUNT_TYPE }));

    expect(onChangeCountType).toHaveBeenCalledWith(SAMPLE_COUNT_TYPE);
  });

  /*
   * **개시 폼에만 블라인드 토글을 둔다**(계획 결정 4 · 어긋남 9). 실사 헤더를 고치는
   * 오퍼레이션이 계약에 없어(실측) 개시한 뒤에는 바꿀 수 없다 — 그 사실을 고르는 자리에서
   * 미리 밝힌다. 상세 구획에서는 읽기 전용 표기로 낸다.
   */
  it('블라인드는 개시할 때만 정할 수 있다는 안내가 붙는다', () => {
    renderForm();

    expect(screen.getByText(t.notes.blindOnlyAtOpen)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: t.fields.blindCount }).getAttribute('aria-describedby'),
    ).not.toBeNull();
  });

  it('여기서 만드는 것이 새 실사라는 사실을 밝힌다', () => {
    renderForm();

    expect(screen.getByText(t.notes.openLead)).toBeInTheDocument();
  });

  /*
   * **필수 표시(*)를 붙이지 않는다.** 넷 중 셋이 필수라 표시가 거의 모든 칸에 붙어 뜻을
   * 잃는다 — 무엇이 모자라는지는 「실사 개시」 옆의 사유 한 줄이 **한 번에 하나씩** 가리킨다.
   */
  it('라벨에 필수 표시를 붙이지 않는다', () => {
    const { container } = renderForm();

    /* 짝 방향 — 라벨은 실제로 넷 다 있다(아무것도 안 그려서 통과하는 것이 아니다). */
    expect(screen.getByLabelText(t.fields.countType)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.plannedDate)).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('*');
  });

  it('초안의 값이 그대로 보인다', () => {
    renderForm({
      countTypeOptions: [{ value: SAMPLE_COUNT_TYPE, label: SAMPLE_COUNT_TYPE }],
      draft: {
        countType: SAMPLE_COUNT_TYPE,
        warehouse: '9101',
        plannedDate: '2026-08-06',
        blindCount: true,
      },
    });

    expect(screen.getByLabelText(t.fields.countType)).toHaveTextContent(SAMPLE_COUNT_TYPE);
    expect(screen.getByLabelText(t.fields.warehouse)).toHaveTextContent(WAREHOUSE_LABEL);
    expect(screen.getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-06');
    expect(screen.getByRole('checkbox', { name: t.fields.blindCount })).toBeChecked();
  });

  it('계획일과 블라인드를 고치면 그대로 알린다', async () => {
    const { user, onChangePlannedDate, onChangeBlindCount } = renderForm();

    await user.type(screen.getByLabelText(t.fields.plannedDate), '2026-08-06');
    await user.click(screen.getByRole('checkbox', { name: t.fields.blindCount }));

    expect(onChangePlannedDate).toHaveBeenLastCalledWith('2026-08-06');
    expect(onChangeBlindCount).toHaveBeenCalledWith(true);
  });
});

describe('OpenForm — 오류와 잠금', () => {
  /*
   * **C21** — 오류는 그 칸 옆에 붙는다. 배너로만 내면 넷 중 어느 칸을 고쳐야 하는지
   * 사용자가 되짚어야 한다. 화면이 잡은 오류와 서버가 준 필드 오류가 **같은 자리**에 온다.
   */
  it('인라인 오류가 그 칸에 붙는다', () => {
    renderForm({
      fieldErrors: {
        [OPEN_FIELD_NAMES.plannedDate]: t.errors.plannedDateInvalid,
        [OPEN_FIELD_NAMES.countType]: t.errors.codeTooLong(50),
      },
    });

    expect(screen.getByText(t.errors.plannedDateInvalid)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.plannedDate)).toBeInvalid();
    expect(screen.getByText(t.errors.codeTooLong(50))).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.countType)).toBeInvalid();
  });

  /* 짝 방향 — 오류가 없으면 오류 문구가 서 있지 않다. */
  it('오류가 없으면 오류 문구를 내지 않는다', () => {
    renderForm();

    expect(screen.queryByText(t.errors.plannedDateInvalid)).not.toBeInTheDocument();
  });

  /*
   * **선택지의 사정과 값의 오류를 함께 낸다.** 「고를 값이 아직 없다」와 「고른 값이 너무
   * 길다」는 서로 다른 사정이라, 한쪽이 다른 쪽을 덮으면 사용자가 무엇을 해야 하는지 잃는다.
   * 둘 다 **항상 보이는 글자**로 서고 `aria-describedby`가 둘을 함께 가리킨다.
   */
  it('선택지 안내와 오류가 한 칸에 함께 선다', () => {
    renderForm({ fieldErrors: { [OPEN_FIELD_NAMES.countType]: t.errors.codeTooLong(50) } });

    const countType = screen.getByLabelText(t.fields.countType);
    const describedBy = countType.getAttribute('aria-describedby') ?? '';

    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
    expect(screen.getByText(t.errors.codeTooLong(50))).toBeInTheDocument();
    expect(describedBy.split(' ')).toHaveLength(2);
  });

  /*
   * **C26** — 전송 중에는 네 칸이 다 잠긴다. 열어 두면 사용자가 고친 값이 지금 나가는 요청에는
   * 실리지 않는데 화면은 그 값을 보이고 있어, 무엇이 보내졌는지 화면에서 읽을 수 없게 된다.
   */
  it('전송 중에는 네 칸이 다 잠긴다', () => {
    renderForm({ isLocked: true });

    expect(screen.getByLabelText(t.fields.countType)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.warehouse)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.plannedDate)).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: t.fields.blindCount })).toBeDisabled();
  });

  /* 짝 방향 — 잠기지 않았을 때는 넷 다 쓸 수 있다. */
  it('전송 중이 아니면 네 칸이 다 열려 있다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.countType)).not.toBeDisabled();
    expect(screen.getByLabelText(t.fields.warehouse)).not.toBeDisabled();
    expect(screen.getByLabelText(t.fields.plannedDate)).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: t.fields.blindCount })).not.toBeDisabled();
  });
});
