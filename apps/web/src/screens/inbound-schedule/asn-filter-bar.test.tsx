import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AsnFilterBar, type AsnFilterBarProps } from './asn-filter-bar';
import { EMPTY_FILTERS } from './filters';

const t = messages.inboundSchedule;

const baseProps = (): AsnFilterBarProps => ({
  appliedPeriod: { from: '', to: '' },
  appliedFilters: EMPTY_FILTERS,
  supplierOptions: [{ value: '8101', label: '합성 공급사 가' }],
  itemOptions: [{ value: '8301', label: '합성 품목 가' }],
  statusOptions: ['SAMPLE_STATUS_A', 'SAMPLE_STATUS_B'],
  chipNames: { supplier: '합성 공급사 가', item: '합성 품목 가' },
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
});

const renderBar = (overrides: Partial<AsnFilterBarProps> = {}) => {
  const props = { ...baseProps(), ...overrides };

  render(<AsnFilterBar {...props} />);

  return { ...props, user: userEvent.setup() };
};

describe('AsnFilterBar — 도착 예정일 기간', () => {
  /*
   * **기간이 필수가 아니다**(이슈 #20 §6). 비운 채로도 조회할 수 있어야 하고,
   * 그 사실이 화면에서 읽혀야 한다 — 안내가 없으면 「빠뜨렸다」로 읽힌다.
   */
  it('기간이 비어 있어도 조회할 수 있다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
    expect(screen.getByText(t.filters.periodNote)).toBeInTheDocument();
  });

  it('한쪽만 채워도 조회할 수 있다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.periodFrom), '2026-08-01');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ from: '2026-08-01', to: '' }, EMPTY_FILTERS);
  });

  /* 트리거 모델은 「모아서 적용」이다 — 고치는 동안 조회가 나가면 반쯤 지운 기간으로 요청이 나간다. */
  it('고친 기간은 조회를 눌러야 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.periodFrom), '2026-07-20');

    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('기간이 뒤집히면 조회가 잠기고 사유가 보인다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.periodFrom), '2026-08-31');
    await user.type(screen.getByLabelText(t.fields.periodTo), '2026-08-01');

    const searchButton = screen.getByRole('button', { name: messages.common.search });
    expect(searchButton).toBeDisabled();

    // 비활성 컨트롤은 포커스를 받지 못한다 — 사유는 감추지 않고 항상 보이는 DOM 텍스트여야 한다.
    const reasonId = searchButton.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(t.reasons.periodReversed);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('갖춰진 기간에서는 사유가 사라지고 잠금도 풀린다', async () => {
    const { user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.periodFrom), '2026-08-01');
    await user.type(screen.getByLabelText(t.fields.periodTo), '2026-08-31');

    const searchButton = screen.getByRole('button', { name: messages.common.search });

    expect(searchButton).toBeEnabled();
    expect(searchButton).not.toHaveAttribute('aria-describedby');
  });

  it('바깥에서 기간이 바뀌면 두 칸이 따라간다 — 뒤로가기가 칸을 되돌린다', () => {
    const props = baseProps();
    const { rerender } = render(<AsnFilterBar {...props} />);

    rerender(<AsnFilterBar {...props} appliedPeriod={{ from: '2026-07-01', to: '2026-07-31' }} />);

    expect(screen.getByLabelText(t.fields.periodFrom)).toHaveValue('2026-07-01');
  });

  /*
   * 위 테스트의 짝이고 **#43이 되살아나는 자리**다. 부모는 렌더할 때마다 주소에서 값을 새로 읽어
   * **내용은 같은데 참조만 새로운** 객체를 내려보낸다(조회 응답이 도착해 다시 그려질 때가 그렇다).
   * 되돌림을 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   */
  it('같은 내용의 새 참조가 와도 편집 중인 값을 건드리지 않는다', async () => {
    const props = baseProps();
    const { rerender } = render(<AsnFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.fields.periodFrom), '2026-07-20');
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE-ASN');

    // 값은 같고 참조만 새로운 객체를 내려보낸다.
    rerender(
      <AsnFilterBar
        {...props}
        appliedPeriod={{ from: '', to: '' }}
        appliedFilters={{ ...EMPTY_FILTERS }}
      />,
    );

    expect(screen.getByLabelText(t.fields.periodFrom)).toHaveValue('2026-07-20');
    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SAMPLE-ASN');
  });

  it('초기화는 화면이 처리하도록 그대로 올린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('AsnFilterBar — 조건 4종', () => {
  it('네 조건 칸이 모두 이름을 갖는다', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.supplier)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.status)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.item)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.q)).toBeInTheDocument();
  });

  it('친 검색어가 조회에 함께 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE-ASN-0001');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(
      { from: '', to: '' },
      { ...EMPTY_FILTERS, q: 'SAMPLE-ASN-0001' },
    );
  });

  /*
   * **공급사·품목을 번호로 직접 치게 하지 않는다.** 내부 번호를 사용자가 알 리 없고,
   * 치게 하면 #44가 입력 쪽에서 되살아난다 — 이름으로 고르고 번호는 화면이 붙인다.
   */
  it('공급사·품목은 이름으로 고른다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.supplier));
    await user.click(screen.getByRole('option', { name: '합성 공급사 가' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(
      { from: '', to: '' },
      { ...EMPTY_FILTERS, supplier: '8101' },
    );
  });

  it('상태 선택지에 조회 결과에서 만든 값이 들어 있다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.status));

    expect(screen.getByRole('option', { name: 'SAMPLE_STATUS_B' })).toBeInTheDocument();
  });

  /* 두지 않으면 한 번 고른 뒤에 조건을 해제할 방법이 선택칸 안에 없어진다. */
  it('선택칸에 「전체」가 있다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.status));

    expect(screen.getByRole('option', { name: t.filters.all })).toBeInTheDocument();
  });

  it('상태 선택지 안내가 「임시 목록」임을 밝힌다', () => {
    renderBar();

    expect(screen.getByText(/임시 목록/)).toBeInTheDocument();
  });

  /* 선택지가 잘렸거나 실패했으면 그 사실을 밝힌다 — 밝히지 않으면 값이 사라진 것으로 읽힌다. */
  it('참조 선택지의 한계를 안내로 밝힌다', () => {
    renderBar({ supplierNote: t.filters.lookupTruncated, itemNote: t.filters.lookupFailed });

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
    expect(screen.getByText(t.filters.lookupFailed)).toBeInTheDocument();
  });
});

