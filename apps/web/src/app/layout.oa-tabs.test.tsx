import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OaAccess } from '../patterns/oa-access';
import { SessionProvider } from '../patterns/session';
import { renderWithProviders } from '../test/api-harness';
import { SYNTHETIC_SESSION } from '../test/session-harness';

/* 셸의 OA 공장 판단만 바꾼다 — 감출 주소 목록(`OA_ONLY_PATHS`)은 진짜를 쓴다. */
const oa = vi.hoisted(() => ({ access: 'checking' as OaAccess }));
vi.mock('../patterns/oa-access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../patterns/oa-access')>()),
  useOaAccess: () => oa.access,
}));

const { AppLayout } = await import('./layout');

const HISTORY_HUB = '검사 이력 조회';

/*
 * 권한 목록이 있는 세션이어야 한다 — 권한을 모르면(`unknown`) 셸은 메뉴를 거르지 않는다(`filterNavGroupsByAccess`).
 * W-03-05 검사실적 · W-03-13 제품 검사표.
 */
const renderAt = (route: string) =>
  renderWithProviders(
    <SessionProvider>
      <AppLayout>본문</AppLayout>
    </SessionProvider>,
    { session: { ...SYNTHETIC_SESSION, permissions: ['W-03-05', 'W-03-13'] }, route },
  );

const hubTabHrefs = (): string[] =>
  within(screen.getByRole('navigation', { name: HISTORY_HUB }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('href') ?? '');

/* 「검사 이력 조회」 묶음의 제품 검사표 탭(W-03-13)은 OA 전용이다(omf-all-around#210). */
describe('AppLayout — 검사 이력 조회 묶음의 OA 전용 탭', () => {
  beforeEach(() => {
    oa.access = 'checking';
  });

  it('OA 공장이 있으면 검사실적 → 제품 검사표 탭이 선다', () => {
    oa.access = 'oa';
    renderAt('/quality/inspection-results');

    expect(hubTabHrefs()).toEqual(['/quality/inspection-results', '/quality/inspection-sheets']);
  });

  it('OA 공장이 없으면 제품 검사표 탭이 없고, 탭이 하나라 탭 막대도 서지 않는다', () => {
    oa.access = 'not-oa';
    renderAt('/quality/inspection-results');

    expect(screen.queryByRole('navigation', { name: HISTORY_HUB })).toBeNull();
    expect(document.querySelector('.hub-tabs')).toBeNull();
    /* 사이드바 줄은 그대로 남아 검사실적으로 건다. */
    expect(
      within(screen.getByRole('navigation', { name: '주 메뉴' })).getByRole('link', {
        name: HISTORY_HUB,
      }),
    ).toHaveAttribute('href', '/quality/inspection-results');
  });
});
