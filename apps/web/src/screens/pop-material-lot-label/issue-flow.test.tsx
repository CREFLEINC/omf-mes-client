import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRINTER_STORAGE_KEY } from './printer-choice';
import {
  HARNESS_NOW,
  WORKER_NO,
  line,
  lotIdFor,
  lotNoOf,
  receipt,
  renderLabelScreen,
  sentTo,
  type HarnessOptions,
  type Sent,
} from './screen-harness';

/**
 * 일괄 발행 — **한 장마다 다섯 걸음(등록 → 발행 기록 → 라벨 짜기 → 인쇄 → 결과 보고)을 차례로**
 * (개편안 승인 2026-10-24 · omf-all-around#184).
 *
 * 여기서 무는 것은 「무엇을 어떤 차례로 보내는가」와 「어디서 멈췄을 때 무엇을 말하고 무엇을 다시
 * 보내는가」다. 본문 조립은 `issue-request.test.ts`, 라벨 배치는 `label-tspl.test.ts` 가 따로 문다.
 */

const t = messages.popMaterialLotLabel;

beforeEach(() => {
  /* 발판의 입하일(08-27)이 화면의 기본 기간(이번 주)에 들게 날짜만 멈춘다(`HARNESS_NOW`). */
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HARNESS_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  delete window.pop;
  try {
    window.localStorage.removeItem(PRINTER_STORAGE_KEY);
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

/** 한 공급사에 세 줄 — 같은 날 09:00 · 09:10 · 09:20 에 들어왔다. */
const THREE = {
  receipts: [
    receipt(8101, 8201, '2026-08-27T02:00:00Z'),
    receipt(8102, 8201, '2026-08-27T02:10:00Z'),
    receipt(8103, 8201, '2026-08-27T02:20:00Z'),
  ],
  lines: [line(8501, 8101, 8601, 500), line(8502, 8102, 8602, 700), line(8503, 8103, 8601, 900)],
} satisfies HarnessOptions;

const rows = (): HTMLElement[] => screen.queryAllByRole('checkbox', { name: /입하$/u });

const issueAll = async (user: ReturnType<typeof userEvent.setup>, count: number): Promise<void> => {
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  await user.click(screen.getByRole('checkbox', { name: t.table.selectAll }));
  await user.click(screen.getByRole('button', { name: t.bar.issue(count) }));
};

const posts = (sent: readonly Sent[]): string[] =>
  sent
    .filter((entry) => entry.method === 'POST')
    .map((entry) => entry.path.replace(/\d+:report-print$/u, 'REPORT'));

const docTypes = (sent: readonly Sent[]): string[] =>
  sentTo(sent, '/app/document-issues').map(
    (entry) => (entry.body as { documentTypeCode: string }).documentTypeCode,
  );

describe('일괄 발행 — 차례로 보낸다', () => {
  it('고른 줄을 입하 순서대로 한 장씩 다섯 걸음 보내고, 쓰기마다 사번과 멱등 키를 싣는다', async () => {
    const user = userEvent.setup();
    const save = installShell();
    const { sent } = renderLabelScreen(THREE);

    await issueAll(user, 3);

    await waitFor(() => expect(screen.getByText(t.bar.done(3))).toBeInTheDocument());
    expect(posts(sent)).toEqual([
      '/trace/lots',
      '/app/document-issues',
      '/app/document-issues/REPORT',
      '/trace/lots',
      '/app/document-issues',
      '/app/document-issues/REPORT',
      '/trace/lots',
      '/app/document-issues',
      '/app/document-issues/REPORT',
    ]);
    expect(
      sentTo(sent, '/trace/lots').map((entry) => (entry.body as { sourceId: number }).sourceId),
    ).toEqual([8501, 8502, 8503]);
    expect(save).toHaveBeenCalledTimes(3);

    for (const entry of sent.filter((each) => each.method === 'POST')) {
      expect(entry.headers.get('X-Worker-No')).toBe(WORKER_NO);
      expect(entry.headers.get('Idempotency-Key')).not.toBeNull();
    }
  });

  it('등록 본문의 원천 짝이 입하 «줄»을 가리킨다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen();

    await issueAll(user, 1);

    await waitFor(() => expect(sentTo(sent, '/trace/lots')).toHaveLength(1));
    expect(sentTo(sent, '/trace/lots')[0]?.body).toMatchObject({
      sourceTypeCode: 'INBOUND_RECEIPT_LINE',
      sourceId: 8501,
      numberSourceCode: 'MES',
    });
  });

  it('셸에 80 × 30 TSPL 라벨을 넘기고 QR 에는 LOT 번호만 싣는다', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (..._args: unknown[]) => 'C:/syn/label.tspl');
    installShell(save);
    renderLabelScreen();

    await issueAll(user, 1);

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [bytes, , , format] = save.mock.calls[0] ?? [];
    const commands = new TextDecoder('latin1').decode(bytes as Uint8Array);
    const lotNo = lotNoOf(lotIdFor(8501));

    expect(format).toBe('tspl');
    expect(commands.startsWith('SIZE 80 mm,30 mm')).toBe(true);
    expect(commands).toContain(`QRCODE`);
    expect(commands).toContain(`"${lotNo}"\r\n`);
    expect(commands).toContain('"SYN-ITEM-01"');
    expect(commands).toContain('"500 EA"');
    expect(commands).toContain('PRINT 1,1');
  });

  it('다 나오면 줄마다 「인쇄됨」을 남기고, 「확인」을 누르면 찍은 줄이 대기에서 빠진다', async () => {
    const user = userEvent.setup();
    installShell();
    renderLabelScreen({ ...THREE, lineList: 'served' });

    await waitFor(() => expect(rows()).toHaveLength(3));
    await user.click(rows()[0] as HTMLElement);
    await user.click(rows()[2] as HTMLElement);
    await user.click(screen.getByRole('button', { name: t.bar.issue(2) }));

    await waitFor(() => expect(screen.getByText(t.bar.done(2))).toBeInTheDocument());
    expect(screen.getAllByText(t.status.printed)).toHaveLength(2);
    expect(screen.getByText(t.status.notSelected)).toBeInTheDocument();
    expect(screen.getByText(t.table.resultSummary(2, 0))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.bar.confirm }));

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('SYN-ITEM-02');
  });

  it('이미 등록된 줄(LOT 만 있고 발행 기록 없음)은 등록을 다시 부르지 않고 발행부터 한다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen({ lines: [line(8501, 8101, 8601, 500, { lotId: 9555 })] });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.bar.done(1))).toBeInTheDocument());
    expect(sentTo(sent, '/trace/lots')).toHaveLength(0);
    expect(sentTo(sent, '/app/document-issues')[0]?.body).toMatchObject({
      targets: [{ lotId: 9555 }],
    });
  });

  it('⛔ 보내기 직전에 보니 다른 단말이 먼저 찍은 줄은 보내지 않고 「이미 발행됨」으로 둔다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent, issuedLines } = renderLabelScreen(THREE);

    await waitFor(() => expect(rows()).toHaveLength(3));
    await user.click(screen.getByRole('checkbox', { name: t.table.selectAll }));
    /* 고른 뒤, 보내기 전에 다른 단말이 8502 를 찍었다. */
    issuedLines.add(8502);
    await user.click(screen.getByRole('button', { name: t.bar.issue(3) }));

    await waitFor(() => expect(screen.getByText(t.bar.done(2))).toBeInTheDocument());
    expect(
      sentTo(sent, '/trace/lots').map((entry) => (entry.body as { sourceId: number }).sourceId),
    ).toEqual([8501, 8503]);
    expect(screen.getByText(t.status.alreadyIssued)).toBeInTheDocument();
  });
});

