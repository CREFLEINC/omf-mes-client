import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { InspectionMeasurementRoutePage } from './measurement-route-page';

const RoutedPage = () => (
  <>
    <Routes>
      <Route
        path="/quality/inspection-results/:inspectionResultId/measurements"
        element={<InspectionMeasurementRoutePage />}
      />
    </Routes>
    <LocationProbe />
  </>
);
const LocationProbe = () => {
  const location = useLocation();
  return <output aria-label="현재 주소">{`${location.pathname}${location.search}`}</output>;
};

const result = {
  inspectionResultId: 701,
  inspectionResultNo: 'RESULT-701',
  inspectionRequestId: 801,
  inspectionRound: 1,
  inspectedQty: 1,
  acceptedQty: 1,
  rejectedQty: 0,
  heldQty: 0,
  uomId: 301,
  overallJudgmentCode: 'ACCEPTED',
  inspectorId: 401,
  inspectedAt: '2026-08-12T10:22:00+09:00',
  statusCode: 'CONFIRMED',
};

describe('검사 측정치 공개 route', () => {
  it('경로 ID와 쪽·교정 조건을 요청에 잇고 판정 lookup 실패를 복구한다', async () => {
    const user = userEvent.setup();
    const measurementCalls: URL[] = [];
    let judgmentRequests = 0;
    renderWithProviders(<RoutedPage />, {
      route: '/quality/inspection-results/701/measurements?page=2&calibration=only&keep=yes',
      fetch: async (request) => {
        const url = new URL(request.url);
        if (url.pathname === '/mdm/code-values') {
          judgmentRequests += 1;
          if (judgmentRequests === 1)
            return jsonResponse({ message: 'synthetic error' }, { status: 500 });
          return jsonResponse({
            items: [
              {
                codeValueId: 1,
                codeGroupId: 2,
                code: 'ACCEPTED',
                codeName: '합격',
                displayOrder: 1,
                isActive: false,
              },
            ],
            page: { page: 1, size: 1, total: 2 },
          });
        }
        if (url.pathname.endsWith('/measurement-summary'))
          return jsonResponse({ asOf: '2026-08-31T11:30:00+09:00', items: [] });
        if (url.pathname.endsWith('/measurements')) {
          measurementCalls.push(url);
          return jsonResponse({
            items: [
              {
                inspectionMeasurementId: 1001,
                inspectionItemSpecId: 901,
                sampleNo: 1,
                textValue: 'OK',
                judgmentCode: 'ACCEPTED',
                measuredAt: '2026-08-12T10:22:00+09:00',
              },
            ],
            page: { page: Number(url.searchParams.get('page') ?? 1), size: 50, total: 51 },
          });
        }
        return jsonResponse(result);
      },
    });

    expect(await screen.findByText('판정 이름을 불러오지 못했습니다.')).toBeVisible();
    expect(await screen.findByText(messages.common.reference.failed)).toBeVisible();
    expect(screen.queryByText('ACCEPTED')).not.toBeInTheDocument();
    expect(measurementCalls[0]?.searchParams.get('page')).toBe('2');
    expect(measurementCalls[0]?.searchParams.get('calibrationExpired')).toBe('only');

    await user.click(screen.getByRole('button', { name: '판정 이름 다시 시도' }));
    expect(await screen.findByText('합격 (미사용)')).toBeVisible();
    expect(screen.getByText('판정 이름 목록 일부만 확인되었습니다.')).toBeVisible();

    await user.click(screen.getByRole('combobox', { name: '교정 상태 필터' }));
    await user.click(screen.getByRole('option', { name: '검교정 만료 제외' }));
    await waitFor(() =>
      expect(screen.getByLabelText('현재 주소')).toHaveTextContent(
        '/quality/inspection-results/701/measurements?calibration=exclude&keep=yes',
      ),
    );
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('page=2');
    expect(screen.getByRole('link', { name: '검사실적 목록으로 돌아가기' })).toHaveAttribute(
      'href',
      '/quality/inspection-results',
    );
    expect(
      within(screen.getByRole('navigation', { name: '탐색 경로' })).getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('유효하지 않은 결과 ID에서는 API를 부르지 않고 목록 복귀 경로를 제공한다', async () => {
    let calls = 0;
    renderWithProviders(<RoutedPage />, {
      route: '/quality/inspection-results/not-a-number/measurements',
      fetch: () => {
        calls += 1;
        return Promise.resolve(jsonResponse({}));
      },
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: '검사 측정치 전체 보기' }),
    ).toBeVisible();
    expect(screen.getByText('검사 결과 번호가 유효하지 않습니다')).toBeVisible();
    expect(calls).toBe(0);
  });
});
