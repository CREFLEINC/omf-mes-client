import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTERS, type PoFilters } from './filters';
import { PoFilterBar, type PoFilterBarProps } from './po-filter-bar';

const t = messages.overReceiptSplit;

const SUPPLIER_OPTIONS = [
  { value: '9101', label: 'SAMPLE-SUP-01 · 합성 공급사 가' },
  { value: '9103', label: 'SAMPLE-SUP-03 · 합성 공급사 다 (미사용)' },
];

const renderBar = (overrides: Partial<PoFilterBarProps> = {}) => {
  const onSearch = vi.fn<(filters: PoFilters) => void>();
  const onRemoveFilter = vi.fn<(key: 'supplier' | 'q') => void>();
  const onReset = vi.fn<() => void>();

  const result = render(
    <PoFilterBar
      appliedFilters={DEFAULT_FILTERS}
      supplierOptions={SUPPLIER_OPTIONS}
      chipNames={{ supplier: 'SAMPLE-SUP-01 · 합성 공급사 가' }}
      onSearch={onSearch}
      onRemoveFilter={onRemoveFilter}
      onReset={onReset}
      {...overrides}
    />,
  );

  return { ...result, onSearch, onRemoveFilter, onReset, user: userEvent.setup() };
};

const openOnlyBox = (): HTMLElement => screen.getByRole('checkbox', { name: t.fields.openOnly });

describe('PoFilterBar — 모아서 적용', () => {
  /*
   * 조건을 고치는 동안 조회가 나가면 반쯤 지운 검색어로 요청이 나간다.
   * 「조회」를 누를 때만 넘긴다.
   */
  it('치는 동안에는 조회하지 않고 「조회」를 누를 때 넘긴다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-9');

    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ supplier: '', q: 'PO-2026-9', openOnly: true });
  });

  /* 검색칸에서 엔터가 아무 일도 하지 않으면 멈춘 것으로 읽힌다. */
  it('검색칸에서 엔터로도 조회된다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-9{Enter}');

    expect(onSearch).toHaveBeenCalledWith({ supplier: '', q: 'PO-2026-9', openOnly: true });
  });

  /*
   * **확인칸도 「조회」를 눌러야 반영된다.** 즉시 반영하면 같은 줄의 컨트롤 셋 중 하나만
   * 다르게 움직여 어느 것이 언제 적용되는지 알 수 없다.
   */
  it('미완료만은 끄자마자 조회되지 않고 「조회」에 실려 나간다', async () => {
    const { onSearch, user } = renderBar();

    expect(openOnlyBox()).toBeChecked();

    await user.click(openOnlyBox());

    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ supplier: '', q: '', openOnly: false });
  });

  /* 조건 없이도 조회가 열려 있다 — 잠글 조건이 없어 비활성 사유가 붙는 자리도 없다. */
  it('조건이 하나도 없어도 조회를 누를 수 있다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
  });

  it('초기화는 곧바로 알린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  /* 기본이 켬이라는 사실을 밝히지 않으면 무엇이 빠져 보이는지 알 수 없다. */
  it('미완료만이 기본이라는 사실을 밝힌다', () => {
    renderBar();

    expect(screen.getByText(t.filters.openOnlyNote)).toBeInTheDocument();
  });
});

describe('PoFilterBar — 주소가 정본이다', () => {
  /*
   * **#43의 조건 줄 자리** — 되돌림을 참조가 아니라 값으로 판정한다.
   * 부모가 다시 그려질 때마다 되돌리면 사용자가 치던 값이 사라진다.
   */
  it('내용이 같은 조건이 새 참조로 다시 와도 치던 값을 덮지 않는다', async () => {
    const { rerender, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-9');

    rerender(
      <PoFilterBar
        appliedFilters={{ supplier: '', q: '', openOnly: true }}
        supplierOptions={SUPPLIER_OPTIONS}
        chipNames={{ supplier: '' }}
        onSearch={() => undefined}
        onRemoveFilter={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('PO-2026-9');
  });

  /* 짝 방향 — 값이 실제로 달라지면(뒤로가기·초기화) 편집 중인 값도 그 값으로 되돌아간다. */
  it('적용된 조건이 실제로 달라지면 편집 중인 값이 되돌아간다', async () => {
    const { rerender, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-9');

    rerender(
      <PoFilterBar
        appliedFilters={{ supplier: '', q: 'PO-2026-8', openOnly: false }}
        supplierOptions={SUPPLIER_OPTIONS}
        chipNames={{ supplier: '' }}
        onSearch={() => undefined}
        onRemoveFilter={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('PO-2026-8');
    expect(openOnlyBox()).not.toBeChecked();
  });
});

describe('PoFilterBar — 조건 칩', () => {
  it('걸린 조건마다 칩이 하나씩 보인다', () => {
    renderBar({ appliedFilters: { supplier: '9101', q: 'PO-2026-9', openOnly: true } });

    expect(
      screen.getByText(t.filters.chipSupplier('SAMPLE-SUP-01 · 합성 공급사 가')),
    ).toBeInTheDocument();
    expect(screen.getByText(t.filters.chipQ('PO-2026-9'))).toBeInTheDocument();
  });

  /* 칩은 해제라 즉시 반영한다 — 「조회」를 다시 누르게 하면 조건이 걸린 채로 남는다. */
  it('칩의 ×는 그 조건 하나만 곧바로 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { supplier: '9101', q: 'PO-2026-9', openOnly: true },
    });

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveSupplier }));

    expect(onRemoveFilter).toHaveBeenCalledWith('supplier');
  });

  /* 미완료만은 칩이 아니다 — 확인칸 자체가 켬·끔을 그대로 보인다. */
  it('미완료만은 칩으로 만들지 않는다', () => {
    renderBar({ appliedFilters: { supplier: '', q: '', openOnly: false } });

    expect(openOnlyBox()).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /조건 제거$/ })).not.toBeInTheDocument();
  });

  /* 번호를 문구로 만드는 자리를 두지 않는다(#44) — 화면이 이름으로 풀어 넘긴다. */
  it('공급사 칩에 내부 번호가 없다', () => {
    renderBar({ appliedFilters: { supplier: '9101', q: '', openOnly: true } });

    expect(
      screen.getByText(t.filters.chipSupplier('SAMPLE-SUP-01 · 합성 공급사 가')),
    ).toBeInTheDocument();
    expect(screen.queryByText(/9101/)).not.toBeInTheDocument();
  });
});

describe('PoFilterBar — 선택지의 한계', () => {
  it('선택지가 잘렸으면 그 사실을 밝힌다', () => {
    renderBar({ supplierNote: t.filters.lookupTruncated });

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  /* 잠그면 지금 걸린 조건을 해제할 방법이 사라진다. */
  it('선택지를 못 불러와도 선택칸을 잠그지 않는다', () => {
    renderBar({ supplierOptions: [], supplierNote: t.filters.lookupFailed });

    expect(screen.getByText(t.filters.lookupFailed)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.supplier })).toBeEnabled();
  });
});
