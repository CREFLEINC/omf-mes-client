import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it, vi } from 'vitest';

import { EXPORT_CAP, TraceExportButton, exportFileName, exportPlan } from './export';
import type { ListEntry } from './lot-list-state';
import type { TraceLotRow } from './types';

const t = messages.traceTree;

const row = (lotId: number): TraceLotRow => ({
  lot: {
    lotId,
    lotNo: `LOT-${String(lotId)}`,
    lotTypeCode: 'PRODUCTION',
    statusCode: 'NORMAL',
    lifecycleStatusCode: 'ACTIVE',
  },
  item: { itemId: 1, code: 'ITEM-A', name: '품목 A' },
  qty: 1,
  uomCode: 'EA',
  partner: null,
  inboundLotNo: null,
  sortDate: null,
  sortDateKind: null,
});

const entry = (lotId: number, serialNo: string | null = null): ListEntry => ({
  row: row(lotId),
  source: null,
  serialNo,
});

describe('엑셀 내보내기 대상(US4)', () => {
  it('US4-1 지금 목록의 LOT 을 목록 순서대로, 시리얼로 들어온 줄은 시리얼과 함께 보낸다', () => {
    expect(exportPlan('BACKWARD', [entry(3), entry(1, 'SN-1'), entry(2)])).toEqual({
      lotIds: [3, 1, 2],
      serialNos: { '1': 'SN-1' },
    });
  });

  it('US4-1 정방향은 시리얼을 보내지 않는다', () => {
    expect(exportPlan('FORWARD', [entry(3, 'SN-3')])).toEqual({ lotIds: [3], serialNos: {} });
  });

  it('파일 이름은 응답 머리(Content-Disposition)를 따른다', () => {
    expect(
      exportFileName('attachment; filename="material-trace-20261124-1530.xlsx"', 'FORWARD'),
    ).toBe('material-trace-20261124-1530.xlsx');
    expect(exportFileName(null, 'BACKWARD')).toBe('product-trace.xlsx');
  });
});

const setup = (
  props: Partial<Parameters<typeof TraceExportButton>[0]> = {},
  run = vi.fn(() => Promise.resolve()),
) => {
  render(
    <TraceExportButton
      direction="FORWARD"
      entries={[entry(1), entry(2)]}
      total={null}
      run={run}
      {...props}
    />,
  );
  return run;
};

describe('엑셀 내보내기 단추', () => {
  it('US4-1 누르면 지금 목록의 LOT 으로 바로 받는다', async () => {
    const run = setup();
    await userEvent.click(screen.getByRole('button', { name: t.export }));
    expect(run).toHaveBeenCalledWith({ lotIds: [1, 2], serialNos: {} });
  });

  it('US4-2 조건 결과를 다 불러오지 않았으면 「지금 목록에 보이는 n개」 확인 뒤 받는다', async () => {
    const run = setup({ total: 150 });
    await userEvent.click(screen.getByRole('button', { name: t.export }));
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent(t.exporting.body(2));
    expect(screen.getByRole('dialog')).toHaveTextContent(t.exporting.partial(2, 150));
    await userEvent.click(screen.getByRole('button', { name: t.exporting.confirm }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it(`US4-3 ${String(EXPORT_CAP)}개를 넘으면 단추가 막히고 사유를 보인다`, () => {
    setup({ entries: Array.from({ length: EXPORT_CAP + 1 }, (_, index) => entry(index + 1)) });
    const button = screen.getByRole('button', { name: t.export });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.exporting.tooMany(EXPORT_CAP));
  });

  it('US4-3 서버가 422 로 거절하면 「LOT 이 너무 많습니다 — 조건을 좁히세요」', async () => {
    const run = vi.fn(() => Promise.reject(new Error('too large')));
    setup({ isTooLarge: () => true }, run);
    await userEvent.click(screen.getByRole('button', { name: t.export }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(t.exporting.tooLargeTitle);
  });

  it('받는 동안 단추는 불러오는 중이다', async () => {
    let finish: () => void = () => undefined;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    setup({}, run);
    await userEvent.click(screen.getByRole('button', { name: t.export }));
    expect(screen.getByRole('button', { name: t.export })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: t.export })).toBeEnabled());
  });

  it('목록이 비면 단추를 막는다', () => {
    setup({ entries: [] });
    expect(screen.getByRole('button', { name: t.export })).toBeDisabled();
  });
});
