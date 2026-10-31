import { messages } from '@omf-mes/i18n';
import type { SelectOption } from '@crefle/web-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { filterOptions, type PagedOption, PagedSelect, Select, type SelectPage } from './select';

const many = ['합성 가', '합성 나', '합성 다', 'SYN-A', 'SYN-B', 'SYN-C'].map((label, index) => ({
  value: `v${String(index)}`,
  label,
}));

const Harness = ({ options = many, initial = null as string | null }) => {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <label htmlFor="pick">합성 칸</label>
      <Select
        id="pick"
        options={options}
        value={value}
        onChange={setValue}
        placeholder="고르세요"
      />
      <output data-testid="value">{value ?? ''}</output>
    </>
  );
};

describe('Select — 선택지가 많으면 검색창', () => {
  it('5개 이하는 검색창 없이 디자인 시스템 그대로다', async () => {
    const user = userEvent.setup();
    render(<Harness options={many.slice(0, 5)} />);

    await user.click(screen.getByRole('combobox', { name: '합성 칸' }));

    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(
      screen.queryByRole('searchbox', { name: messages.common.selectSearch }),
    ).not.toBeInTheDocument();
  });

  it('5개를 넘으면 목록 맨 위 검색창에 초점이 가고, 쳐서 거른 줄을 클릭해 고른다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('combobox', { name: '합성 칸' }));
    const search = await screen.findByRole('searchbox', { name: messages.common.selectSearch });
    expect(search).toHaveFocus();
    const listbox = screen.getByRole('listbox');
    expect(listbox.firstElementChild).toContainElement(search);

    await user.type(search, 'syn');
    /* 줄 글자 앞에는 디자인 시스템의 체크 아이콘 이름(`check`)이 붙어 있다. */
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((o) => o.textContent?.replace(/^check/, '')),
    ).toEqual(['SYN-A', 'SYN-B', 'SYN-C']);

    await user.click(within(listbox).getByRole('option', { name: /SYN-B$/ }));
    expect(screen.getByTestId('value')).toHaveTextContent('v4');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('검색창에서 ↓ · Enter 로 고르고, 다시 펼치면 검색어가 비어 있다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('combobox', { name: '합성 칸' }));
    await screen.findByRole('searchbox', { name: messages.common.selectSearch });
    await user.keyboard('합성');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByTestId('value')).toHaveTextContent('v1');
    await user.click(screen.getByRole('combobox', { name: '합성 칸' }));
    expect(
      await screen.findByRole('searchbox', { name: messages.common.selectSearch }),
    ).toHaveValue('');
    expect(screen.getAllByRole('option')).toHaveLength(6);
  });

  it('맞는 줄이 없으면 알리고, 고른 이름은 칸에 남는다', async () => {
    const user = userEvent.setup();
    render(<Harness initial="v0" />);

    await user.click(screen.getByRole('combobox', { name: '합성 칸' }));
    await screen.findByRole('searchbox', { name: messages.common.selectSearch });
    await user.keyboard('없는말');

    expect(screen.getByText(messages.common.selectNoMatch)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '합성 칸' })).toHaveTextContent('합성 가');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('value')).toHaveTextContent('v0');
  });
});

describe('filterOptions', () => {
  it('묶음 안을 거르고, 남은 줄이 없는 묶음은 뺀다', () => {
    const grouped = [
      { label: '묶음 1', options: many.slice(0, 3) },
      { label: '묶음 2', options: many.slice(3) },
    ];
    expect(filterOptions(grouped, ' syn-a ')).toEqual([{ label: '묶음 2', options: [many[3]] }]);
    expect(filterOptions(grouped, '')).toBe(grouped);
  });
});