describe('일괄 발행 — 멈추는 자리', () => {
  it('프린터가 응답하지 않으면 그 장에서 멈추고 남은 장은 「멈춤」으로 남긴다', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => {
      throw new Error('프린터 응답 없음');
    });
    installShell(save);
    const { sent } = renderLabelScreen(THREE);

    await issueAll(user, 3);

    await waitFor(() => expect(screen.getByText(t.bar.failed(3))).toBeInTheDocument());
    expect(save).toHaveBeenCalledTimes(1);
    expect(sentTo(sent, '/trace/lots')).toHaveLength(1);
    expect(screen.getByText(t.status.failed.printFailed)).toBeInTheDocument();
    expect(screen.getAllByText(t.status.stopped)).toHaveLength(2);
    expect(screen.getByText(t.bar.next.printFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.bar.retry(3) })).toBeInTheDocument();
    /* 실패도 보고한다 — 「나오지 않은 라벨」이 나온 것으로 남지 않게. */
    expect(sentTo(sent, '/app/document-issues/44001:report-print')[0]?.body).toMatchObject({
      outcome: 'FAILED',
    });
  });

  it('발행 기록이 남아 대기에서 빠진 줄도 결과에 품목코드 · 품목명을 그대로 적는다', async () => {
    const user = userEvent.setup();
    installShell(
      vi.fn(async () => {
        throw new Error('프린터 응답 없음');
      }),
    );
    renderLabelScreen({ lineList: 'served' });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.bar.failed(1))).toBeInTheDocument());
    /* 끝난 뒤 다시 받은 대기 목록에 이 줄이 없다 — 공급사 타일이 사라진다. */
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: /합성 공급사 가/u })).toHaveLength(0),
    );
    expect(screen.getByText('SYN-ITEM-01')).toBeInTheDocument();
    expect(screen.getByText('합성 품목 가')).toBeInTheDocument();
    expect(screen.queryByText(messages.common.reference.loading)).toBeNull();
  });

  it('셸 인쇄 통로가 없는 단말(브라우저)에서는 첫 장에서 멈춘다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen(THREE);

    await issueAll(user, 3);

    await waitFor(() => expect(screen.getByText(t.bar.failed(3))).toBeInTheDocument());
    expect(sentTo(sent, '/trace/lots')).toHaveLength(1);
  });

  it('다시 발행 — 인쇄만 실패한 장은 같은 LOT 에 「인쇄 실패」 사유로, 멈춘 장은 사유 없이 첫 발행으로 보낸다', async () => {
    const user = userEvent.setup();
    let fail = true;
    const save = vi.fn(async () => {
      if (fail) throw new Error('프린터 응답 없음');

      return 'C:/syn/label.prn';
    });
    installShell(save);
    const { sent } = renderLabelScreen(THREE);

    await issueAll(user, 3);
    await waitFor(() => expect(screen.getByText(t.bar.failed(3))).toBeInTheDocument());

    fail = false;
    await user.click(screen.getByRole('button', { name: t.bar.retry(3) }));

    await waitFor(() => expect(screen.getByText(t.bar.done(3))).toBeInTheDocument());
    /* ⛔ 첫 장의 LOT 을 다시 만들지 않는다 — 등록은 줄마다 한 번씩만. */
    expect(
      sentTo(sent, '/trace/lots').map((entry) => (entry.body as { sourceId: number }).sourceId),
    ).toEqual([8501, 8502, 8503]);
    const issues = sentTo(sent, '/app/document-issues').map(
      (entry) => entry.body as { reissueReasonCode?: string; targets: { lotId: number }[] },
    );
    expect(issues[1]).toMatchObject({
      reissueReasonCode: 'PRINT_FAILURE',
      targets: [{ lotId: lotIdFor(8501) }],
    });
    expect(issues[2]?.reissueReasonCode).toBeUndefined();
    expect(issues[3]?.reissueReasonCode).toBeUndefined();
  });

  it('사유 목록에 「인쇄 실패」가 없으면 인쇄만 실패한 장은 여기서 다시 보내지 않고 다시 인쇄로 넘긴다', async () => {
    const user = userEvent.setup();
    installShell(
      vi.fn(async () => {
        throw new Error('프린터 응답 없음');
      }),
    );
    renderLabelScreen({ reissueReasons: [{ code: 'DAMAGED', codeName: '훼손' }] });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.bar.failed(1))).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: t.bar.retry(1) })).toBeNull();
    expect(screen.getByText(t.bar.next.needsReason)).toBeInTheDocument();
  });

  it('한 줄의 등록이 409 면 그 줄만 「등록 지연」으로 두고 나머지는 계속 보낸다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen({ ...THREE, registerFail: { 8502: { status: 409 } } });

    await issueAll(user, 3);

    await waitFor(() => expect(screen.getByText(t.bar.failed(1))).toBeInTheDocument());
    expect(sentTo(sent, '/trace/lots')).toHaveLength(3);
    expect(screen.getAllByText(t.status.printed)).toHaveLength(2);
    expect(screen.getByText(t.status.failed.registerConflict)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.bar.retry(1) })).toBeInTheDocument();
  });

  it('다시 발행한 등록은 적용되지 않은 같은 멱등 키로 나간다', async () => {
    const user = userEvent.setup();
    installShell();
    const options: HarnessOptions = { registerFail: { 8501: { status: 409 } } };
    const { sent } = renderLabelScreen(options);

    await issueAll(user, 1);
    await waitFor(() => expect(screen.getByText(t.bar.failed(1))).toBeInTheDocument());

    delete options.registerFail?.[8501];
    await user.click(screen.getByRole('button', { name: t.bar.retry(1) }));

    await waitFor(() => expect(screen.getByText(t.bar.done(1))).toBeInTheDocument());
    const keys = sentTo(sent, '/trace/lots').map((entry) => entry.headers.get('Idempotency-Key'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('발행이 403 이면 「이 단말은 발행 불가」로 멈추고 다시 발행을 권하지 않는다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen({ ...THREE, issueFail: { status: 403 } });

    await issueAll(user, 3);

    await waitFor(() =>
      expect(screen.getByText(t.status.failed.issueForbidden)).toBeInTheDocument(),
    );
    expect(sentTo(sent, '/app/document-issues')).toHaveLength(1);
    expect(screen.getByText(t.bar.next.issueForbidden)).toBeInTheDocument();
    /* 멈춘 두 장은 다시 보낼 수 있지만 권한 없는 장은 빠진다. */
    expect(screen.getByRole('button', { name: t.bar.retry(2) })).toBeInTheDocument();
  });

  it('인쇄 뒤 결과 보고만 실패하면 종이는 나온 것으로 말하고 다시 찍게 하지 않는다', async () => {
    const user = userEvent.setup();
    installShell();
    renderLabelScreen({ reportFails: true });

    await issueAll(user, 1);

    await waitFor(() =>
      expect(screen.getByText(t.status.failed.reportFailedAfterPrint)).toBeInTheDocument(),
    );
    expect(screen.getByText(t.bar.next.reportFailedAfterPrint)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /다시 발행/u })).toBeNull();
  });

  it('라벨 값을 못 받으면 셸이 있어도 인쇄 · 보고에 닿지 않는다', async () => {
    const user = userEvent.setup();
    const save = installShell();
    const { sent } = renderLabelScreen({ renderFails: true });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.status.failed.other)).toBeInTheDocument());
    expect(save).not.toHaveBeenCalled();
    expect(sent.some((entry) => entry.path.endsWith(':report-print'))).toBe(false);
  });

  it('보내는 동안에는 공급사 · 줄 · 보기를 바꾸지 못하고 진행과 「멈춤」이 보인다', async () => {
    const user = userEvent.setup();
    installShell();
    renderLabelScreen({ ...THREE, issueHangs: true });

    await issueAll(user, 3);

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(t.bar.progress(0, 3))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.bar.stop })).toBeEnabled();
    expect(screen.getByRole('button', { name: /다시 인쇄/u })).toBeDisabled();
    for (const tile of within(screen.getByRole('list', { name: t.suppliers.label })).getAllByRole(
      'button',
    )) {
      expect(tile).toBeDisabled();
    }
  });

  it('「멈춤」을 누르면 지금 장까지 찍고 멈춘다 — 남은 장은 「멈춤」이고 이어서 보낼 수 있다', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => {
            resolve('C:/syn/label.prn');
          };
        }),
    );
    installShell(save);
    renderLabelScreen(THREE);

    await issueAll(user, 3);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: t.bar.stop }));
    expect(screen.getByText(t.bar.stopping)).toBeInTheDocument();
    release();

    await waitFor(() => expect(screen.getByText(t.bar.stopped(2))).toBeInTheDocument());
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t.status.printed)).toBeInTheDocument();
    expect(screen.getAllByText(t.status.stopped)).toHaveLength(2);
    expect(screen.getByRole('button', { name: t.bar.retry(2) })).toBeInTheDocument();
  });
});

