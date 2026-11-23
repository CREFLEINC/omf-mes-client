import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PlanViewLauncher } from './plan-view-launcher';

const t = messages.partsIqcInspection.plan;

const Where = () => (
  <output aria-label="현재 주소">{`${useLocation().pathname}${useLocation().search}`}</output>
);

const open = (permissions: string[]) =>
  renderWithProviders(
    <SessionProvider>
      <PlanViewLauncher inspectionPlanVersionId={1001} label="기준 조회" />
      <Where />
    </SessionProvider>,
    {
      session: {
        userId: 1,
        loginId: 'TST',
        userName: '합성',
        scopes: [],
        mustChangePassword: false,
        roles: [],
        permissions,
      } as unknown as Session,
      fetch: createStubFetch([
        {
          match: (request) =>
            new URL(request.url).pathname === '/quality/inspection-plan-versions/1001',
          respond: () =>
            jsonResponse({
              inspectionPlanVersion: {
                inspectionPlanVersionId: 1001,
                inspectionPlanId: 77,
                planVersion: 2,
                samplingMethodCode: 'SAMPLE_BY_LOT',
                samplingRatio: 30,
              },
            }),
        },
        {
          match: (request) =>
            new URL(request.url).pathname === '/quality/inspection-plan-versions/1001/items',
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
        },
        {
          match: (request) => new URL(request.url).pathname === '/mdm/uoms',
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
        },
      ]),
    },
  );

/** PQC · OQC 의 [기준 조회] · [검사 항목 조회](#197) — IQC 와 같은 「검사 기준 상세」 창을 연다(#353). */
describe('PlanViewLauncher', () => {
  it('누르면 그 기준 버전을 불러 검사 기준 상세 창을 연다 — 검사 기준 권한이 없으면 [수정]이 없다', async () => {
    open([]);

    await userEvent.click(screen.getByRole('button', { name: '기준 조회' }));

    expect(await screen.findByRole('dialog', { name: new RegExp(t.title) })).toBeInTheDocument();
    expect(screen.getByText(t.ratio(30))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.edit })).toBeNull();
  });

  it('검사 기준 권한이 있으면 [수정]이 그 기준 · 버전으로 검사 기준 화면을 연다', async () => {
    open(['W-06-02']);

    await userEvent.click(screen.getByRole('button', { name: '기준 조회' }));
    await userEvent.click(await screen.findByRole('button', { name: t.edit }));

    expect(screen.getByLabelText('현재 주소')).toHaveTextContent(
      '/master-data/inspection-standard?plan=77&ver=1001',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
