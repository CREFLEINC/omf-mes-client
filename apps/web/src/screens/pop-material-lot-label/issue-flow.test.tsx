import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ISSUE_UNIT_STORAGE_KEY } from './issue-unit';
import { PRINTER_STORAGE_KEY } from './printer-choice';
import {
  HARNESS_NOW,
  WORKER_NO,
  group,
  lot,
  renderLabelScreen,
  sentTo,
  type HarnessOptions,
  type Sent,
} from './screen-harness';

/**
 * 라벨 인쇄 — **한 장마다 네 걸음(발행 기록 → 라벨 짜기 → 인쇄 → 결과 보고)을 차례로**(개편안 승인 2026-10-24 ·
 * omf-all-around#184). 005 부터 옛 첫 걸음 「LOT 등록」은 없다 — LOT 은 「자재 관리 LOT 만들기」가 이미 만들었다.
 *
 * 여기서 무는 것은 「무엇을 어떤 차례로 보내는가」와 「어디서 멈췄을 때 무엇을 말하고 무엇을 다시 보내는가」다.
 * 본문 조립은 `patterns/material-lot-label-print.test.ts`, 라벨 배치는 `patterns/label/lot-label-tspl.test.ts` 가 따로 문다.
 */

const t = messages.popMaterialLotLabel;
const tp = t.precreate;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HARNESS_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  delete window.pop;
  try {
    window.localStorage.removeItem(PRINTER_STORAGE_KEY);
    window.localStorage.removeItem(ISSUE_UNIT_STORAGE_KEY);
  } catch {
    /* 저장소가 없는 시험 환경 — 지울 것도 없다. */
  }
});

type SaveFn = (...args: unknown[]) => Promise<string>;

/** 셸 인쇄 통로를 심는다 — 설치본처럼. 없으면 브라우저와 같다. */
const installShell = (save: SaveFn = vi.fn(async () => 'C:/syn/label.prn')) => {
  window.pop = { rendition: { save } } as unknown as typeof window.pop;

  return save;
};

/** 대기 LOT 만 n 개(미출력) — 품목 가 · 공급사 가. */
const waitingOnly = (count: number, over: Partial<Parameters<typeof group>[1]> = {}) =>
  ({
    groups: [
      group(
        Array.from({ length: count }, (_, index) => lot(9001 + index)),
        over,
      ),
    ],
  }) satisfies HarnessOptions;

const rows = (): HTMLElement[] => screen.queryAllByRole('checkbox', { name: /SYN-ITEM-01\|/u });

/** 왼쪽 첫 공급사·품목을 고른다(피처 014 — 화면을 열기만 해서는 고르지 않는다). */
const pickFirst = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const list = await screen.findByRole('list', { name: tp.listTitle });
  await user.click(within(list).getAllByRole('button')[0] as HTMLElement);
};

/** 이 쪽의 줄을 모두 고른다 — 「입하 대기 전체 선택」은 없앴다(피처 014 시안 확인 거리 2). */
const checkVisible = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  for (const row of rows()) {
    if (row.getAttribute('aria-checked') !== 'true') await user.click(row);
  }
};

/** 고르고 · 대기를 모두 고르고 [라벨 N장 발행] → 미리 보기 [N장 인쇄]. */
const issueAll = async (user: ReturnType<typeof userEvent.setup>, count: number): Promise<void> => {
  await pickFirst(user);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  await checkVisible(user);
  await user.click(screen.getByRole('button', { name: t.bar.issue(count) }));
  const dialog = await screen.findByRole('dialog', { name: t.preview.title });
  await user.click(within(dialog).getByRole('button', { name: t.preview.print(count) }));
};

const posts = (sent: readonly Sent[]): string[] =>
  sent
    .filter((entry) => entry.method === 'POST')
    .map((entry) => entry.path.replace(/\d+:report-print$/u, 'REPORT'));

const docTypes = (sent: readonly Sent[]): string[] =>
  sentTo(sent, '/app/document-issues').map(
    (entry) => (entry.body as { documentTypeCode: string }).documentTypeCode,
  );