describe('일괄 발행 — IQC 라벨', () => {
  it('IQC 대상이면 자재 라벨 뒤에 IQC 라벨을 발행 · 인쇄 · 보고한다', async () => {
    const user = userEvent.setup();
    const save = vi.fn(async (..._args: unknown[]) => 'C:/syn/label.prn');
    installShell(save);
    const { sent } = renderLabelScreen({
      lines: [line(8501, 8101, 8601, 500, { inspectionRequired: true })],
    });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.bar.done(1))).toBeInTheDocument());
    expect(docTypes(sent)).toEqual(['MATERIAL_LOT_LABEL', 'IQC_LABEL']);
    expect(save).toHaveBeenCalledTimes(2);
    const iqcBytes = save.mock.calls[1]?.[0] as Uint8Array;
    expect(new TextDecoder('latin1').decode(iqcBytes)).toContain('REVERSE');
  });

  it('자재 라벨이 안 나오면 IQC 라벨은 시도하지 않는다', async () => {
    const user = userEvent.setup();
    const save = installShell(
      vi.fn(async () => {
        throw new Error('프린터 응답 없음');
      }),
    );
    const { sent } = renderLabelScreen({
      lines: [line(8501, 8101, 8601, 500, { inspectionRequired: true })],
    });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.bar.failed(1))).toBeInTheDocument());
    expect(docTypes(sent)).toEqual(['MATERIAL_LOT_LABEL']);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('IQC 라벨만 안 나오면 자재 라벨은 나온 것으로 말한다', async () => {
    const user = userEvent.setup();
    let calls = 0;
    installShell(
      vi.fn(async () => {
        calls += 1;
        if (calls === 2) throw new Error('IQC 라벨 실패');

        return 'C:/syn/label.prn';
      }),
    );
    renderLabelScreen({ lines: [line(8501, 8101, 8601, 500, { inspectionRequired: true })] });

    await issueAll(user, 1);

    await waitFor(() => expect(screen.getByText(t.status.iqcMissing)).toBeInTheDocument());
    expect(screen.getByText(t.bar.done(1))).toBeInTheDocument();
  });
});

