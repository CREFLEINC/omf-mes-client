import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { InspectionHistoryPanel } from './panel';

/** 검사 대상 이력(omf-all-around#61 · 서버 선행 P-55). */

const t = messages.inspectionHistory;

const renderPanel = (fetch: StubFetch) =>
  renderWithProviders(<InspectionHistoryPanel inspectionRequestId={5} />, { fetch });

describe('InspectionHistoryPanel', () => {
  it('전달 문서와 시간순 이벤트를 보인다', async () => {
    renderPanel(async (request) => {
      expect(new URL(request.url).pathname).toBe('/quality/inspection-requests/5/history');
      return jsonResponse({
        inspectionRequestId: 5,
        inspectionRequestNo: 'IRQ-5',
        inspectionTypeCode: 'IQC',
        source: { targetTypeCode: 'LOT', targetId: 10, documentNo: 'IR-77', lotNo: 'MLOT-10' },
        events: [
          { occurredAt: '2026-10-16T01:00:00Z', eventTypeCode: 'REQUESTED' },
          {
            occurredAt: '2026-10-16T03:00:00Z',
            eventTypeCode: 'RESULT_CONFIRMED',
            inspectionRound: 1,
            overallJudgmentCode: 'REJECTED',
            acceptedQty: 90,
            rejectedQty: 10,
            heldQty: 0,
            actorName: '검사자 김',
          },
          {
            occurredAt: '2026-10-16T03:00:01Z',
            eventTypeCode: 'LOT_STATUS_CHANGED',
            previousStatusCode: 'INSPECTION_PENDING',
            newStatusCode: 'DEFECTIVE',
            lotNo: 'MLOT-10',
          },
        ],
      });
    });

    expect(await screen.findByText('IR-77')).toBeInTheDocument();
    expect(screen.getByText('MLOT-10')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.events.REQUESTED))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.events.RESULT_CONFIRMED))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(t.quantities(90, 10, 0)))).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(t.lotStatus('MLOT-10', 'INSPECTION_PENDING', 'DEFECTIVE'))),
    ).toBeInTheDocument();
  });

  it('불러오지 못하면 그렇다고 말한다', async () => {
    renderPanel(async () => jsonResponse({ message: '오류' }, { status: 500 }));

    expect(await screen.findByText(t.loadFailed)).toBeInTheDocument();
  });
});
