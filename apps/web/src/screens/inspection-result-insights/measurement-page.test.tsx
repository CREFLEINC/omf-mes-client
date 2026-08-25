import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { MeasurementPage } from './measurement-page';

const route = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
  respond,
});

describe('검사 측정치 전체 보기', () => {
  it('세 요청만으로 항목 이름과 값·미측정·서버 교정 상태를 표시한다', async () => {
    const calls: URL[] = [];
    let summaryRequests = 0;
    const track =
      (body: unknown): StubRoute['respond'] =>
      (request) => {
        calls.push(new URL(request.url));
        return jsonResponse(body);
      };
    const { queryClient } = renderWithProviders(
      <MeasurementPage
        inspectionResultId={701}
        page={1}
        calibrationExpired=""
        judgmentLabels={new Map([['ACCEPTED', '합격']])}
        onPageChange={() => undefined}
        onCalibrationChange={() => undefined}
      />,
      {
        fetch: createStubFetch([
          route(
            '/quality/inspection-results/701',
            track({
              inspectionResultId: 701,
              inspectionResultNo: 'SAMPLE-RESULT-701',
              inspectionRequestId: 801,
              inspectionRound: 1,
              inspectedQty: 2,
              acceptedQty: 2,
              rejectedQty: 0,
              heldQty: 0,
              uomId: 301,
              overallJudgmentCode: 'ACCEPTED',
              inspectorId: 401,
              inspectedAt: '2026-08-12T10:22:00+09:00',
              statusCode: '확정',
            }),
          ),
          route('/quality/inspection-results/701/measurement-summary', (request) => {
            calls.push(new URL(request.url));
            summaryRequests += 1;
            if (summaryRequests === 2)
              return jsonResponse({ message: 'synthetic error' }, { status: 500 });
            return jsonResponse({
              asOf: '2026-08-31T11:30:00+09:00',
              items: [
                {
                  inspectionItemSpecId: 901,
                  itemName: '합성 치수',
                  measuredCount: 1,
                  acceptedCount: 1,
                  rejectedCount: 0,
                },
              ],
            });
          }),
          route(
            '/quality/inspection-results/701/measurements',
            track({
              items: [
                {
                  inspectionMeasurementId: 1001,
                  inspectionItemSpecId: 901,
                  sampleNo: 1,
                  numericValue: 0,
                  judgmentCode: 'ACCEPTED',
                  measuredAt: '2026-08-12T10:22:00+09:00',
                  calibrationExpiredAtMeasurement: false,
                },
                {
                  inspectionMeasurementId: 1002,
                  inspectionItemSpecId: 999,
                  sampleNo: 2,
                  judgmentCode: 'ACCEPTED',
                  measuredAt: '2026-08-12T10:23:00+09:00',
                  calibrationExpiredAtMeasurement: true,
                },
              ],
              page: { page: 1, size: 50, total: 2 },
            }),
          ),
        ]),
      },
    );

    expect(await screen.findByText('SAMPLE-RESULT-701')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: '검사 측정치' });
    expect(within(table).getByText('합성 치수')).toBeInTheDocument();
    expect(within(table).getByText('항목 이름 미확인')).toBeInTheDocument();
    expect(within(table).getByText('0')).toBeInTheDocument();
    expect(within(table).getByText('미측정')).toBeInTheDocument();
    expect(within(table).getByText('검교정 만료')).toBeInTheDocument();
    expect(within(table).queryByText('999')).not.toBeInTheDocument();
    expect(calls).toHaveLength(3);
    const measurementCall = calls.find((url) => url.pathname.endsWith('/measurements'));
    expect(measurementCall?.searchParams.has('calibrationExpired')).toBe(false);
    expect(measurementCall?.searchParams.has('page')).toBe(false);

    await queryClient.refetchQueries({
      queryKey: ['inspection-result-insights', 'measurement-summary', 701],
    });
    await waitFor(() => expect(within(table).queryByText('합성 치수')).not.toBeInTheDocument());
    expect(screen.getByText('측정 항목 이름을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(within(table).getAllByText('항목 이름 미확인')).toHaveLength(2);
    expect(within(table).queryByText(/901|999/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '측정 항목 이름 다시 시도' }));
    expect(await within(table).findByText('합성 치수')).toBeInTheDocument();
    expect(summaryRequests).toBe(3);
  });

  it('상세 오류를 별도로 알리고 사용자가 같은 상세만 다시 요청한다', async () => {
    let detailRequests = 0;
    renderWithProviders(
      <MeasurementPage
        inspectionResultId={701}
        page={1}
        calibrationExpired=""
        judgmentLabels={new Map()}
        onPageChange={() => undefined}
        onCalibrationChange={() => undefined}
      />,
      {
        fetch: async (request) => {
          const path = new URL(request.url).pathname;
          if (path.endsWith('/measurement-summary'))
            return jsonResponse({ asOf: '2026-08-31T11:30:00+09:00', items: [] });
          if (path.endsWith('/measurements'))
            return jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } });
          detailRequests += 1;
          if (detailRequests === 1)
            return jsonResponse({ message: 'synthetic detail error' }, { status: 500 });
          return jsonResponse({
            inspectionResultId: 701,
            inspectionResultNo: 'SAMPLE-RESULT-RETRIED',
            inspectionRequestId: 801,
            inspectionRound: 1,
            inspectedQty: 0,
            acceptedQty: 0,
            rejectedQty: 0,
            heldQty: 0,
            uomId: 301,
            overallJudgmentCode: 'ACCEPTED',
            inspectorId: 401,
            inspectedAt: '2026-08-12T10:22:00+09:00',
            statusCode: '확정',
          });
        },
      },
    );

    expect(await screen.findByText('검사 결과 정보를 불러오지 못했습니다.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '검사 결과 정보 다시 시도' }));
    expect(await screen.findByText('SAMPLE-RESULT-RETRIED')).toBeInTheDocument();
    expect(detailRequests).toBe(2);
  });

  it('명시한 교정 필터와 다음 page만 원시 측정치 요청에 보낸다', async () => {
    const calls: URL[] = [];
    renderWithProviders(
      <MeasurementPage
        inspectionResultId={701}
        page={2}
        calibrationExpired="only"
        judgmentLabels={new Map()}
        onPageChange={() => undefined}
        onCalibrationChange={() => undefined}
      />,
      {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url);
          if (url.pathname.endsWith('/measurements'))
            return jsonResponse({ items: [], page: { page: 2, size: 50, total: 50 } });
          if (url.pathname.endsWith('/measurement-summary'))
            return jsonResponse({ asOf: '2026-08-31T11:30:00+09:00', items: [] });
          return jsonResponse({
            inspectionResultId: 701,
            inspectionResultNo: 'SAMPLE-RESULT-701',
            inspectionRequestId: 801,
            inspectionRound: 1,
            inspectedQty: 0,
            acceptedQty: 0,
            rejectedQty: 0,
            heldQty: 0,
            uomId: 301,
            overallJudgmentCode: 'ACCEPTED',
            inspectorId: 401,
            inspectedAt: '2026-08-12T10:22:00+09:00',
            statusCode: '확정',
          });
        },
      },
    );
    await screen.findByText('측정치가 없습니다');
    const request = calls.find((url) => url.pathname.endsWith('/measurements'));
    expect(request?.searchParams.get('page')).toBe('2');
    expect(request?.searchParams.get('calibrationExpired')).toBe('only');
  });

  it('다음 page placeholder 동안 이전 측정 행을 숨긴다', async () => {
    const Page = () => {
      const [page, setPage] = useState(1);
      return (
        <MeasurementPage
          inspectionResultId={701}
          page={page}
          calibrationExpired=""
          judgmentLabels={new Map()}
          onPageChange={setPage}
          onCalibrationChange={() => undefined}
        />
      );
    };
    renderWithProviders(<Page />, {
      fetch: async (request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/measurement-summary'))
          return jsonResponse({ asOf: '2026-08-31T11:30:00+09:00', items: [] });
        if (url.pathname.endsWith('/measurements')) {
          if (url.searchParams.get('page') === '2') return new Promise(() => undefined);
          return jsonResponse({
            items: [
              {
                inspectionMeasurementId: 1001,
                inspectionItemSpecId: 901,
                sampleNo: 1,
                textValue: 'SAMPLE-PAGE-ONE',
                judgmentCode: 'ACCEPTED',
                measuredAt: '2026-08-12T10:22:00+09:00',
              },
            ],
            page: { page: 1, size: 50, total: 51 },
          });
        }
        return jsonResponse({
          inspectionResultId: 701,
          inspectionResultNo: 'SAMPLE-RESULT-701',
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
          statusCode: '확정',
        });
      },
    });

    await screen.findByText('SAMPLE-PAGE-ONE');
    await userEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(
      await screen.findByRole('status', { name: '측정치 페이지를 불러오는 중' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('SAMPLE-PAGE-ONE')).not.toBeInTheDocument();
  });
});
