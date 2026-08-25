import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { ResultDetailDialog } from './result-detail-dialog';

const route = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === path,
  respond,
});
const detail = {
  inspectionResultId: 701,
  inspectionResultNo: 'SAMPLE-RESULT-701',
  inspectionRequestId: 801,
  inspectionRequestNo: 'SAMPLE-REQUEST-801',
  inspectionTypeCode: 'PQC',
  itemId: 101,
  lotId: 201,
  lotNo: 'SAMPLE-LOT-201',
  inspectionRound: 2,
  inspectedQty: 30,
  acceptedQty: 27,
  rejectedQty: 2,
  heldQty: 1,
  uomId: 301,
  overallJudgmentCode: 'REJECTED',
  inspectorId: 401,
  inspectedAt: '2026-08-12T10:22:00+09:00',
  statusCode: '확정',
  processId: 501,
  processName: '합성 공정',
};

describe('검사 결과 상세 Dialog', () => {
  it('상세와 항목별 측정 요약을 서버 값으로 표시하고 예시 총수를 추론하지 않는다', async () => {
    const onClose = vi.fn();
    const onViewMeasurements = vi.fn();
    renderWithProviders(
      <ResultDetailDialog
        inspectionResultId={701}
        labels={{
          item: new Map([[101, '합성 품목']]),
          judgment: new Map([['REJECTED', '불합격']]),
        }}
        onClose={onClose}
        onViewMeasurements={onViewMeasurements}
      />,
      {
        fetch: createStubFetch([
          route('/quality/inspection-results/701', () => jsonResponse(detail)),
          route('/quality/inspection-results/701/measurement-summary', () =>
            jsonResponse({
              asOf: '2026-08-31T11:30:00+09:00',
              items: [
                {
                  inspectionItemSpecId: 901,
                  itemName: '합성 치수',
                  specText: '11.95 ~ 12.05 mm',
                  measuredCount: 30,
                  acceptedCount: 27,
                  rejectedCount: 2,
                  unmeasuredCount: 1,
                  outOfSpecValues: ['12.07', '12.09'],
                  equipmentName: '합성 캘리퍼',
                  equipmentCalibrationExpired: true,
                  equipmentCalibrationDueDate: '2026-07-28',
                },
              ],
            }),
          ),
        ]),
      },
    );

    const dialog = await screen.findByRole('dialog', { name: '검사 결과 상세' });
    expect(await within(dialog).findByText('SAMPLE-REQUEST-801')).toBeInTheDocument();
    expect(within(dialog).getByText('합성 품목')).toBeInTheDocument();
    expect(within(dialog).getByText('합성 치수')).toBeInTheDocument();
    const summary = within(dialog).getByRole('listitem');
    expect(summary).toHaveTextContent('미측정 1건');
    expect(summary).toHaveTextContent('일부 예시: 12.07, 12.09');
    expect(within(dialog).queryByText(/외 \d+건/)).not.toBeInTheDocument();
    expect(summary).toHaveTextContent('검교정 만료 · 예정일 2026-07-28');
    expect(within(dialog).getByText('기준 2026-08-31 11:30')).toBeInTheDocument();
    expect(within(dialog).queryByText('901')).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: '측정치 전체 보기' }));
    expect(onViewMeasurements).toHaveBeenCalledWith(701);
    await userEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[1]!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