describe('US1-4 라벨 발행 — 차례로 보낸다', () => {
  it('US1-4 미리 보기를 거쳐 고른 LOT 을 한 장씩 네 걸음 보내고, 쓰기마다 사번과 멱등 키를 싣는다 — LOT 등록은 부르지 않는다', async () => {
    const user = userEvent.setup();
    const save = installShell();
    const { sent } = renderLabelScreen(waitingOnly(3));

    await issueAll(user, 3);

    await waitFor(() => expect(screen.getAllByText(t.bar.done(3)).length).toBeGreaterThan(0));
    expect(posts(sent)).toEqual([
      '/app/document-issues',
      '/app/document-issues/REPORT',
      '/app/document-issues',
      '/app/document-issues/REPORT',
      '/app/document-issues',
      '/app/document-issues/REPORT',
    ]);
    expect(
      sentTo(sent, '/app/document-issues').map(
        (entry) => (entry.body as { targets: { lotId: number }[] }).targets[0]?.lotId,
      ),
    ).toEqual([9001, 9002, 9003]);
    expect(save).toHaveBeenCalledTimes(3);

    for (const entry of sent.filter((each) => each.method === 'POST')) {
      expect(entry.headers.get('X-Worker-No')).toBe(WORKER_NO);
      expect(entry.headers.get('Idempotency-Key')).not.toBeNull();
    }
  });

  it('US1-4 미리 보기 — QR 에는 자재 관리 LOT 번호만, 라벨에 품목 · 수량 · 패키징 · 공급사가 보인다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(waitingOnly(1));

    await pickFirst(user);
    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(rows()[0] as HTMLElement);
    await user.click(screen.getByRole('button', { name: t.bar.issue(1) }));

    const dialog = await screen.findByRole('dialog', { name: t.preview.title });
    const label = within(dialog).getByRole('figure');
    expect(label).toHaveTextContent('SYN-ITEM-01|1000|261111|SYN-P-01|0001');
    expect(label).toHaveTextContent('1,000 EA');
    expect(label).toHaveTextContent('봉지 10 × 100');
    expect(label).toHaveTextContent('합성 공급사 가 (SYN-P-01)');
    expect(within(dialog).getByRole('button', { name: t.preview.print(1) })).toBeInTheDocument();
  });

  it('US1-4 셸에 80 × 30 TSPL 라벨을 넘기고 QR 에는 LOT 번호만, 수량 줄 옆에 패키징을 싣는다', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (..._args: unknown[]) => 'C:/syn/label.tspl');
    installShell(save);
    renderLabelScreen(waitingOnly(1));

    await issueAll(user, 1);

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [bytes, , , format] = save.mock.calls[0] ?? [];
    const commands = new TextDecoder('latin1').decode(bytes as Uint8Array);

    expect(format).toBe('tspl');
    expect(commands.startsWith('SIZE 80 mm,30 mm')).toBe(true);
    expect(commands).toContain('QRCODE');
    expect(commands).toContain('"SYN-ITEM-01|1000|261111|SYN-P-01|0001"\r\n');
    expect(commands).toContain('"SYN-ITEM-01"');
    expect(commands).toContain('"1,000 EA"');
    expect(commands).toContain('PRINT 1,1');
  });

  it('다 나오면 LOT 마다 「인쇄됨」을 남기고, 「확인」을 누르면 미출력에서 빠져 출력됨(입하 전) 탭에 회차로 선다', async () => {
    const user = userEvent.setup();
    installShell();
    renderLabelScreen(waitingOnly(2));

    await issueAll(user, 2);

    await waitFor(() => expect(screen.getAllByText(t.bar.done(2)).length).toBeGreaterThan(0));
    expect(screen.getAllByText(t.status.printed)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: t.bar.confirm }));

    /* 찍은 LOT 은 미출력에 남지 않는다 — 출력됨(입하 전) 탭에 선다(FR-014). */
    await waitFor(() => expect(rows()).toHaveLength(0));
    expect(screen.getByText(tp.notes.NO_OPEN_PO)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: tp.tabs.PRINTED }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    const printedTable = screen.getByRole('group', { name: tp.tabs.PRINTED });
    expect(within(printedTable).getAllByText(t.table.issuedSeq(1))).toHaveLength(2);
  });

  it('⛔ 보내기 직전에 보니 다른 단말이 먼저 찍은 LOT 은 보내지 않고 「이미 발행됨」으로 둔다', async () => {
    const user = userEvent.setup();
    installShell();
    const { findLot, sent } = renderLabelScreen(waitingOnly(2));

    await pickFirst(user);
    await waitFor(() => expect(rows()).toHaveLength(2));
    await checkVisible(user);
    /* 다른 단말이 그사이 9002 를 찍었다. */
    const other = findLot(9002);
    if (other !== undefined)
      other.lastLabelIssue = { issueSeq: 1, issuedAt: '2026-11-11T04:00:00Z' };
    await user.click(screen.getByRole('button', { name: t.bar.issue(2) }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: t.preview.print(2) }),
    );

    await waitFor(() => expect(screen.getByText(t.status.alreadyIssued)).toBeInTheDocument());
    expect(sentTo(sent, '/app/document-issues')).toHaveLength(1);
  });
});