describe('AsnFilterBar — 조건 칩', () => {
  it('적용된 조건마다 칩이 하나씩 나온다', () => {
    renderBar({
      appliedFilters: { ...EMPTY_FILTERS, supplier: '8101', status: 'SAMPLE_STATUS_A' },
    });

    expect(screen.getByText(t.filters.chipSupplier('합성 공급사 가'))).toBeInTheDocument();
    expect(screen.getByText(t.filters.chipStatus('SAMPLE_STATUS_A'))).toBeInTheDocument();
  });

  /* #44 — 칩에도 내부 번호를 내지 않는다. 화면이 풀어 넘긴 이름만 쓴다. */
  it('공급사 칩에 내부 번호가 보이지 않는다', () => {
    renderBar({ appliedFilters: { ...EMPTY_FILTERS, supplier: '8101' } });

    expect(screen.getByText(t.filters.chipSupplier('합성 공급사 가'))).not.toHaveTextContent(
      '8101',
    );
  });

  it('×를 누르면 그 조건만 풀린다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { ...EMPTY_FILTERS, supplier: '8101', status: 'SAMPLE_STATUS_A' },
    });

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveStatus }));

    expect(onRemoveFilter).toHaveBeenCalledWith('status');
  });

  it('걸린 조건이 없으면 칩 줄도 없다', () => {
    renderBar();

    expect(screen.queryByText(/조건 제거$/)).not.toBeInTheDocument();
  });
});
