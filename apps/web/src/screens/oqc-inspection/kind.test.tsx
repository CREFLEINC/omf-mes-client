import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { readKind, withKind } from './kind';
import { OqcInspectionScreen } from './screen';

/** OQC 탭 「구분」 — OQC 검사 / 판정 의뢰(omf-all-around#354). */

const d = messages.dispositionDecision;

describe('readKind · withKind', () => {
  it('주소에 kind=request 가 있을 때만 판정 의뢰다', () => {
    expect(readKind(new URLSearchParams('kind=request'))).toBe('request');
    expect(readKind(new URLSearchParams('kind=엉뚱한값'))).toBe('inspection');
    expect(readKind(new URLSearchParams(''))).toBe('inspection');
  });

  it('구분을 바꾸면 다른 목록의 조건 · 쪽 · 고른 건을 물려주지 않는다', () => {
    expect(withKind('request').toString()).toBe('kind=request');
    expect(withKind('inspection').toString()).toBe('');
  });
});

const render = (route: string) => {
  const paths: string[] = [];
  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    paths.push(`${url.pathname}${url.search}`);
    if (url.pathname.endsWith('/app/sessions/current')) return jsonResponse(SYNTHETIC_SESSION);
    /* 이 시험은 어느 목록이 서는지만 본다 — 목록 조회는 모두 빈 쪽이다. */
    return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
  };
  renderWithProviders(
    <SessionProvider>
      <OqcInspectionScreen />
    </SessionProvider>,
    { route, fetch: stubFetch },
  );
  return { paths };
};

describe('OQC 탭 「구분」', () => {
  it('기본은 OQC 검사 목록이고 판정 의뢰 부적합을 부르지 않는다', async () => {
    const { paths } = render('/');

    await waitFor(() =>
      expect(paths.some((path) => path.startsWith('/quality/inspection-requests?'))).toBe(true),
    );
    expect(screen.queryByRole('region', { name: d.panes.list })).toBeNull();
    expect(paths.some((path) => path.startsWith('/quality/nonconformances?'))).toBe(false);
  });

  it('판정 의뢰면 검사 건 없는 부적합 목록 | 처분 상자로 서고, 검사 목록을 부르지 않는다', async () => {
    const { paths } = render('/?kind=request');

    expect(await screen.findByRole('region', { name: d.panes.list })).toBeInTheDocument();
    await waitFor(() => {
      const url = paths.find((path) => path.startsWith('/quality/nonconformances?'));
      expect(
        new URLSearchParams(url?.split('?')[1] ?? '').get('withoutInspectionRequestOnly'),
      ).toBe('true');
    });
    expect(paths.some((path) => path.startsWith('/quality/inspection-requests?'))).toBe(false);
  });
});
