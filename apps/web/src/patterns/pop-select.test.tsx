import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/api-harness';
import { PopSelect } from './pop-select';

const OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  value: `value-${String(index + 1)}`,
  label: `항목 ${String(index + 1)}`,
}));

describe('PopSelect — G-34 선택 팝업', () => {
  it('닫힌 상태에서 현재 값과 선택 버튼을 함께 보인다', () => {
    renderWithProviders(
      <PopSelect aria-label="사유" options={OPTIONS} value="value-2" onChange={vi.fn()} />,
    );

    expect(screen.getByText('항목 2')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '사유' })).toHaveTextContent('선택');
  });

  it('이미 받은 목록을 검색하고 고른 값을 반영한다', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value, setValue] = useState<string | null>(null);

      return <PopSelect aria-label="사유" options={OPTIONS} value={value} onChange={setValue} />;
    };

    renderWithProviders(<Harness />);
    await user.click(screen.getByRole('combobox', { name: '사유' }));
    await user.type(screen.getByRole('searchbox', { name: '목록 검색' }), '항목 3');

    expect(screen.getByRole('option', { name: '항목 3' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '항목 2' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: '항목 3' }));
    expect(screen.getByText('항목 3')).toBeInTheDocument();
  });

  it('페이지 위·아래와 현재 페이지·전체 건수를 제공한다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PopSelect aria-label="사유" options={OPTIONS} />);
    await user.click(screen.getByRole('combobox', { name: '사유' }));

    expect(screen.getByText('1 / 2 · 전체 7건')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '페이지 아래' }));
    expect(screen.getByRole('option', { name: '항목 7' })).toBeInTheDocument();
    expect(screen.getByText('2 / 2 · 전체 7건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '페이지 위' })).toBeEnabled();
  });

  it('검색어를 한 번에 지운다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PopSelect aria-label="사유" options={OPTIONS} />);
    await user.click(screen.getByRole('combobox', { name: '사유' }));
    const search = screen.getByRole('searchbox', { name: '목록 검색' });
    await user.type(search, '항목 7');
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }));

    expect(search).toHaveValue('');
    expect(screen.getByText('1 / 2 · 전체 7건')).toBeInTheDocument();
  });
});