describe('라벨 발행 — 멈추는 자리', () => {
  it('프린터가 응답하지 않으면 그 장에서 멈추고 남은 장은 「멈춤」으로 남긴다', async () => {
    const user = userEvent.setup();
    installShell(vi.fn(async () => Promise.reject(new Error('프린터 응답 없음'))));
    const { sent } = renderLabelScreen(waitingOnly(3));

    await issueAll(user, 3);

    await waitFor(() => expect(screen.getByText(t.bar.failed(3))).toBeInTheDocument());
    expect(screen.getByText(t.bar.next.printFailed)).toBeInTheDocument();
    expect(screen.getAllByText(t.status.stopped)).toHaveLength(2);
    expect(sentTo(sent, '/app/document-issues')).toHaveLength(1);
  });

  it('셸 인쇄 통로가 없는 단말(브라우저)에서는 첫 장에서 멈춘다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(waitingOnly(2));

    await issueAll(user, 2);

    await waitFor(() => expect(screen.getByText(t.status.failed.printFailed)).toBeInTheDocument());
  });

  it('다시 발행 — 인쇄만 실패한 장은 같은 LOT 에 「인쇄 실패」 사유로, 멈춘 장은 사유 없이 첫 발행으로 보낸다', async () => {
    const user = userEvent.setup();
    const save = vi
      .fn<SaveFn>()
      .mockRejectedValueOnce(new Error('용지 없음'))
      .mockResolvedValue('C:/syn/label.prn');
    installShell(save);
    const { sent } = renderLabelScreen(waitingOnly(2));

    await issueAll(user, 2);
    await waitFor(() => expect(screen.getByText(t.bar.retry(2))).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: t.bar.retry(2) }));

    await waitFor(() => expect(screen.getAllByText(t.bar.done(2)).length).toBeGreaterThan(0));
    const issues = sentTo(sent, '/app/document-issues').map((entry) => entry.body);
    expect(issues).toEqual([
      expect.objectContaining({ targets: [expect.objectContaining({ lotId: 9001 })] }),
      expect.objectContaining({
        targets: [expect.objectContaining({ lotId: 9001 })],
        reissueReasonCode: 'PRINT_FAILURE',
      }),
      expect.not.objectContaining({ reissueReasonCode: expect.anything() }),
    ]);
  });

  it('사유 목록에 「인쇄 실패」가 없으면 인쇄만 실패한 장은 여기서 다시 보내지 않고 다시 인쇄로 넘긴다', async () => {
    const user = userEvent.setup();
    installShell(vi.fn(async () => Promise.reject(new Error('용지 없음'))));
    renderLabelScreen({
      ...waitingOnly(1),
      reissueReasons: [{ code: 'DAMAGED', codeName: '훼손' }],
    });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.bar.next.needsReason)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: t.bar.retry(1) })).toBeNull();
  });

  it('발행이 403 이면 「이 단말은 발행 불가」로 멈추고 다시 발행을 권하지 않는다', async () => {
    const user = userEvent.setup();
    installShell();
    renderLabelScreen({ ...waitingOnly(1), issueFail: { status: 403 } });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.bar.next.issueForbidden)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /다시 발행/u })).toBeNull();
  });

  it('인쇄 뒤 결과 보고만 실패하면 종이는 나온 것으로 말하고 다시 찍게 하지 않는다', async () => {
    const user = userEvent.setup();
    installShell();
    renderLabelScreen({ ...waitingOnly(1), reportFails: true });

    await issueAll(user, 1);

    await waitFor(() =>
      expect(screen.getByText(t.bar.next.reportFailedAfterPrint)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: t.bar.retry(1) })).toBeNull();
  });

  it('보내는 동안에는 공급사·품목 · 줄 · 보기를 바꾸지 못하고 진행과 「멈춤」이 보인다', async () => {
    const user = userEvent.setup();
    installShell();
    renderLabelScreen({ ...waitingOnly(2), issueHangs: true });

    await issueAll(user, 2);

    expect(await screen.findByRole('button', { name: t.bar.stop })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: tp.tabs.PRINTED })).toBeDisabled();
  });
});

