import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useLocation } from 'react-router';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { INSPECTION_TYPE_GROUP, OVERALL_JUDGMENT_GROUP } from './lookups';
import { InspectionResultInsightsPage } from './page';

const LocationProbe = () => <output aria-label="현재 경로">{useLocation().pathname}</output>;
const codeValue = (code: string, codeName: string, displayOrder: number) => ({
  codeValueId: displayOrder,
  codeGroupId: 1,
  code,
  codeName,
  displayOrder,
  isActive: true,
});
const result = {
  inspectionResultId: 701,
  inspectionResultNo: 'RESULT-701',
  inspectionRequestId: 801,
  inspectionRequestNo: 'REQUEST-801',
  inspectionTypeCode: 'PQC',
  itemId: 101,
  lotId: 201,
  lotNo: 'LOT-201',
  inspectionRound: 1,
  inspectedQty: 10,
  acceptedQty: 9,
  rejectedQty: 1,
  heldQty: 0,
  uomId: 301,
  overallJudgmentCode: 'REJECTED',
  inspectorId: 401,
  inspectedAt: '2026-08-12T10:22:00+09:00',
  statusCode: 'CONFIRMED',
  processId: 501,
  processName: '합성 공정',
};

describe('검사실적·검사결과 공개 페이지 셸', () => {
  it('조회 상태와 이름을 보존하고 원천 축·상세·측정치 이동을 연결한다', async () => {
    const user = userEvent.setup();
    const calls: URL[] = [];
    let itemRequests = 0;
    renderWithProviders(
      <>
        <InspectionResultInsightsPage />
        <LocationProbe />
      </>,
      {
        route: '/quality/inspection-results?from=2026-08-01&to=2026-08-31&type=PQC',
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url);
          if (url.pathname === '/mdm/code-values') {
            const group = url.searchParams.get('codeGroupCode');
            const items =
              group === INSPECTION_TYPE_GROUP
                ? [
                    codeValue('IQC', '수입검사', 1),
                    codeValue('PQC', '공정검사', 2),
                    codeValue('OQC', '출하검사', 3),
                  ]
                : [codeValue('REJECTED', '불합격', 1)];
            return jsonResponse({ items, page: { page: 1, size: 50, total: items.length } });
          }
          if (url.pathname === '/mdm/items') {
            itemRequests += 1;
            if (itemRequests === 1)
              return jsonResponse({ message: 'synthetic error' }, { status: 500 });
            return jsonResponse({
              items: [
                { itemId: 101, itemCode: 'ITEM-101', itemName: '합성 품목', isActive: false },
              ],
              page: { page: 1, size: 1, total: 2 },
            });
          }
          if (url.pathname === '/mdm/processes')
            return jsonResponse({
              items: [
                {
                  processId: 501,
                  processCode: 'PROC-501',
                  processName: '합성 공정',
                  isActive: true,
                },
              ],
              page: { page: 1, size: 50, total: 1 },
            });
          if (url.pathname === '/quality/inspection-results/summary')
            return jsonResponse({
              inspectionCount: 1,
              inspectedQty: 10,
              acceptedQty: 9,
              rejectedQty: 1,
              heldQty: 0,
              defectRate: 10,
              finalRoundOnly: true,
              asOf: '2026-08-31T09:30:00+09:00',
            });
          if (url.pathname === '/quality/inspection-results/defect-rate-trend')
            return jsonResponse({ points: [], asOf: '2026-08-31T09:31:00+09:00' });
          if (url.pathname === '/quality/defect-records/distribution')
            return jsonResponse({
              nodes: [],
              groupBy: 'defectCode',
              asOf: '2026-08-31T09:32:00+09:00',
            });
          if (url.pathname === '/quality/inspection-results/701/measurement-summary')
            return jsonResponse({ items: [], asOf: '2026-08-31T09:33:00+09:00' });
          if (url.pathname === '/quality/inspection-results/701') return jsonResponse(result);
          if (url.pathname === '/quality/inspection-results')
            return jsonResponse({ items: [result], page: { page: 1, size: 50, total: 1 } });
          return jsonResponse({ message: 'unhandled' }, { status: 404 });
        },
      },
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: '검사실적·검사결과 조회' }),
    ).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: '탐색 경로' });
    expect(within(breadcrumb).getByText('품질관리')).toBeVisible();
    expect(await screen.findByText('일부 조회 조건 이름을 불러오지 못했습니다.')).toBeVisible();
    expect(await screen.findByText('이름을 불러오지 못했습니다')).toBeVisible();
    expect(screen.queryByText('101')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '실패한 조건 다시 시도' }));
    expect(await screen.findByText('ITEM-101 · 합성 품목 (미사용)')).toBeVisible();
    expect(screen.getByText('조회 조건 목록 일부만 표시됩니다.')).toBeVisible();
    expect(itemRequests).toBe(2);

    const lookupCalls = calls.filter((url) => url.pathname.startsWith('/mdm/'));
    expect(lookupCalls.every((url) => url.searchParams.get('includeInactive') === 'true')).toBe(
      true,
    );
    expect(
      lookupCalls
        .filter((url) => url.pathname === '/mdm/code-values')
        .map((url) => url.searchParams.get('codeGroupCode'))
        .sort(),
    ).toEqual([INSPECTION_TYPE_GROUP, OVERALL_JUDGMENT_GROUP].sort());

    await user.click(screen.getByRole('tab', { name: '불량 분포' }));
    await waitFor(() =>
      expect(
        calls
          .find((url) => url.pathname === '/quality/defect-records/distribution')
          ?.searchParams.get('sourceAxisCode'),
      ).toBe('PQC'),
    );
    await user.click(screen.getByRole('button', { name: 'REQUEST-801 상세 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '검사 결과 상세' });
    expect(within(dialog).getByText('불합격')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '측정치 전체 보기' }));
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent(
      '/quality/inspection-results/701/measurements',
    );
  });
});
