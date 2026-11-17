import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { FAILED_ISSUE, PRINTED_ISSUE, splitLot } from './split-fixtures';
import type { SplitMaterialLot } from './split-lots';
import { GoodsIssueQrScreen } from './screen';

/*
 * P-01-02 분할 LOT 라벨(008 · omf-all-around#289 · 시안 P0102-After). 합성값만 쓴다.
 */

const t = messages.goodsIssueQr;
const PLANT_ID = 7701;

afterEach(() => {
  delete window.pop;
});

interface Sent {
  path: string;
  search: URLSearchParams;
  body: unknown;
}

const OLD = splitLot({
  lotId: 1,
  lotNo: 'SYN-ITEM-A|40|261112|100330|0003-S2',
  splitAt: '2026-11-12T07:05:00Z',
});
const FAILED = splitLot({
  lotId: 2,
  lotNo: 'SYN-ITEM-A|200|261117|100330|0001-S2',
  splitAt: '2026-11-17T02:15:00Z',
  labelIssue: FAILED_ISSUE,
});
const NEW = splitLot({ lotId: 3, splitAt: '2026-11-17T03:05:00Z' });
const DONE = splitLot({
  lotId: 4,
  lotNo: 'SYN-ITEM-A|100|261117|100330|0001-S4',
  labelIssue: PRINTED_ISSUE,
});

const render = (
  options: {
    unprinted?: SplitMaterialLot[];
    printed?: SplitMaterialLot[];
    listFails?: boolean;
  } = {},
) => {
  const sent: Sent[] = [];
  const unprinted = options.unprinted ?? [OLD, FAILED, NEW];
  let seq = 0;
  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/logistics/split-material-lots',
      respond: (request) => {
        const search = new URL(request.url).searchParams;

        sent.push({ path: '/logistics/split-material-lots', search, body: null });

        if (options.listFails === true) return jsonResponse({ message: '실패' }, { status: 500 });

        const items =
          search.get('labelState') === 'PRINTED' ? (options.printed ?? [DONE]) : unprinted;

        return jsonResponse({
          items,
          page: { page: 1, size: 200, total: items.length },
          unprintedCount: unprinted.length,
        });
      },
    },
    {
      match: (request) => new URL(request.url).pathname === '/app/printers',
      respond: () =>
        jsonResponse({
          items: [
            {
              printerName: 'syn-label-printer',
              displayName: '합성 라벨 프린터',
              status: 'READY',
              statusMessage: '대기 중',
              isDefault: true,
              supportedDocumentTypeCodes: ['LABEL'],
            },
          ],
        }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: () =>
        jsonResponse({
          items: [
            {
              codeValueId: 1,
              codeGroupId: 9,
              code: 'PRINT_FAILURE',
              codeName: '인쇄 실패',
              displayOrder: 1,
              isActive: true,
            },
            {
              codeValueId: 2,
              codeGroupId: 9,
              code: 'DAMAGED',
              codeName: '훼손',
              displayOrder: 2,
              isActive: true,
            },
          ],
          page: { page: 1, size: 50, total: 2 },
        }),
    },
    {
      match: (request) =>
        new URL(request.url).pathname === '/app/document-issues' && request.method === 'POST',
      respond: async (request) => {
        sent.push({
          path: '/app/document-issues',
          search: new URLSearchParams(),
          body: await request.json(),
        });
        seq += 1;

        return jsonResponse(
          {
            items: [
              { documentIssueLogId: 9000 + seq, issueSeq: 1, lotNo: null, printOutcome: 'PENDING' },
            ],
          },
          { status: 201 },
        );
      },
    },
    {
      match: (request) => /:report-print$/u.test(new URL(request.url).pathname),
      respond: async (request) => {
        sent.push({ path: 'report', search: new URLSearchParams(), body: await request.json() });

        return jsonResponse({});
      },
    },
  ]);
  const identity: PopIdentity = {
    terminalId: 7,
    processes: null,
    equipment: null,
    workerNo: '900028',
    plantId: PLANT_ID,
  };

  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <GoodsIssueQrScreen />
    </PopIdentityProvider>,
    { fetch },
  );

  return { sent };
};

