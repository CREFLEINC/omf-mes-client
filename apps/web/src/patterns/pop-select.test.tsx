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

  /**
   * ⛔ **한 쪽에 다섯을 넘겨 담지 않는다**(사용자 지시 2026-09-09). 목록이 스크롤하지 않으므로
   * 한 쪽이 팝업보다 길어지면 **마지막 줄이 잘린 채 고를 수 없게 된다** — 앞서 여섯을 담아
   * 실제로 그랬다. 잘림은 화면에서만 보이고 시험에서는 안 보이므로, 여기서는 «수»를 못박는다.
   */
  it('한 쪽에 다섯 줄까지만 놓는다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PopSelect aria-label="사유" options={OPTIONS} />);
    await user.click(screen.getByRole('combobox', { name: '사유' }));

    expect(screen.getAllByRole('option')).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: '페이지 아래' }));
    expect(screen.getAllByRole('option')).toHaveLength(2);
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

/**
 * 팝업이 닫히는 길 — **[✕] 하나다**(사용자 지시 2026-09-10).
 *
 * ⛔ 전에는 팝업 «바깥»을 눌러도 닫혔다. 터치 단말에서 목록 팝업은 화면 대부분을 덮어
 *    손이 스치기 쉽고, 그때 고르려던 항목과 검색어·쪽 위치가 함께 사라졌다.
 *
 * ⚠ 설계(G-34)는 팝업의 «내용»만 정하고 닫는 방법을 적지 않았다. 회신이 오면 맞춘다.
 */
describe('PopSelect — 팝업을 닫는 길 (#1005)', () => {
  const openPopup = async (): Promise<ReturnType<typeof userEvent.setup>> => {
    const user = userEvent.setup();

    renderWithProviders(
      <PopSelect aria-label="사유" options={OPTIONS} value={null} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole('combobox', { name: '사유' }));

    expect(screen.getByRole('searchbox', { name: '목록 검색' })).toBeInTheDocument();

    return user;
  };

  it('바깥을 눌러도 닫히지 않는다', async () => {
    const user = await openPopup();

    /* 스크림은 `dialog` 요소 자신이다 — 그 바깥 여백을 누르는 것이 「바깥 누르기」다. */
    await user.click(screen.getByRole('dialog'));

    expect(screen.getByRole('searchbox', { name: '목록 검색' })).toBeInTheDocument();
  });

  it('닫기 단추를 누르면 닫힌다', async () => {
    const user = await openPopup();

    await user.click(screen.getByRole('button', { name: /닫기|close/iu }));

    expect(screen.queryByRole('searchbox', { name: '목록 검색' })).not.toBeInTheDocument();
  });
});
