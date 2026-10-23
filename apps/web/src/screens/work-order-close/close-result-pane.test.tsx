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
    closedByUserName: null,
    closeJudgmentCode: 'UNDER',
    /* 마감 뒤 지연 실적으로 지금 판정은 정상이 됐다 — 마감 결과는 마감 시점 판정을 보인다. */
    progress: { goodQty: 10, achievementRate: 1, completionJudgmentCode: 'NORMAL' },
    ...overrides,
  }) as WorkOrderCloseDetailFact;

const valueOf = (label: string) =>
  within(screen.getByRole('region', { name: t.pane })).getByText(label).nextElementSibling;

describe('WorkOrderCloseResultPane', () => {
  it('마감 일시, 마감자, 사번, 마감 경로, 판정, 잔량 처리, 사유, 폐번 LOT 을 한 칸에 하나씩 보인다', () => {
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
    expect(valueOf(t.fields.closedBy)).toHaveTextContent('합성 작업자');
    expect(valueOf(t.fields.closedByNo)).toHaveTextContent('900028');
    expect(valueOf(t.fields.closedVia)).toHaveTextContent(t.values.pop);
    expect(valueOf(t.fields.judgment)).toHaveTextContent('미달');
    expect(valueOf(t.fields.disposition)).toHaveTextContent('소멸');
    expect(valueOf(t.fields.reason)).toHaveTextContent('설비 고장');
    expect(valueOf(t.fields.voidedLots)).toHaveTextContent('2건');
  });

  it('관리웹 마감은 계정 이름을 마감자로 보인다', () => {
    render(
      <WorkOrderCloseResultPane
        state={{
          kind: 'RESOLVED',
          detail: closed({
            closedWorkerNo: null,
            closedWorkerName: null,
            closedByUserName: '합성 관리자',
          }),
          reasonLabel: (code) => code,
        }}
      />,
    );

    expect(valueOf(t.fields.closedBy)).toHaveTextContent('합성 관리자');
    expect(valueOf(t.fields.closedByNo)).toHaveTextContent(t.values.none);
    expect(valueOf(t.fields.closedVia)).toHaveTextContent(t.values.web);
  });

  it('마감자, 처분, 사유, 폐번 건수가 없으면 지어내지 않는다', () => {
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
            closeJudgmentCode: null,
          }),
          reasonLabel: (code) => code,
        }}
      />,
    );

    expect(valueOf(t.fields.closedBy)).toHaveTextContent(t.values.unknown);
    expect(valueOf(t.fields.closedVia)).toHaveTextContent(t.values.unknown);
    expect(valueOf(t.fields.disposition)).toHaveTextContent(t.values.none);
    expect(valueOf(t.fields.reason)).toHaveTextContent(t.values.none);
    expect(valueOf(t.fields.voidedLots)).toHaveTextContent(t.values.unknown);
  });
});
