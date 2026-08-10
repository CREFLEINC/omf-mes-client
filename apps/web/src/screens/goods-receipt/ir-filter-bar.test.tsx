import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTERS, type ChipFilterKey, type IrFilters } from './filters';
import { IrFilterBar, type IrFilterBarProps } from './ir-filter-bar';

const t = messages.goodsReceipt;

const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';

const renderBar = (overrides: Partial<IrFilterBarProps> = {}) => {
  const onSearch = vi.fn<(filters: IrFilters) => void>();
  const onRemoveFilter = vi.fn<(key: ChipFilterKey) => void>();
  const onReset = vi.fn<() => void>();

  const result = render(
    <IrFilterBar
      appliedFilters={DEFAULT_FILTERS}
      supplierOptions={[{ value: '9101', label: SUPPLIER_LABEL }]}
      chipNames={{ supplier: SUPPLIER_LABEL }}
      onSearch={onSearch}
      onRemoveFilter={onRemoveFilter}
      onReset={onReset}
      {...overrides}
    />,
  );

  return { ...result, onSearch, onRemoveFilter, onReset, user: userEvent.setup() };
};

describe('IrFilterBar — 조건 줄', () => {
  it('조건 칸이 다섯이다', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.supplier)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDateFrom)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.receiptDateTo)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.status)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.q)).toBeInTheDocument();
  });

  /*
   * **C21 · M43** — 값 목록이 확정되지 않아 상태 선택지가 비어 있다.
   * 비어 있는 선택칸만 두면 고장으로 읽히므로 **왜 비어 있는지**를 `aria-describedby`로 잇는다.
   */
  it('상태 선택지가 비어 있고 안내가 붙는다', () => {
    renderBar();

    const status = screen.getByLabelText(t.fields.status);
    const note = screen.getByText(messages.pendingCode.note);

    expect(status.getAttribute('aria-describedby')).toBe(note.getAttribute('id'));
    /* 짝 방향 — 공급사 선택지는 실제로 들어 있다(빈 것이 부품 탓이 아님을 밝힌다). */
    expect(screen.getByLabelText(t.fields.supplier)).toBeInTheDocument();
  });

  /* 기본 기간이 없다는 사실을 밝히지 않으면 비어 있는 칸이 고장으로 읽힌다. */
  it('기간을 비워 두면 전체를 본다는 안내가 있다', () => {
    renderBar();

    expect(screen.getByText(t.filters.periodNote)).toBeInTheDocument();
  });

  /*
   * **M15** — 트리거 모델은 「모아서 적용」이다. 치는 동안 조회가 나가면 반쯤 지운 검색어로
   * 요청이 나간다. 조회를 누를 때만 부모에게 알린다.
   */
  it('치는 동안에는 조회를 알리지 않고 누를 때 알린다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026');

    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, q: 'IR-2026' });
  });

  it('검색칸에서 엔터로도 조회된다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026{Enter}');

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, q: 'IR-2026' });
  });

  it('기간을 고르면 조회에 함께 실린다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.receiptDateFrom), '2026-08-01');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, from: '2026-08-01' });
  });

  /*
   * **M14** — 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로 내용이 같아도 참조가 달라진다
   * (조회 응답이 도착해 다시 그려질 때가 그렇다). 참조로 되돌림을 판정하면 그때마다
   * 사용자가 치던 값이 사라진다(#43).
   */
  it('같은 값의 새 조건 객체가 와도 치던 값이 사라지지 않다', async () => {
    const { rerender, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026');

    rerender(
      <IrFilterBar
        appliedFilters={{ ...DEFAULT_FILTERS }}
        supplierOptions={[{ value: '9101', label: SUPPLIER_LABEL }]}
        chipNames={{ supplier: SUPPLIER_LABEL }}
        onSearch={vi.fn()}
        onRemoveFilter={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('IR-2026');
  });

  /* 주소가 정본이다 — 값이 실제로 달라지면 편집 중인 값도 그 값으로 되돌아간다. */
  it('적용된 조건이 달라지면 편집 중인 값이 그 값으로 되돌아간다', async () => {
    const { rerender, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026');

    rerender(
      <IrFilterBar
        appliedFilters={{ ...DEFAULT_FILTERS, q: 'IR-9999' }}
        supplierOptions={[{ value: '9101', label: SUPPLIER_LABEL }]}
        chipNames={{ supplier: SUPPLIER_LABEL }}
        onSearch={vi.fn()}
        onRemoveFilter={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('IR-9999');
  });

  it('초기화를 누르면 알린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('IrFilterBar — 조건 칩', () => {
  it('걸린 조건이 없으면 칩도 없다', () => {
    renderBar();

    expect(screen.queryByText(t.filters.chipSupplier(SUPPLIER_LABEL))).not.toBeInTheDocument();
  });

  /* **#44** — 칩에는 이름이 실리고 번호가 실리지 않는다. */
  it('공급사 칩에 이름이 실리고 번호가 실리지 않는다', () => {
    const { container } = renderBar({
      appliedFilters: { ...DEFAULT_FILTERS, supplier: '9101' },
    });

    expect(screen.getByText(t.filters.chipSupplier(SUPPLIER_LABEL))).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9101');
  });

  it('칩의 ×를 누르면 그 조건을 알린다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { ...DEFAULT_FILTERS, from: '2026-08-01', to: '2026-08-31' },
    });

    await user.click(screen.getByRole('button', { name: t.filters.chipRemovePeriod }));

    expect(onRemoveFilter).toHaveBeenCalledWith('period');
  });

  it('기간 칩은 시작과 종료를 하나로 보인다', () => {
    renderBar({ appliedFilters: { ...DEFAULT_FILTERS, from: '2026-08-01', to: '2026-08-31' } });

    expect(
      screen.getByText(t.filters.chipPeriodBoth('2026-08-01', '2026-08-31')),
    ).toBeInTheDocument();
  });
});