describe('다시 인쇄', () => {
  const ISSUED = {
    receipts: [
      receipt(8101, 8201, '2026-08-27T02:00:00Z'),
      receipt(8102, 8201, '2026-08-27T03:00:00Z'),
    ],
    lines: [
      line(8501, 8101, 8601, 500, { issued: true }),
      line(8502, 8102, 8602, 700, { issued: true }),
    ],
  } satisfies HarnessOptions;

  const openReprint = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(await screen.findByRole('button', { name: t.tabs.reprint }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  };

  it('발행한 줄을 최근 입하가 위로 보이고 LOT 번호를 그대로 적는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ ...ISSUED, lineList: 'served' });

    await openReprint(user);

    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toHaveTextContent(lotNoOf(lotIdFor(8502)));
    expect(rows()[1]).toHaveTextContent(lotNoOf(lotIdFor(8501)));
    expect(rows()[0]).toHaveTextContent(t.table.issuedAt(1, '08-27 17:02'));
  });

  it('줄 목록 경로가 없어도(404) LOT 번호를 LOT 상세로 풀어 적는다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(ISSUED);

    await openReprint(user);

    await waitFor(() => expect(rows()[0]).toHaveTextContent(lotNoOf(lotIdFor(8502))));
  });

  it('사유를 고르기 전에는 보내지 않고, 고른 사유를 본문에 싣는다 — 등록은 부르지 않는다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen({ ...ISSUED, lineList: 'served' });

    await openReprint(user);
    await user.click(rows()[0] as HTMLElement);

    expect(screen.getByRole('button', { name: t.reprint.action(1) })).toBeDisabled();
    expect(screen.getByText(t.reprint.reasonPrompt)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '훼손' }));
    expect(screen.getByText(t.reprint.summary('훼손'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.reprint.action(1) }));

    await waitFor(() => expect(screen.getByText(t.bar.done(1))).toBeInTheDocument());
    expect(sentTo(sent, '/trace/lots')).toHaveLength(0);
    expect(sentTo(sent, '/app/document-issues')[0]?.body).toMatchObject({
      reissueReasonCode: 'DAMAGED',
      targets: [{ lotId: lotIdFor(8502) }],
    });
  });

  it('라벨을 스캔하면(LOT 번호 + Enter) 그 줄을 고른다', async () => {
    const user = userEvent.setup();
    renderLabelScreen(ISSUED);

    await openReprint(user);
    await user.type(
      screen.getByRole('searchbox', { name: t.search.label }),
      `${lotNoOf(lotIdFor(8501))}{Enter}`,
    );

    await waitFor(() => expect(screen.getByText(t.bar.selected(1))).toBeInTheDocument());
    /* 다시 인쇄 표는 품목코드 대신 LOT 번호를 적는다 — 스캔한 그 번호다. */
    expect(rows().find((row) => row.getAttribute('aria-checked') === 'true')).toHaveTextContent(
      lotNoOf(lotIdFor(8501)),
    );
  });

  it('최근 2주 발행분에 없는 번호를 스캔하면 찾는 범위를 말한다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ ...ISSUED, lineList: 'served' });

    await openReprint(user);
    await user.type(screen.getByRole('searchbox', { name: t.search.label }), 'NO-SUCH-LOT{Enter}');

    expect(await screen.findByText(t.reprint.notFound)).toBeInTheDocument();
  });

  it('⛔ 불량 LOT 은 누르기 전에 막고 그 까닭을 말한다', async () => {
    const user = userEvent.setup();
    const { sent } = renderLabelScreen({
      ...ISSUED,
      lineList: 'served',
      lotStatusCode: 'DEFECTIVE',
    });

    await openReprint(user);
    await user.click(rows()[0] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '훼손' }));

    expect(screen.getByText(t.reprint.lotBlocked('불량'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.reprint.action(1) })).toBeDisabled();
    expect(sentTo(sent, '/app/document-issues')).toHaveLength(0);
  });

  it('검사 대기인 IQC 대상 LOT 의 다시 인쇄는 IQC 라벨도 찍는다 — 첫 IQC 라벨이면 사유 없이 낸다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen({
      receipts: [receipt(8101, 8201, '2026-08-27T02:00:00Z')],
      lines: [line(8501, 8101, 8601, 500, { issued: true, inspectionRequired: true })],
      lineList: 'served',
    });

    await openReprint(user);
    await user.click(rows()[0] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '훼손' }));
    await user.click(screen.getByRole('button', { name: t.reprint.action(1) }));

    await waitFor(() => expect(screen.getByText(t.bar.done(1))).toBeInTheDocument());
    const issues = sentTo(sent, '/app/document-issues').map(
      (entry) => entry.body as { documentTypeCode: string; reissueReasonCode?: string },
    );
    expect(issues.map((issue) => issue.documentTypeCode)).toEqual([
      'MATERIAL_LOT_LABEL',
      'IQC_LABEL',
    ]);
    expect(issues[1]?.reissueReasonCode).toBeUndefined();
  });

  it('IQC 라벨이 이미 나간 적이 있으면 서버가 요구한 사유를 실어 다시 낸다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen({
      receipts: [receipt(8101, 8201, '2026-08-27T02:00:00Z')],
      lines: [line(8501, 8101, 8601, 500, { issued: true, inspectionRequired: true })],
      lineList: 'served',
      iqcRequiresReason: true,
    });

    await openReprint(user);
    await user.click(rows()[0] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '훼손' }));
    await user.click(screen.getByRole('button', { name: t.reprint.action(1) }));

    await waitFor(() => expect(screen.getByText(t.bar.done(1))).toBeInTheDocument());
    expect(docTypes(sent)).toEqual(['MATERIAL_LOT_LABEL', 'IQC_LABEL', 'IQC_LABEL']);
    expect(
      (sentTo(sent, '/app/document-issues')[2]?.body as { reissueReasonCode?: string })
        .reissueReasonCode,
    ).toBe('DAMAGED');
  });

  it('판정이 끝난 LOT 의 다시 인쇄는 IQC 라벨을 찍지 않는다', async () => {
    const user = userEvent.setup();
    installShell();
    const { sent } = renderLabelScreen({
      receipts: [receipt(8101, 8201, '2026-08-27T02:00:00Z')],
      lines: [line(8501, 8101, 8601, 500, { issued: true, inspectionRequired: true })],
      lineList: 'served',
      lotStatusCode: 'NORMAL',
    });

    await openReprint(user);
    await user.click(rows()[0] as HTMLElement);
    await user.click(screen.getByRole('button', { name: '훼손' }));
    await user.click(screen.getByRole('button', { name: t.reprint.action(1) }));

    await waitFor(() => expect(screen.getByText(t.bar.done(1))).toBeInTheDocument());
    expect(docTypes(sent)).toEqual(['MATERIAL_LOT_LABEL']);
  });

  it('⛔ 고를 사유가 없으면 보내지 않고 왜 못 하는지 보인다', async () => {
    const user = userEvent.setup();
    renderLabelScreen({ ...ISSUED, lineList: 'served', reissueReasons: [] });

    await openReprint(user);
    await user.click(rows()[0] as HTMLElement);

    expect(await screen.findByText(t.reprint.reasonsEmpty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.reprint.action(1) })).toBeDisabled();
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
    renderLabelScreen();

    expect(await screen.findByText(`${t.printer.label} HT800`)).toBeInTheDocument();
    await issueAll(user, 1);

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls.at(-1)?.[4]).toBe('HT800');
  });

  it('머리줄 칩을 눌러 다른 프린터를 고르면 그리로 보내고 이 단말에 기억한다', async () => {
    const user = userEvent.setup();
    const save = installSelectableShell(true);
    const { sent } = renderLabelScreen();

    await user.click(await screen.findByRole('button', { name: `${t.printer.choose}: HT800` }));
    await user.click(await screen.findByRole('button', { name: /HT800 #2/u }));

    expect(window.localStorage.getItem(PRINTER_STORAGE_KEY)).toBe('HT800 #2');
    expect(screen.getByText(`${t.printer.label} HT800 #2`)).toBeInTheDocument();

    await issueAll(user, 1);

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls.at(-1)?.[4]).toBe('HT800 #2');
    expect(sentTo(sent, '/app/document-issues')[0]?.body).toMatchObject({
      printerName: 'HT800 #2',
    });
  });

  it('기억해 둔 프린터가 사라졌으면 기본으로 돌아가고 그 사실을 말한다', async () => {
    window.localStorage.setItem(PRINTER_STORAGE_KEY, '사라진 프린터');
    installSelectableShell(true);
    renderLabelScreen();

    expect(await screen.findByText(t.printer.storedMissing('사라진 프린터'))).toBeInTheDocument();
    expect(screen.getByText(`${t.printer.label} HT800`)).toBeInTheDocument();
  });

  it('⛔ 고른 프린터를 받지 못하는 옛 설치본에서는 칩을 눌러도 창이 없고, 셸에 이름을 싣지 않는다', async () => {
    window.localStorage.setItem(PRINTER_STORAGE_KEY, 'HT800 #2');
    const user = userEvent.setup();
    const save = installSelectableShell(false);
    renderLabelScreen();

    expect(await screen.findByText(`${t.printer.label} HT800`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(t.printer.choose, 'u') })).toBeNull();

    await issueAll(user, 1);

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls.at(-1)).toHaveLength(4);
  });
});
