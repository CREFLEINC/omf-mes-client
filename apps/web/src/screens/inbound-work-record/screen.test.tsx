import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { FINAL, IQC_PENDING, READY, RECEIVING, ROUTE, workRecordStub } from './fixtures';
import { InboundWorkRecordScreen } from './screen';

const t = messages.inboundWorkRecord;

const setup = (route = ROUTE) => {
  const stub = workRecordStub();
  renderWithProviders(<InboundWorkRecordScreen />, { fetch: stub.fetch, route });
  return { ...stub, user: userEvent.setup() };
};

const listTable = () => screen.findByRole('table', { name: t.list.label });
const rowOf = async (inboundLotNo: string) => {
  const table = await listTable();
  const cell = await within(table).findByRole('button', { name: t.list.open(inboundLotNo) });
  return cell.closest('tr') as HTMLElement;
};
const drawer = (inboundLotNo: string) => screen.findByRole('dialog', { name: inboundLotNo });

describe('W-01-16 입하/입고 작업 기록 — 목록', () => {
  it('US8-1 보기 탭 셋에 수가 서고, 마감 승인 대기 행에 P/O 매칭 요약 · 초과 · P/O 없음 강조 · 자동 마감 · 입하/입고 수량이 선다', async () => {
    setup();

    const row = await rowOf(READY.inboundLotNo);
    expect(screen.getByRole('tab', { name: new RegExp(`${t.views.ready}\\s*1`) })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: new RegExp(`${t.views.prog}\\s*2`) })).toBeVisible();
    expect(screen.getByRole('tab', { name: new RegExp(`${t.views.final}\\s*1`) })).toBeVisible();
    expect(screen.getByText(t.views.readyHint)).toBeVisible();

    expect(within(row).getByText('0031/10: 300')).toBeVisible();
    const excess = within(row).getByText('0012/10: 1,575 (초과 75)');
    expect(excess.tagName).toBe('MARK');
    const unallocated = within(row).getByText('P/O 없음: 175');
    expect(unallocated.tagName).toBe('MARK');
    expect(within(row).getByText(t.list.readyChip)).toBeVisible();
    expect(within(row).getByText(t.list.autoClosed)).toBeVisible();
    expect(within(row).getAllByText('2,050')).toHaveLength(2);
    expect(screen.getByRole('columnheader', { name: t.list.columns.status })).toBeVisible();
  });

  it('US8-1 새 흐름(ON_FINALIZE) 입하 LOT 만 묻는다 — 이전 데이터는 나오지 않는다', async () => {
    const { recorded } = setup();

    await rowOf(READY.inboundLotNo);
    const lists = recorded.filter((call) => call.url.pathname === '/logistics/inbound-lots');
    expect(lists.length).toBeGreaterThanOrEqual(3);
    for (const call of lists) {
      expect(call.url.searchParams.get('erpSendModeCode')).toBe('ON_FINALIZE');
      expect(call.url.searchParams.get('plantId')).toBe('8401');
      expect(call.url.searchParams.get('receivingDateFrom')).toBe('2026-11-01');
      expect(call.url.searchParams.get('receivingDateTo')).toBe('2026-11-12');
    }
  });

  it('US8-2 마감 승인 대기는 finalizable 로만 묻고, IQC 가 남은 입하 LOT 은 진행 중에 이유와 함께 선다', async () => {
    const { recorded, user } = setup();

    await rowOf(READY.inboundLotNo);
    const ready = await listTable();
    expect(within(ready).queryByText(IQC_PENDING.inboundLotNo)).toBeNull();
    const readyCall = recorded.find(
      (call) =>
        call.url.pathname === '/logistics/inbound-lots' &&
        call.url.searchParams.get('finalizable') === 'true',
    );
    expect(readyCall).toBeDefined();

    await user.click(screen.getByRole('tab', { name: new RegExp(t.views.prog) }));

    const row = await rowOf(IQC_PENDING.inboundLotNo);
    expect(within(row).getByText(t.blockers.IQC_IN_PROGRESS(2))).toBeVisible();
    const receiving = await rowOf(RECEIVING.inboundLotNo);
    expect(within(receiving).getByText(t.list.receiving)).toBeVisible();
    expect(within(receiving).getByText(t.list.autoMatchLater)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: t.list.columns.reason })).toBeVisible();
    expect(screen.getByText(t.views.progHint)).toBeVisible();
  });

  it('US8-1 보기에 입하 LOT 이 없으면 빈 상태 문구', async () => {
    const stub = workRecordStub({ rows: [IQC_PENDING] });
    renderWithProviders(<InboundWorkRecordScreen />, { fetch: stub.fetch, route: ROUTE });

    expect(await screen.findByText(t.list.empty(t.views.ready))).toBeVisible();
  });
});

