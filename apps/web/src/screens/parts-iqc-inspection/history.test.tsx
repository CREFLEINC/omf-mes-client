import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { InspectionHistory } from './history';

const tm = messages.iqcInspection.measurements;
const SPEC = {
  inspectionItemSpecId: 1,
  inspectionPlanVersionId: 1,
  sequenceNo: 1,
  inspectionItemCode: 'LEN',
  inspectionItemName: '길이',
  dataTypeCode: 'NUMERIC',
  uomId: 4,
  targetValue: 10,
  lowerLimit: 9.8,
  upperLimit: 10.1,
  measurementCount: 2,
  requiredFlag: true,
  automaticJudgment: true,
};
const m = (sampleNo: number, numericValue: number, judgmentCode: string) => ({
  inspectionMeasurementId: sampleNo,
  inspectionItemSpecId: 1,
  sampleNo,
  numericValue,
  judgmentCode,
  measuredAt: '2026-11-04T00:00:00Z',
});
const ROUND = {
  inspectionResultId: 9,
  inspectionRound: 1,
  inspectedAt: '2026-11-04T00:00:00Z',
  inspectedQty: 100,
  acceptedQty: 100,
  rejectedQty: 0,
  heldQty: 0,
  overallJudgmentCode: 'REJECTED',
  statusCode: 'CONFIRMED',
};
const page = (items: object[]) =>
  jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });

describe('검사 이력 펼친 영역', () => {
  it('항목 · 규격 · 회차별 값 · 판정을 표로 보이고, 불합격 회차 칸을 표시한다', async () => {
    renderWithProviders(
      <InspectionHistory
        inspectionRequestId={7}
        specs={[SPEC]}
        defectCodes={[{ defectCodeId: 3, defectName: '스크래치' }]}
      />,
      {
        fetch: createStubFetch([
          {
            match: (r) => new URL(r.url).pathname.endsWith('/measurements'),
            respond: () => page([m(1, 10, 'ACCEPTED'), m(2, 10.3, 'REJECTED')]),
          },
          {
            match: (r) => new URL(r.url).pathname === '/quality/defect-records',
            respond: () =>
              page([
                {
                  defectRecordId: 1,
                  defectCodeId: 3,
                  defectQty: 3,
                  defectDescription: '표면 긁힘',
                },
              ]),
          },
          {
            match: (r) => new URL(r.url).pathname === '/mdm/uoms',
            respond: () => page([{ uomId: 4, uomCode: 'M' }]),
          },
          {
            match: (r) => new URL(r.url).pathname === '/quality/inspection-results',
            respond: () => page([ROUND]),
          },
        ]),
      },
    );

    await userEvent.click(await screen.findByText(messages.partsIqcInspection.history.roundNo(1)));

    const table = await screen.findByRole('cell', { name: '길이' }).then((c) => c.closest('table'));
    const grid = within(table as HTMLElement);
    expect(grid.getByText('10 +0.1/-0.2 M')).toBeInTheDocument();
    expect(grid.getByText('9.8 ~ 10.1')).toBeInTheDocument();
    expect(grid.getByText('10.3')).toHaveClass('parts-iqc-history-cell-ng');
    expect(grid.getByText(tm.judgmentNames.REJECTED ?? '불합격')).toBeInTheDocument();

    const defect = within(
      screen.getByRole('cell', { name: '스크래치' }).closest('tr') as HTMLElement,
    );
    expect(defect.getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(defect.getByRole('cell', { name: '표면 긁힘' })).toBeInTheDocument();
  });
});