describe('라벨 발행 — N장마다 멈추고 이어서', () => {
  it('10장을 찍고 멈춘다 — 「다음 2장 발행」으로 남은 장을 이어 찍는다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen(waitingOnly(12));

    /* 표는 구획 높이만큼 한 쪽(서버 쪽)이고 나머지는 다음 쪽 — 쪽을 넘겨도 고른 줄은 남는다. */
    await pickFirst(user);
    await waitFor(() =>
      expect(screen.getByText(messages.popUniform.pager.total(12))).toBeInTheDocument(),
    );
    /* 발행 단위는 고르기 칸(사용자 지시 2026-11-23). */
    await user.click(screen.getByRole('combobox', { name: t.bar.unit.label }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('option', { name: t.bar.unit.each(10) }),
    );
    for (let pageNo = 1; pageNo <= 3; pageNo += 1) {
      await waitFor(() => expect(rows()[0]).toBeDefined());
      await checkVisible(user);
      if (pageNo < 3) {
        const before = rows()[0]?.getAttribute('aria-label');
        await user.click(screen.getByRole('button', { name: messages.popUniform.pager.next }));
        await waitFor(() => expect(rows()[0]?.getAttribute('aria-label')).not.toBe(before));
      }
    }
    /* 단위보다 많이 골랐다 — 단추와 안내 줄이 10장마다 멈춘다고 말한다. */
    expect(screen.getByText(t.bar.unitNote(10))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.bar.issueEach(12, 10) }));
    const dialog = await screen.findByRole('dialog', { name: t.preview.title });
    await user.click(within(dialog).getByRole('button', { name: t.preview.print(12) }));

    await waitFor(() => expect(screen.getByText(t.bar.paused(10, 12))).toBeInTheDocument());
    expect(sentTo(sent, '/app/document-issues')).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: t.bar.resume(2) }));
    await waitFor(() => expect(screen.getAllByText(t.bar.done(12)).length).toBeGreaterThan(0));
    expect(window.localStorage.getItem(ISSUE_UNIT_STORAGE_KEY)).toBe('10');
  });
});

describe('라벨 발행 — IQC 대상 품목', () => {
  it('⛔ IQC 대상이어도 자재 관리 LOT 라벨 한 장만 찍는다 — IQC 라벨은 찍지 않는다(omf-all-around#335)', async () => {
    const user = userEvent.setup();
    const save = installShell();
    const { sent } = renderLabelScreen(waitingOnly(1, { inspectionRequired: true }));

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getAllByText(t.bar.done(1)).length).toBeGreaterThan(0));
    expect(docTypes(sent)).toEqual(['MATERIAL_LOT_LABEL']);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('US4-4 출력됨(입하 전) · 입하된 LOT 탭에서 다시 인쇄', () => {
  const PRINTED = (): HarnessOptions => ({
    groups: [
      group([
        lot(9001, { lastLabelIssue: { issueSeq: 1, issuedAt: '2026-11-11T01:00:00Z' } }),
        lot(9002, {
          lifecycleStatusCode: 'ACTIVE',
          statusCode: 'DEFECTIVE',
          inboundLotId: 6002,
          inboundLotNo: 'SYN-IL-0002',
          lastLabelIssue: { issueSeq: 2, issuedAt: '2026-11-10T01:00:00Z' },
        }),
        /* 3주 전 — 옛 「최근 2주」 창 밖이지만 기간 제한이 없어졌다(FR-014). */
        lot(9003, { lastLabelIssue: { issueSeq: 1, issuedAt: '2026-10-20T01:00:00Z' } }),
        lot(9004, {
          lifecycleStatusCode: 'VOIDED',
          lastLabelIssue: { issueSeq: 1, issuedAt: '2026-11-11T02:00:00Z' },
        }),
      ]),
    ],
  });

  const openTab = async (user: ReturnType<typeof userEvent.setup>, name: string, count: number) => {
    await pickFirst(user);
    await user.click(await screen.findByRole('tab', { name }));
    await waitFor(() => expect(rows()).toHaveLength(count));
  };

  it('US4-4 출력됨 탭은 기간 제한 없이 최근 출력 순 — 입하된 · 폐기 LOT 은 빼고', async () => {
    const user = userEvent.setup();
    renderLabelScreen(PRINTED());

    await openTab(user, tp.tabs.PRINTED, 2);
    expect(rows()[0]?.closest('tr')).toHaveTextContent('|0001');
    expect(rows()[1]?.closest('tr')).toHaveTextContent('|0003');
  });

  it('US4-4 사유를 고르기 전에는 보내지 않고, 고른 사유를 본문에 실어 출력 차수를 올린다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen(PRINTED());

    await openTab(user, tp.tabs.PRINTED, 2);
    await user.click(rows()[0] as HTMLElement);

    /* 사유는 필수 칸 — 고르기 전에는 [N장 재인쇄]가 흐리게 꺼져 있다. */
    expect(screen.getByRole('button', { name: t.reprint.action(1) })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: '훼손' }));
    await user.click(screen.getByRole('button', { name: t.reprint.action(1) }));
    const dialog = await screen.findByRole('dialog', { name: t.preview.reprintTitle });
    expect(within(dialog).getByText(t.preview.reissue(2))).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.preview.reprint(1) }));

    await waitFor(() => expect(screen.getAllByText(t.bar.reprinted(1)).length).toBeGreaterThan(0));
    expect(sentTo(sent, '/app/document-issues')[0]?.body).toMatchObject({
      targets: [{ lotId: 9001 }],
      reissueReasonCode: 'DAMAGED',
    });
  });

  it('US4-5 3주 전에 출력한 라벨을 스캔해도 찾아 고른다 — 기간 제한 없음', async () => {
    const user = userEvent.setup();
    renderLabelScreen(PRINTED());

    const search = await screen.findByRole('textbox', { name: tp.scanLabel });
    await user.type(search, 'SYN-ITEM-01|1000|261111|SYN-P-01|0003{Enter}');

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /\|0003 /u })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
  });

  it('⛔ 불량 LOT 은 누르기 전에 막고 그 까닭을 말한다(입하된 LOT 탭)', async () => {
    const user = userEvent.setup();
    renderLabelScreen(PRINTED());

    await openTab(user, tp.tabs.RECEIVED, 1);
    await user.click(rows()[0] as HTMLElement);
    await user.click(screen.getByRole('radio', { name: '훼손' }));

    expect(screen.getByText(t.reprint.lotBlocked('불량'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.reprint.action(1) })).toBeDisabled();
  });

  it('⛔ 고를 사유가 없으면 보내지 않고 왜 못 하는지 보인다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ ...PRINTED(), reissueReasons: [] });

    await openTab(user, tp.tabs.PRINTED, 2);
    /* 사유 칸은 LOT을 고른 뒤에만 선다. */
    expect(screen.queryByText(t.reprint.reasonsEmpty)).toBeNull();
    await user.click(rows()[0] as HTMLElement);

    expect(await screen.findByText(t.reprint.reasonsEmpty)).toBeInTheDocument();
  });
});