describe('W-01-16 입하/입고 작업 기록 — 상세', () => {
  it('US8-1 상세에 P/O 라인 발주량 · 이전 받은 양 · 이번 매칭 · 허용치 · 남은 한도, P/O 없음, 자재 관리 LOT 가 선다', async () => {
    const { user } = setup();

    await user.click(within(await rowOf(READY.inboundLotNo)).getByRole('button'));

    const dialog = await drawer(READY.inboundLotNo);
    const match = await within(dialog).findByRole('table', { name: t.detail.matchLabel });
    for (const name of Object.values(t.detail.matchColumns))
      expect(within(match).getByRole('columnheader', { name })).toBeVisible();
    const over = within(match).getByText('PO-SYN-0012 · 10').closest('tr') as HTMLElement;
    expect(within(over).getByText('1,500')).toBeVisible();
    expect(within(over).getByText('0')).toBeVisible();
    expect(within(over).getByText(t.detail.excessChip('75'))).toBeVisible();
    expect(within(over).getByText('+100')).toBeVisible();
    expect(within(over).getByText('25')).toBeVisible();
    const late = within(match).getByText('PO-SYN-0077 · 10').closest('tr') as HTMLElement;
    expect(within(late).getByText(t.detail.openedAfterClose)).toBeVisible();
    expect(within(match).getByText('175')).toBeVisible();
    expect(within(match).getByText(t.detail.total('2,050', '2,050', 'EA'))).toBeVisible();

    const lots = within(dialog).getByRole('table', { name: t.detail.lotsLabel });
    expect(within(lots).getAllByText(t.detail.lotStatus.received)).toHaveLength(3);
    expect(within(dialog).getByRole('button', { name: t.detail.editMatch })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: t.detail.finalize })).toBeEnabled();
  });

  it('US8-2 진행 중 상세는 finalizeBlockers 문구로 최종 마감할 수 없는 이유를 말하고 [최종 마감]이 없다', async () => {
    const { user } = setup(`${ROUTE}&view=prog&open=${String(IQC_PENDING.inboundLotId)}`);

    const dialog = await drawer(IQC_PENDING.inboundLotNo);
    expect(
      await within(dialog).findByText(t.detail.blocked(t.blockers.IQC_IN_PROGRESS(2))),
    ).toBeVisible();
    expect(within(dialog).getAllByText(t.detail.lotStatus.iqcInProgress)).toHaveLength(2);
    expect(within(dialog).queryByRole('button', { name: t.detail.finalize })).toBeNull();
    /* 입하 완료면 「마감 승인 대기」가 아니어도 매칭을 고칠 수 있다(plan 확인할 것 11). */
    expect(await within(dialog).findByRole('button', { name: t.detail.editMatch })).toBeVisible();
    const closes = within(dialog).getAllByRole('button', { name: t.detail.close });
    await user.click(closes[closes.length - 1] as HTMLElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('US8-2 입하 중 상세는 매칭 표 대신 「아직 입하 중」 안내', async () => {
    setup(`${ROUTE}&view=prog&open=${String(RECEIVING.inboundLotId)}`);

    const dialog = await drawer(RECEIVING.inboundLotNo);
    expect(await within(dialog).findByText(t.detail.noMatchYet)).toBeVisible();
    expect(within(dialog).queryByRole('button', { name: t.detail.editMatch })).toBeNull();
    expect(within(dialog).getAllByText(t.detail.lotStatus.received).length).toBeGreaterThan(0);
  });

  it('US8-4 최종 마감 보기 · 상세는 읽기 전용 — 시각 · 사람과 불변 안내, [매칭 수정] · [최종 마감] 없음', async () => {
    const { user } = setup(`${ROUTE}&view=final`);

    const row = await rowOf(FINAL.inboundLotNo);
    expect(screen.getByRole('columnheader', { name: t.list.columns.finalized })).toBeVisible();
    expect(within(row).getByText('11-11 09:20')).toBeVisible();

    await user.click(within(row).getByRole('button'));
    const dialog = await drawer(FINAL.inboundLotNo);
    expect(
      await within(dialog).findByText(t.detail.finalized('11-11 09:20', '합성 관리자 나')),
    ).toBeVisible();
    await within(dialog).findByRole('table', { name: t.detail.matchLabel });
    expect(within(dialog).queryByRole('button', { name: t.detail.editMatch })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: t.detail.finalize })).toBeNull();
  });

  it('US8-4 「ERP 송신 상태」 칸 · [ERP 반영] 단추가 없다(#265)', async () => {
    const { user } = setup(`${ROUTE}&view=final`);

    await user.click(within(await rowOf(FINAL.inboundLotNo)).getByRole('button'));
    const dialog = await drawer(FINAL.inboundLotNo);
    await within(dialog).findByRole('table', { name: t.detail.matchLabel });

    expect(screen.queryByText(/ERP 송신/)).toBeNull();
    expect(screen.queryByText(/ERP 반영/)).toBeNull();
    expect(screen.queryByText(/반영 대기/)).toBeNull();
    expect(screen.queryByRole('button', { name: /ERP/ })).toBeNull();
  });
});
