import { setLocale } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCALE_STORAGE_KEY } from '../patterns/locale-preference';
import { LocaleSelect } from './locale-select';

beforeEach(() => {
  globalThis.localStorage.clear();
});

/** ⚠ 고른 언어는 모듈 하나가 든 전역이다 — 두고 나가면 뒤에 도는 파일이 베트남어로 선다. */
afterEach(() => {
  globalThis.localStorage.clear();
  setLocale('ko');
});

/** 칸 이름은 고른 언어를 따르므로 부르는 쪽이 그때의 이름을 준다. */
const openChoices = async (name = '언어'): Promise<void> => {
  const user = userEvent.setup();

  await user.click(screen.getByRole('combobox', { name }));
};

describe('언어 선택', () => {
  /**
   * ⛔ **고를 언어의 이름은 옮기지 않는다.** 지금 화면이 읽히지 않아 언어를 바꾸러 온 사람인데,
   * 고를 언어의 이름까지 읽을 수 없는 언어로 적혀 있으면 무엇을 고를지 알 수 없다.
   */
  it('고를 언어가 각자 제 언어로 선다', async () => {
    render(<LocaleSelect reload={vi.fn()} />);

    await openChoices();

    expect(screen.getByRole('option', { name: '한국어' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tiếng Việt' })).toBeInTheDocument();
  });

  it('지금 보고 있는 언어가 골라진 채로 선다', async () => {
    setLocale('vi');
    render(<LocaleSelect reload={vi.fn()} />);

    await openChoices('Ngôn ngữ');

    expect(screen.getByRole('option', { name: 'Tiếng Việt' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /**
   * ⭐ **남기고 새로고침한다.** 남기지 않으면 새로고침이 첫 방문으로 되돌려 방금 고른 것이
   * 사라지고, 새로고침하지 않으면 모듈 최상위에서 붙잡은 자리만 옛 언어로 남아 한 화면에 두
   * 언어가 섞인다. 둘은 한 동작이라 함께 잰다.
   */
  it('고르면 브라우저에 남기고 새로고침한다', async () => {
    const reload = vi.fn();
    render(<LocaleSelect reload={reload} />);

    await openChoices();
    await userEvent.setup().click(screen.getByRole('option', { name: 'Tiếng Việt' }));

    expect(globalThis.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('vi');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  /** ⚠ 새로고침은 보던 것을 버리는 일이라, 바뀌는 것이 없는데 치르게 하지 않는다. */
  it('같은 언어를 다시 고르면 새로고침하지 않는다', async () => {
    const reload = vi.fn();
    render(<LocaleSelect reload={reload} />);

    await openChoices();
    await userEvent.setup().click(screen.getByRole('option', { name: '한국어' }));

    expect(reload).not.toHaveBeenCalled();
  });

  /** 접근명도 고른 언어를 따른다 — 베트남어 화면에 이 칸만 한국어로 남지 않는다. */
  it('베트남어로 서면 칸 이름도 베트남어다', () => {
    setLocale('vi');
    render(<LocaleSelect reload={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' })).toBeInTheDocument();
  });
});