describe('프린터 선택', () => {
  const PRINTERS = { names: ['HT800', 'HT800 #2'], target: 'HT800' };

  const installSelectableShell = (selectable: boolean) => {
    const save = vi.fn(async (..._args: unknown[]) => 'C:/syn/label.prn');
    window.pop = {
      rendition: { save },
      printers: {
        list: async () => ({
          printers: PRINTERS.names.map((name) => ({ name })),
          target: PRINTERS.target,
        }),
        capabilities: async () => (selectable ? { raw: true, selectable } : { raw: true }),
      },
    } as unknown as typeof window.pop;

    return save;
  };

  it('처음에는 셸의 출력 대상이 골라져 있고 그 이름으로 셸에 보낸다', async () => {
    const user = userEvent.setup();
    const save = installSelectableShell(true);
    renderLabelScreen(waitingOnly(1));

    expect(
      await screen.findByRole('button', { name: `${t.printer.choose}: HT800` }),
    ).toBeInTheDocument();
    await issueAll(user, 1);

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls.at(-1)?.[4]).toBe('HT800');
  });

  it('머리줄 칩을 눌러 다른 프린터를 고르면 그리로 보내고 이 단말에 기억한다', async () => {
    const user = userEvent.setup();
    const save = installSelectableShell(true);
    const { sent } = renderLabelScreen(waitingOnly(1));

    await user.click(await screen.findByRole('button', { name: `${t.printer.choose}: HT800` }));
    await user.click(await screen.findByRole('option', { name: /HT800 #2/u }));
    await user.click(screen.getByRole('button', { name: messages.popChrome.printerPicker.select }));

    expect(window.localStorage.getItem(PRINTER_STORAGE_KEY)).toBe('HT800 #2');

    await issueAll(user, 1);

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls.at(-1)?.[4]).toBe('HT800 #2');
    expect(sentTo(sent, '/app/document-issues')[0]?.body).toMatchObject({
      printerName: 'HT800 #2',
    });
  });

  it('⛔ 고른 프린터를 받지 못하는 옛 설치본에서는 셸에 이름을 싣지 않는다', async () => {
    window.localStorage.setItem(PRINTER_STORAGE_KEY, 'HT800 #2');
    const user = userEvent.setup();
    const save = installSelectableShell(false);
    renderLabelScreen(waitingOnly(1));

    expect(
      await screen.findByRole('button', { name: `${t.printer.choose}: HT800` }),
    ).toBeInTheDocument();
    await issueAll(user, 1);

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls.at(-1)).toHaveLength(4);
  });
});