describe('PagedSelect — 서버에서 쪽 단위로', () => {
  /** 120건 · 쪽마다 50건 — 검색어는 이름에 든 것만. */
  const all = Array.from({ length: 120 }, (_, index) => ({
    value: String(index + 1),
    label: `ITEM-${String(index + 1).padStart(3, '0')}`,
    data: { id: index + 1 },
  }));
  const fetchPage = vi.fn(async (query: string, page: number): Promise<SelectPage> => {
    const matched = all.filter((o) => o.label.includes(query.toUpperCase()));
    return { options: matched.slice((page - 1) * 50, page * 50), total: matched.length };
  });

  const PagedHarness = ({
    initial = null as string | null,
    selectedOption = null as SelectOption | null,
    onOptionChange = (() => {}) as (option: PagedOption) => void,
  }) => {
    const [value, setValue] = useState<string | null>(initial);
    return (
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <label htmlFor="paged">품목 칸</label>
        <PagedSelect
          id="paged"
          queryKey={['paged-test']}
          fetchPage={fetchPage}
          value={value}
          onChange={setValue}
          onOptionChange={onOptionChange}
          selectedOption={selectedOption}
          leadingOptions={[{ value: '', label: '전체' }]}
          placeholder="고르세요"
        />
        <output data-testid="value">{value ?? ''}</output>
      </QueryClientProvider>
    );
  };

  const optionTexts = () =>
    screen.getAllByRole('option').map((o) => o.textContent?.replace(/^check/, ''));

  /** jsdom 은 높이가 없다 — 바닥까지 내린 것처럼 꾸민다. */
  const scrollToEnd = (listbox: HTMLElement) => {
    Object.defineProperty(listbox, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(listbox, 'clientHeight', { configurable: true, value: 300 });
    listbox.scrollTop = 700;
    fireEvent.scroll(listbox);
  };

  beforeEach(() => {
    fetchPage.mockClear();
  });

  it('접힌 칸은 받지 않고 고른 이름만 보인다', () => {
    render(<PagedHarness initial="77" selectedOption={{ value: '77', label: 'ITEM-077' }} />);

    expect(screen.getByRole('combobox', { name: '품목 칸' })).toHaveTextContent('ITEM-077');
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('펼치면 첫 쪽만 받고, 목록 끝에 닿으면 다음 쪽을 잇는다', async () => {
    const user = userEvent.setup();
    render(<PagedHarness />);

    await user.click(screen.getByRole('combobox', { name: '품목 칸' }));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(51));
    expect(optionTexts()[0]).toBe('전체');
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenLastCalledWith('', 1);

    scrollToEnd(screen.getByRole('listbox'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(101));
    expect(fetchPage).toHaveBeenLastCalledWith('', 2);

    scrollToEnd(screen.getByRole('listbox'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(121));
    /* 총계에 닿으면 더 부르지 않는다. */
    scrollToEnd(screen.getByRole('listbox'));
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('검색어는 서버로 묻고, 고른 줄의 원본 행을 돌려준다', async () => {
    const user = userEvent.setup();
    const onOptionChange = vi.fn();
    render(<PagedHarness onOptionChange={onOptionChange} />);

    await user.click(screen.getByRole('combobox', { name: '품목 칸' }));
    await screen.findByRole('searchbox', { name: messages.common.selectSearch });
    await user.keyboard('item-11');

    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith('item-11', 1));
    await waitFor(() =>
      expect(optionTexts()).toEqual(Array.from({ length: 10 }, (_, i) => `ITEM-11${String(i)}`)),
    );

    await user.click(screen.getByRole('option', { name: /ITEM-113$/ }));
    expect(screen.getByTestId('value')).toHaveTextContent('113');
    expect(onOptionChange).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 113 } }));
    expect(screen.getByRole('combobox', { name: '품목 칸' })).toHaveTextContent('ITEM-113');
  });

  it('맞는 것이 없으면 알린다', async () => {
    const user = userEvent.setup();
    render(<PagedHarness />);

    await user.click(screen.getByRole('combobox', { name: '품목 칸' }));
    await screen.findByRole('searchbox', { name: messages.common.selectSearch });
    await user.keyboard('없는말');

    expect(await screen.findByText(messages.common.selectNoMatch)).toBeInTheDocument();
  });
});
