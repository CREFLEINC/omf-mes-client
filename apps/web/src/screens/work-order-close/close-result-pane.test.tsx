import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkOrderCloseResultPane } from './close-result-pane';
import type { WorkOrderCloseDetailFact } from './queries';

const t = messages.workOrderClose.closeResult;

const closed = (overrides: Partial<WorkOrderCloseDetailFact>): WorkOrderCloseDetailFact =>
  ({
    workOrderId: 701,
    workOrderNo: 'SYN-WO',
    closedAt: '2026-10-22T15:30:00+07:00',
    closeDispositionCode: 'WRITE_OFF',
    closedWorkerNo: '900028',
    closedWorkerName: '합성 작업자',
    completionVarianceReasonCode: 'EQUIPMENT_FAILURE',
    voidedLotCount: 2,
    progress: { goodQty: 4, achievementRate: 0.4, completionJudgmentCode: 'UNDER' },
    ...overrides,
  }) as WorkOrderCloseDetailFact;

const valueOf = (label: string) =>
  within(screen.getByRole('region', { name: t.pane })).getByText(label).nextElementSibling;

describe('WorkOrderCloseResultPane', () => {
  it('마감 일시·마감자·판정·잔량 처리·사유·폐번 LOT 을 한 칸에 하나씩 보인다', () => {
    render(
      <WorkOrderCloseResultPane
        state={{
          kind: 'RESOLVED',
          detail: closed({}),
          reasonLabel: (code) => (code === 'EQUIPMENT_FAILURE' ? '설비 고장' : code),
        }}
      />,
    );

    expect(valueOf(t.fields.closedAt)).toHaveTextContent('2026-10-22 15:30');
    expect(valueOf(t.fields.closedBy)).toHaveTextContent(
      t.values.popWorker('합성 작업자', '900028'),
    );
    expect(valueOf(t.fields.judgment)).toHaveTextContent('미달');
    expect(valueOf(t.fields.disposition)).toHaveTextContent('소멸');
    expect(valueOf(t.fields.reason)).toHaveTextContent('설비 고장');
    expect(valueOf(t.fields.voidedLots)).toHaveTextContent('2건');
  });

  it('관리웹 마감·정상 마감은 없는 값을 지어내지 않는다', () => {
    render(
      <WorkOrderCloseResultPane
        state={{
          kind: 'RESOLVED',
          detail: closed({
            closedWorkerNo: null,
            closedWorkerName: null,
            closeDispositionCode: null,
            completionVarianceReasonCode: null,
            voidedLotCount: null,
          }),
          reasonLabel: (code) => code,
        }}
      />,
    );

    expect(valueOf(t.fields.closedBy)).toHaveTextContent(t.values.unknown);
    expect(valueOf(t.fields.disposition)).toHaveTextContent(t.values.none);
    expect(valueOf(t.fields.reason)).toHaveTextContent(t.values.none);
    expect(valueOf(t.fields.voidedLots)).toHaveTextContent(t.values.unknown);
  });
});