const shellPrints = (fail = false) => {
  window.pop = {
    rendition: {
      save: () => (fail ? Promise.reject(new Error('용지 없음')) : Promise.resolve('/tmp/x.tspl')),
    },
  } as unknown as typeof window.pop;
};

const checkbox = (lotNo: string) => screen.getByRole('checkbox', { name: t.table.choose(lotNo) });

describe('P-01-02 분할 LOT 라벨', () => {
  it('Q7 · US2-1 라벨 안 찍은 분할 LOT 이 건수와 함께 오래된 순으로 맨 위에 선다 — 기간 조건 없이 묻는다', async () => {
    const { sent } = render();

    expect(await screen.findByText(t.band.title(3))).toBeTruthy();
    expect(screen.getByText(t.band.failed(1))).toBeTruthy();
    const rows = screen.getAllByRole('checkbox');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      t.table.choose(OLD.lotNo),
      t.table.choose(FAILED.lotNo),
      t.table.choose(NEW.lotNo),
    ]);
    expect(screen.getAllByTitle(NEW.parentLot.lotNo).length).toBeGreaterThan(0);
    const list = sent.find((each) => each.search.get('labelState') === 'UNPRINTED');
    expect(list?.search.get('plantId')).toBe(String(PLANT_ID));
    expect(list?.search.has('issuedFrom')).toBe(false);
  });

  it('US2-5 미발행이 없으면 「없음」 띠와 빈 안내를 보인다', async () => {
    render({ unprinted: [] });

    expect(await screen.findByText(t.band.noneTitle)).toBeTruthy();
    expect(screen.getByText(t.empty.unprintedTitle)).toBeTruthy();
  });

  it('Q8 · US2-2 고른 분할 LOT 을 미리 보고 자재 LOT 라벨로 찍는다 — 출고 QR 이 아니다', async () => {
    shellPrints();
    const user = userEvent.setup();
    const { sent } = render();

    await user.click(await screen.findByRole('checkbox', { name: t.table.choose(NEW.lotNo) }));
    await user.click(screen.getByRole('button', { name: t.bar.print(1) }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(NEW.lotNo)).toBeTruthy();
    expect(within(dialog).getByTitle(NEW.parentLot.lotNo)).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: t.preview.print(1) }));

    expect(await screen.findByText(t.result.printed(1))).toBeTruthy();
    expect(
      sent.filter((each) => each.path === '/app/document-issues').map((each) => each.body),
    ).toEqual([
      {
        documentTypeCode: 'MATERIAL_LOT_LABEL',
        targets: [{ targetTypeCode: 'LOT', targetId: 3, lotId: 3 }],
        printerName: 'syn-label-printer',
      },
    ]);
  });

  it('Q10 · US2-4 인쇄 실패로 남은 LOT 을 고르면 재발행 사유를 골라야 찍는다', async () => {
    shellPrints();
    const user = userEvent.setup();
    const { sent } = render();

    await user.click(await screen.findByRole('checkbox', { name: t.table.choose(FAILED.lotNo) }));

    const print = screen.getByRole('button', { name: t.bar.print(1) });
    expect(print).toHaveProperty('disabled', true);
    expect(screen.getByText(t.reasons.needFailed(1))).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: '훼손' }));
    await user.click(screen.getByRole('button', { name: t.bar.print(1) }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: t.preview.print(1) }),
    );

    await screen.findByText(t.result.printed(1));
    expect(sent.find((each) => each.path === '/app/document-issues')?.body).toMatchObject({
      reissueReasonCode: 'DAMAGED',
    });
  });

  it('Q9 · US2-3 인쇄가 실패하면 실패를 알리고 남은 장은 보내지 않는다', async () => {
    shellPrints(true);
    const user = userEvent.setup();
    const { sent } = render();

    await user.click(await screen.findByRole('button', { name: t.bar.selectAll(3) }));
    await user.click(await screen.findByRole('button', { name: '훼손' }));
    await user.click(screen.getByRole('button', { name: t.bar.print(3) }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: t.preview.print(3) }),
    );

    expect(await screen.findByText(t.result.partial(3, 0, 1) + t.result.notSent(2))).toBeTruthy();
    expect(sent.filter((each) => each.path === '/app/document-issues')).toHaveLength(1);
    expect(sent.find((each) => each.path === 'report')?.body).toMatchObject({ outcome: 'FAILED' });
  });

  it('「찍음」은 출고일 기간으로 묻고, 다시 찍으려면 사유가 필요하다', async () => {
    const user = userEvent.setup();
    const { sent } = render();

    await screen.findByText(t.band.title(3));
    await user.click(screen.getByRole('button', { name: t.tabs.printed }));

    await user.click(await screen.findByRole('checkbox', { name: t.table.choose(DONE.lotNo) }));
    expect(screen.getByRole('button', { name: t.bar.reprint(1) })).toHaveProperty('disabled', true);
    await waitFor(() => {
      expect(sent.some((each) => each.search.get('labelState') === 'PRINTED')).toBe(true);
    });
    const printed = sent.find((each) => each.search.get('labelState') === 'PRINTED');
    expect(printed?.search.has('issuedFrom')).toBe(true);
    expect(printed?.search.has('issuedTo')).toBe(true);
  });

  it('찾는 번호가 다른 보기에 있으면 그 사실과 옮겨 갈 단추를 보인다', async () => {
    const user = userEvent.setup();
    render();

    await screen.findByText(t.band.title(3));
    await user.type(screen.getByRole('searchbox', { name: t.search.label }), DONE.lotNo);

    expect(await screen.findByText(t.empty.searchInPrinted(DONE.lotNo))).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t.empty.showInPrinted }));
    expect(await screen.findByRole('checkbox', { name: t.table.choose(DONE.lotNo) })).toBeTruthy();
  });

  it('목록을 받지 못하면 건수를 「?」로 두고 다시 불러오기를 보인다 — 「없음」으로 말하지 않는다', async () => {
    render({ listFails: true });

    expect(await screen.findByText(t.empty.loadFailedTitle)).toBeTruthy();
    expect(screen.getByText(t.band.unknownTitle)).toBeTruthy();
    expect(screen.queryByText(t.band.noneTitle)).toBeNull();
  });

  it('FR-010 출고 QR(라인·파렛트) 발행은 없다', async () => {
    render();

    await screen.findByText(t.band.title(3));
    expect(screen.queryByText(/출고 QR 발행|파렛트/u)).toBeNull();
    expect(screen.getByRole('heading', { name: t.title })).toBeTruthy();
  });
});

