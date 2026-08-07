import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '../app/layout';
import { appRouter } from './index';

/**
 * 사이드바가 가리키는 주소와 라우트 표를 **맞춰 본다.**
 *
 * 둘은 서로 다른 파일에 있고 서로를 참조하지 않는다. 한쪽만 고치면 링크가 죽은 채로
 * 남는데, 사이드바 테스트는 `href`만 보고 화면 테스트는 라우터를 거치지 않아
 * **어느 쪽도 그 어긋남을 잡지 못한다.** 이 파일이 그 사이를 잇는다.
 */

/** 라우터가 실제로 받는 경로. 자식 라우트의 `path`는 앞머리 `/`가 없다. */
const routedPaths = (): string[] =>
  (appRouter.routes[0]?.children ?? [])
    .map((route) => route.path)
    .filter((path): path is string => path !== undefined)
    .map((path) => `/${path}`);

const sidebarHrefs = (): string[] => {
  const router = createMemoryRouter([{ path: '/', element: <AppLayout>본문</AppLayout> }], {
    initialEntries: ['/'],
  });

  render(<RouterProvider router={router} />);

  return within(screen.getByRole('navigation', { name: '주 메뉴' }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('href') ?? '');
};

describe('appRouter', () => {
  it('사이드바가 가리키는 주소가 전부 라우트 표에 있다', () => {
    const routes = routedPaths();

    for (const href of sidebarHrefs()) {
      expect(routes).toContain(href);
    }
  });

  it('입하 예정 조회가 자재창고 앞머리로 등록돼 있다', () => {
    expect(routedPaths()).toContain('/logistics/inbound-schedule');
  });
});
