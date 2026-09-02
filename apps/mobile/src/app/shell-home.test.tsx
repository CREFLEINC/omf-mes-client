import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';

import { appRoutes } from '../routes';
import { ShellHome } from './shell-home';

/** 홈 자신과 사번 확인은 목록에 걸 자리가 아니다. */
const NOT_LISTED = new Set(['screens']);

const routedPaths = (): string[] =>
  (appRoutes[0]?.children ?? [])
    .map((child) => ('path' in child ? child.path : undefined))
    .filter((path): path is string => path !== undefined && !NOT_LISTED.has(path));

const linkedPaths = (): string[] =>
  screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))
    .filter((href): href is string => href !== null);

/**
 * 홈이 화면 목록의 전부다.
 *
 * 이 셸에는 좌측 레일이 없어 홈에 걸리지 않은 화면은 주소를 아는 사람만 연다. 실제로 임시
 * 위치 적재가 라우트에만 있고 홈에 없어, 만들어 놓고도 현장에서 열 수 없었다.
 */
describe('화면 목록', () => {
  it('라우트에 있는 화면이 모두 걸려 있다', () => {
    render(
      <MemoryRouter>
        <ShellHome />
      </MemoryRouter>,
    );

    const linked = new Set(linkedPaths());
    const missing = routedPaths().filter((path) => !linked.has(`/${path}`));

    expect(missing).toEqual([]);
  });

  it('걸린 곳이 모두 라우트에 있다', () => {
    render(
      <MemoryRouter>
        <ShellHome />
      </MemoryRouter>,
    );

    const routed = new Set(routedPaths().map((path) => `/${path}`));
    const dangling = linkedPaths().filter((href) => !routed.has(href));

    expect(dangling).toEqual([]);
  });
});
