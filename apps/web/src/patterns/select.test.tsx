import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { filterOptions, Select } from './select';

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