describe('P-01-02 LOT 번호 줄바꿈', () => {
  /* 실제 앱 검증(2026-11-17, 1024 × 768): 번호가 칸 가운데(`…|SUP` / `1|0001-S1`)에서 끊겼다. `|` 뒤에서만 끊는다. */
  it('분할 LOT·원래 LOT 번호는 `|` 칸 경계에서만 줄바꿈 기회를 두고 칸은 한 덩어리다', async () => {
    render();

    await screen.findByText(t.band.title(3));
    const lotNo = screen
      .getAllByTitle(NEW.lotNo)
      .find((each) => each.classList.contains('pop-split-lotno'));

    expect(lotNo?.querySelectorAll('wbr')).toHaveLength(4);
    expect(
      [...(lotNo?.querySelectorAll('.pop-split-seg') ?? [])].map((each) => each.textContent),
    ).toEqual(['SYN-ITEM-A|', '300|', '261117|', '100330|', '0001-S1']);
    const parent = screen.getAllByTitle(NEW.parentLot.lotNo)[0];
    expect(parent?.querySelectorAll('wbr')).toHaveLength(4);
  });
});

describe('P-01-02 체크박스', () => {
  it('전체 선택은 보이는 줄을 모두 고르고, 다시 누르면 모두 푼다', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: t.bar.selectAll(3) }));
    expect(checkbox(OLD.lotNo)).toHaveProperty('checked', true);
    expect(checkbox(NEW.lotNo)).toHaveProperty('checked', true);

    await user.click(screen.getByRole('button', { name: t.bar.clearAll }));
    expect(checkbox(OLD.lotNo)).toHaveProperty('checked', false);
  });
});
