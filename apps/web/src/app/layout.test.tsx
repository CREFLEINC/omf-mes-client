import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from './layout';

const renderLayout = (children: string) => {
  const router = createMemoryRouter([{ path: '/', element: <AppLayout>{children}</AppLayout> }], {
    initialEntries: ['/'],
  });

  return render(<RouterProvider router={router} />);
};

describe('AppLayout', () => {
  it('사이드바에 기준정보 섹션의 창고·Location 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByText('기준정보')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: '창고·Location' })).toHaveAttribute(
      'href',
      '/master-data/warehouse-location',
    );
  });

  it('사이드바에 Routing(공정) 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: 'Routing(공정)' })).toHaveAttribute(
      'href',
      '/master-data/routing',
    );
  });

  it('사이드바에 불량·원인코드 메뉴가 보인다', () => {
    renderLayout('본문 내용');

    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });

    expect(within(sidebar).getByRole('link', { name: '불량·원인코드' })).toHaveAttribute(
      'href',
      '/master-data/defect-cause-code',
    );
  });

  it('본문 랜드마크가 자식 내용을 담는다', () => {
    renderLayout('본문 내용');

    expect(within(screen.getByRole('main')).getByText('본문 내용')).toBeInTheDocument();
  });

  it('상단바에 브랜드가 보인다', () => {
    renderLayout('본문 내용');

    expect(within(screen.getByRole('banner')).getByText('OMF-MES 관리웹')).toBeInTheDocument();
  });
});
