import type { OqcSerialScan } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { toResultCreateBody } from './queries';
import { SerialJudgments } from './serial-judgments';
import {
  checkScannedSerial,
  requestsToOpen,
  serialBlockedReason,
  toSerialRow,
  type SerialRow,
} from './serials';

/** 시리얼 OQC(omf-all-around#68 · 서버 선행 P-101) — 「검사한 시리얼」 구획. */

const t = messages.oqcInspection.serials;

const scanOf = (overrides: Partial<OqcSerialScan> = {}): OqcSerialScan => ({
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
  ...overrides,
});

const Harness = ({ initial = [] }: { initial?: SerialRow[] }) => {
  const [rows, setRows] = useState<SerialRow[]>(initial);
  return (
    <SerialJudgments
      inspectionRequestId={1}
      itemId={7}
      rows={rows}
      onChange={setRows}
      disabled={false}
    />
  );
};

const renderSection = (scans: Record<string, OqcSerialScan>, initial?: SerialRow[]) => {
  const stubFetch: StubFetch = async (request) => {
    const serialNo = decodeURIComponent(new URL(request.url).pathname.split('/').at(-1) ?? '');
    const scan = scans[serialNo];
    return scan === undefined
      ? jsonResponse({ message: '없는 시리얼' }, { status: 404 })
      : jsonResponse(scan);
  };
  renderWithProviders(<Harness initial={initial} />, { fetch: stubFetch });
};

const scanInto = async (serialNo: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(t.scanLabel), `${serialNo}{Enter}`);
  return user;
};

describe('검사한 시리얼', () => {
  it('스캔하면 OK 로 한 줄이 붙고, NG 로 바꿀 수 있다', async () => {
    renderSection({ 'SN-0011': scanOf() });
    const user = await scanInto('SN-0011');

    expect(await screen.findByText('SN-0011')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.ok })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: t.ng }));
    expect(screen.getByRole('button', { name: t.ng })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(t.count(1, 1))).toBeInTheDocument();
  });

  it('없는 시리얼은 줄을 붙이지 않고 이유를 보인다', async () => {
    renderSection({});
    await scanInto('SN-0099');
    expect(await screen.findByText(t.notFound('SN-0099'))).toBeInTheDocument();
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });

  it('⭐ 1차가 OK 로 남은 시리얼은 NG 를 고를 수 없다 (재검 Q4)', async () => {
    renderSection({
      'SN-0011': scanOf({
        shipmentStep: {
          firstJudgmentCode: 'OK',
          finalJudgmentCode: 'OK',
          inspectedAt: '2026-10-21T03:00:00Z',
        },
      }),
    });
    await scanInto('SN-0011');

    expect(await screen.findByText(t.previous('OK', 'OK'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.ng })).toBeDisabled();
  });
});

describe('시리얼 규칙', () => {
  it('다른 품목 · 이 의뢰가 피킹하지 않은 LOT · 중복을 막는다', () => {
    const target = { inspectionRequestId: 1, itemId: 7, rows: [] as SerialRow[] };
    expect(checkScannedSerial(scanOf({ itemId: 8 }), target)).toBe(t.otherItem('SN-0011'));
    expect(checkScannedSerial(scanOf({ pickedRequests: [] }), target)).toBe(t.notPicked('SN-0011'));
    expect(checkScannedSerial(scanOf(), { ...target, rows: [toSerialRow(scanOf())] })).toBe(
      t.duplicate('SN-0011'),
    );
    expect(checkScannedSerial(scanOf(), target)).toBeNull();
    // 재검(Q4) — 1회차 확정으로 의뢰가 완료여도 그 의뢰가 피킹한 LOT 이면 받는다.
    const completed = scanOf({
      pickedRequests: [
        {
          inspectionRequestId: 1,
          inspectionRequestNo: 'IRQ-1',
          shipmentRequestId: 30,
          statusCode: 'COMPLETED',
        },
      ],
    });
    expect(checkScannedSerial(completed, target)).toBeNull();
  });

  it('시리얼로 여는 의뢰 — 대기·진행이 있으면 그것만, 없으면 완료된 의뢰(재검사)', () => {
    const request = (id: number, statusCode: string) => ({
      inspectionRequestId: id,
      inspectionRequestNo: `IRQ-${String(id)}`,
      shipmentRequestId: 30,
      statusCode,
    });
    expect(requestsToOpen([request(1, 'COMPLETED'), request(2, 'IN_PROGRESS')])).toEqual([
      request(2, 'IN_PROGRESS'),
    ]);
    expect(requestsToOpen([request(1, 'COMPLETED')])).toEqual([request(1, 'COMPLETED')]);
    expect(requestsToOpen([])).toEqual([]);
  });

  it('수량과 모순되면 저장을 막는다 (Q3)', () => {
    const ok = toSerialRow(scanOf());
    const ng: SerialRow = { ...toSerialRow(scanOf({ serialNumberId: 12 })), judgment: 'NG' };
    expect(serialBlockedReason([ok, ng], 1, '1')).toBe(t.tooMany);
    expect(serialBlockedReason([ok, ng], 5, '')).toBe(t.tooManyNg);
    expect(serialBlockedReason([ok, ng], 5, '1')).toBeNull();
  });

  it('저장 몸통 — 시리얼이 있으면 싣고, 없으면 키를 싣지 않는다', () => {
    const base = {
      inspectionRequestId: 1,
      inspectedQty: 5,
      acceptedQty: 5,
      rejectedQty: 0,
      heldQty: 0,
      uomId: 1,
      overallJudgmentCode: 'ACCEPTED',
      inspectedAt: '2026-10-21T03:00:00Z',
      previousResultId: null,
    };
    expect(toResultCreateBody({ ...base, serials: [] })).not.toHaveProperty('serials');
    expect(
      toResultCreateBody({ ...base, serials: [{ serialNumberId: 11, judgmentCode: 'OK' }] })
        .serials,
    ).toEqual([{ serialNumberId: 11, judgmentCode: 'OK' }]);
  });
});
