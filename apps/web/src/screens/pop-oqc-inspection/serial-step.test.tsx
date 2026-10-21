import type { OqcSerialScan } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import type { SerialRow } from '../oqc-inspection/serials';
import { PopSerialStep } from './serial-step';

/** P-04-06 검사한 시리얼(omf-all-around#68) — 스캐너로 찍고 OK/NG 를 누른다. */

const t = messages.oqcInspection.serials;

const scan: OqcSerialScan = {
  serialNumberId: 11,
  serialNo: 'SN-0011',
  itemId: 7,
  itemCode: 'AAR4',
  itemName: '오토 리와인더',
  lotId: 50,
  lotNo: 'L-50',
  pickedRequests: [
    {
      inspectionRequestId: 1,
      inspectionRequestNo: 'IRQ-1',
      shipmentRequestId: 30,
      statusCode: 'IN_PROGRESS',
    },
  ],
};

const Harness = ({ onSubmit }: { onSubmit: () => void }) => {
  const [rows, setRows] = useState<SerialRow[]>([]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <PopSerialStep
        inspectionRequestId={1}
        itemId={7}
        rows={rows}
        onChange={setRows}
        disabled={false}
      />
    </form>
  );
};

describe('POP 검사한 시리얼', () => {
  it('스캔(Enter)하면 한 줄이 붙고 판정 폼은 제출되지 않는다 — NG 로 바꿀 수 있다', async () => {
    const stubFetch: StubFetch = async (request) =>
      new URL(request.url).pathname === '/quality/oqc-serials/SN-0011'
        ? jsonResponse(scan)
        : jsonResponse({ message: '없음' }, { status: 404 });
    const onSubmit = vi.fn();
    renderWithProviders(<Harness onSubmit={onSubmit} />, { fetch: stubFetch });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.scanLabel), 'SN-0011{Enter}');

    expect(await screen.findByText('SN-0011')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: t.ng }));
    expect(screen.getByRole('button', { name: t.ng })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(t.count(1, 1))).toBeInTheDocument();
  });
});
