import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from './layout';

const renderLayout = (children: string) => {
  render(<AppLayout>{children}</AppLayout>);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppLayout', () => {
  it('본문을 main 랜드마크 안에 둔다', () => {
    renderLayout('본문 자리');

    expect(screen.getByRole('main', { name: '본문' })).toHaveTextContent('본문 자리');
  });

  it('상단 바를 banner 랜드마크로 둔다', () => {
    renderLayout('본문 자리');

    expect(screen.getByRole('banner')).toHaveTextContent('OMF-MES 모바일');
  });

  it('상시 메뉴를 두지 않아 navigation 랜드마크가 없다', () => {
    renderLayout('본문 자리');

    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('연결돼 있으면 온라인으로 보인다', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    renderLayout('본문 자리');

    expect(screen.getByRole('banner')).toHaveTextContent('온라인');
  });

  it('끊겨 있으면 오프라인으로 보인다', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    renderLayout('본문 자리');

    expect(screen.getByRole('banner')).toHaveTextContent('오프라인');
  });
});
