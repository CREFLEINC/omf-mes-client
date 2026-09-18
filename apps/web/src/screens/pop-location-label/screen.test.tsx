import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { PopLocationLabelScreen } from './screen';

const t = messages.popLocationLabel;

/** 사번을 갖춘 정상 진입. 값은 지어낸 것이다. */
const ENTRY_ROUTE = '/pop/location-label?workerNo=3391';

const pathOf = (request: Request): string => new URL(request.url).pathname;

const WAREHOUSE = {
  warehouseId: 7,
  plantId: 1,
  warehouseCode: 'S230',
  warehouseName: '자재창고',
  warehouseTypeCode: 'MATERIAL',
  managementLevelCode: 'LOCATION',
  isExternal: false,
  isDefect: false,
  isActive: true,
};

/*
 * ⚠ `locationId` 와 `locationCode` 를 «닮지 않게» 둔다. 코드에서 식별자를 유추하는 잘못을
 *   테스트가 잡아내야 한다 — 실 데이터에서 둘은 전혀 다른 축이다.
 */
const location = (locationId: number, locationCode: string, isActive = true) => ({
  locationId,
  warehouseId: 7,
  parentLocationId: null,
  locationCode,
  locationName: `${locationCode} NAME`,
  locationTypeCode: 'RACK',
  qualityZoneCode: null,
  storageConditionCode: null,
  allowMixedItem: true,
  allowMixedLot: true,
  capacityQty: null,
  capacityUomId: null,
  isActive,
});

const LOCATIONS = [
  location(41, 'S230-01'),
  location(42, 'S230-02'),
  location(43, 'S230-03', false),
];

const issuedRecord = (documentIssueLogId: number, targetId: number, issueSeq: number) => ({
  documentIssueLogId,
  documentTypeCode: 'LOCATION_LABEL',
  target: { targetTypeCode: 'LOCATION', targetId },
  issueSeq,
  issuedBy: 1,
  issuedByName: '샘플 작업자',
  issuedAt: '2026-09-16T01:00:00Z',
  printOutcome: 'PENDING',
});

interface Options {
  /** 위치별 발행 횟수. 없는 위치는 요약에서 빠진다(=아직 안 찍었다). */
  issueCounts?: Record<number, number>;
  /** 프린터 목록. 기본은 1건 */
  printers?: unknown[];
  /** 발행 요청을 담아 둔다 */
  writes?: Request[];
  /** 인쇄 결과 보고 요청을 담아 둔다 */
  reports?: Request[];
  /** 렌디션 조회 요청을 담아 둔다 — 건별로 나가는지 검사한다 */
  renditionCalls?: string[];
  /** 렌디션 조회가 실패하는 경우 — 인쇄 실패로 이어져야 한다 */
  renditionFails?: boolean;
  /** 발행 이력 요약 조회가 실패하는 경우 — 발행이 막히고 사유가 보여야 한다 */
  summaryFails?: boolean;
}

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => pathOf(request) === '/mdm/warehouses',
    respond: () => jsonResponse({ items: [WAREHOUSE], page: { total: 1 } }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/locations',
    respond: () => jsonResponse({ items: LOCATIONS, page: { total: LOCATIONS.length } }),
  },
  {
    match: (request) => pathOf(request) === '/app/printers',
    respond: () =>
      jsonResponse({
        items: options.printers ?? [
          {
            printerName: 'label-a',
            displayName: '샘플 라벨 프린터 A',
            status: 'READY',
            statusMessage: '대기 중',
            isDefault: true,
            supportedDocumentTypeCodes: ['LOCATION_LABEL'],
          },
        ],
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: [
          {
            codeValueId: 1,
            code: 'DAMAGED',
            codeName: '라벨 훼손',
            displayOrder: 1,
            isActive: true,
          },
          { codeValueId: 2, code: 'LOST', codeName: '라벨 분실', displayOrder: 2, isActive: true },
        ],
      }),
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues/summary',
    respond: (request) => {
      if (options.summaryFails === true) {
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      }

      const targetIds = new URL(request.url).searchParams.getAll('targetIds').map(Number);

      return jsonResponse({
        items: targetIds.map((targetId) => ({
          targetTypeCode: 'LOCATION',
          targetId,
          issueCount: options.issueCounts?.[targetId] ?? 0,
          lastIssueSeq: options.issueCounts?.[targetId] ?? 0,
        })),
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/app/document-issues' && request.method === 'POST',
    respond: async (request) => {
      options.writes?.push(request.clone());
      const body = (await request.clone().json()) as { targets: { targetId: number }[] };

      return jsonResponse(
        {
          items: body.targets.map((target, index) =>
            issuedRecord(
              7000 + index,
              target.targetId,
              (options.issueCounts?.[target.targetId] ?? 0) + 1,
            ),
          ),
          issuedCount: body.targets.length,
        },
        { status: 201 },
      );
    },
  },
  {
    match: (request) => /\/app\/document-issues\/\d+\/rendition$/u.test(pathOf(request)),
    respond: (request) => {
      options.renditionCalls?.push(request.url);

      if (options.renditionFails === true) {
        return jsonResponse({ message: '그리지 못했습니다' }, { status: 500 });
      }

      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    },
  },
  {
    match: (request) => pathOf(request).endsWith(':report-print'),
    respond: (request) => {
      options.reports?.push(request.clone());

      return jsonResponse({ ok: true });
    },
  },
];

const renderScreen = (options: Options = {}) =>
  renderWithProviders(<PopLocationLabelScreen />, {
    route: ENTRY_ROUTE,
    fetch: createStubFetch(routes(options)),
  });

/** 셸 인쇄 통로를 세운다. 실기에서는 preload 가 `window.pop` 을 심는다. */
const installPrintBridge = (save: (...args: unknown[]) => Promise<string>) => {
  (globalThis as { pop?: unknown }).pop = { rendition: { save } };
};

afterEach(() => {
  delete (globalThis as { pop?: unknown }).pop;
  vi.restoreAllMocks();
});

const chooseWarehouse = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: t.warehouse.label }));
  await user.click(await screen.findByRole('option', { name: /S230/u }));
};

const chooseLocation = async (user: ReturnType<typeof userEvent.setup>, locationCode: string) => {
  const row = (await screen.findByText(locationCode)).closest('tr');
  if (row === null) throw new Error(`${locationCode} 줄을 찾지 못했습니다.`);

  await user.click(within(row).getByRole('button', { name: t.location.pick }));
};

/**
 * 발행 단추가 열릴 때까지 기다렸다가 누른다.
 *
 * ⚠ **고른 직후에는 잠겨 있다** — 회차를 모르는 채 보내면 사유가 빠져 전건이 실패하므로,
 *   화면이 발행 이력 요약을 받을 때까지 단추를 열지 않는다. 기다리지 않고 누르면 **아무 일도
 *   일어나지 않은 것**을 시험이 「보내지 않았다」로 잘못 읽는다.
 */
const clickIssue = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = await screen.findByRole('button', { name: t.issue.action });

  await waitFor(() => {
    expect(button).toBeEnabled();
  });

  await user.click(button);
};

describe('P-06-01 창고 적재 위치 라벨 발행', () => {
  it('처음 찍는 자리는 사유를 묻지 않고 발행하고, 셸로 라벨을 보낸 뒤 결과를 보고한다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    const reports: Request[] = [];
    const renditionCalls: string[] = [];
    const save = vi.fn().mockResolvedValue('/tmp/label.tspl');
    installPrintBridge(save);

    renderScreen({ writes, reports, renditionCalls });

    await chooseWarehouse(user);
    await chooseLocation(user, 'S230-01');
    await clickIssue(user);

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    /*
     * ⛔ **첫 발행에 재발행 사유가 실리면 안 된다** — 서버는 회차 2 이상인 기록에만 이 값을
     *    남기므로, 붙여 보내면 이력이 거짓이 된다. `toEqual` 이라 여분의 칸도 잡힌다.
     */
    await expect(writes[0]?.clone().json()).resolves.toEqual({
      documentTypeCode: 'LOCATION_LABEL',
      targets: [{ targetTypeCode: 'LOCATION', targetId: 41 }],
      printerName: 'label-a',
    });

    /*
     * 발행 기록 1건 = 인쇄 1번 = 보고 1번. ⭐ 서버 렌디션은 부르지 않는다 — 100 × 60 mm 좌표라
     * 80 × 30 mm 라벨지에 맞지 않아 POP 이 직접 짠다(#1344).
     */
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    expect(renditionCalls).toHaveLength(0);
    await waitFor(() => {
      expect(reports).toHaveLength(1);
    });
    await expect(reports[0]?.clone().json()).resolves.toEqual({ outcome: 'SUCCEEDED' });
    expect(await screen.findByText(t.print.summary(1, 0))).toBeInTheDocument();
  });

  it('이미 찍은 자리가 섞이면 사유를 받은 뒤에야 발행한다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    installPrintBridge(vi.fn().mockResolvedValue('/tmp/label.tspl'));

    renderScreen({ writes, issueCounts: { 42: 2 } });

    await chooseWarehouse(user);
    await chooseLocation(user, 'S230-02');
    await clickIssue(user);

    /* 사유를 받기 전에는 한 건도 나가지 않는다 — 나가면 전건이 422 로 실패한다. */
    expect(await screen.findByText(t.reissue.notice(1))).toBeInTheDocument();
    expect(writes).toHaveLength(0);

    await user.click(await screen.findByRole('combobox', { name: t.reissue.reason }));
    await user.click(await screen.findByRole('option', { name: '라벨 훼손' }));
    await user.click(await screen.findByRole('button', { name: t.reissue.confirm }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    await expect(writes[0]?.clone().json()).resolves.toMatchObject({
      reissueReasonCode: 'DAMAGED',
    });
  });

  it('한 건이 인쇄에 실패해도 나머지를 계속 찍고, 실패한 자리를 위치 코드로 짚는다', async () => {
    const user = userEvent.setup();
    const reports: Request[] = [];
    /* 첫 건만 실패시킨다 — 「건별 실패가 정상」이 지켜지는지 잰다. */
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('프린터를 찾을 수 없습니다'))
      .mockResolvedValue('/tmp/label.tspl');
    installPrintBridge(save);

    renderScreen({ reports });

    await chooseWarehouse(user);
    await chooseLocation(user, 'S230-01');
    await chooseLocation(user, 'S230-02');
    await clickIssue(user);

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText(t.print.summary(1, 1))).toBeInTheDocument();
    expect(
      await screen.findByText(t.print.failedAt('S230-01', '프린터를 찾을 수 없습니다')),
    ).toBeInTheDocument();

    /* 실패도 보고한다 — 찍히지 않았다는 사실이 서버에 남아야 재발행 사유가 선다. */
    await waitFor(() => {
      expect(reports).toHaveLength(2);
    });
    await expect(reports[0]?.clone().json()).resolves.toMatchObject({ outcome: 'FAILED' });
  });

  it('인쇄 통로가 없으면 발행만 하고, 인쇄했다고 말하지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    const reports: Request[] = [];
    const renditionCalls: string[] = [];

    /* 통로를 세우지 않는다 — 관리웹 브라우저에서 이 화면을 연 상황이다. */
    renderScreen({ writes, reports, renditionCalls });

    await chooseWarehouse(user);
    await chooseLocation(user, 'S230-01');
    await clickIssue(user);

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    /*
     * ⛔ **통로가 없으면 그리지도 보고하지도 않는다.** 받아 봐야 버릴 바이트이고, 보고하면
     *    나오지 않은 라벨이 나온 것으로 남는다(공유계약 F-6).
     */
    expect(renditionCalls).toHaveLength(0);
    expect(reports).toHaveLength(0);
    expect(await screen.findByText(t.print.noBridge)).toBeInTheDocument();
  });

  it('80 × 30 mm TSPL 을 tspl 형식으로 보내고, QR 에는 위치 코드만 싣는다', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue('/tmp/label.tspl');
    installPrintBridge(save);

    renderScreen({});

    await chooseWarehouse(user);
    await chooseLocation(user, 'S230-02');
    await clickIssue(user);

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });

    const [bytes, , , format] = save.mock.calls[0] as [Uint8Array, string, string, string];
    const command = new TextDecoder().decode(bytes);

    /* ⛔ 형식은 바이트가 정한다 — 셸이 고른 형식을 따라가면 TSPL 이 그림으로 저장된다. */
    expect(format).toBe('tspl');
    expect(command).toContain('SIZE 80 mm,30 mm');
    expect(command).toContain('"WH S230"');
    expect(command).toContain('"S230-02"');
    expect(command).toContain('"S230-02 NAME"');
    expect(command).toContain('"ISSUE NO. 1"');
    expect(command).toMatch(/QRCODE [^\r\n]*,"S230-02"\r\n/u);
  });

  it('발행 이력을 못 물으면 사유와 다시 시도를 보이고, 발행을 열지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ summaryFails: true });

    await chooseWarehouse(user);
    await chooseLocation(user, 'S230-01');

    /*
     * ⛔ **조용히 잠그지 않는다.** 사유가 없으면 작업자는 고른 자리를 앞에 두고 죽은 단추만
     *    누른다 — 기다려도 풀리지 않는 상태다.
     */
    expect(await screen.findByText(t.issue.summaryFailed)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: t.issue.retrySummary })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.issue.action })).toBeDisabled();
  });

  it('서버 렌디션이 실패해도 라벨은 찍힌다 — 렌디션을 부르지 않는다', async () => {
    const user = userEvent.setup();
    const reports: Request[] = [];
    const save = vi.fn().mockResolvedValue('/tmp/label.tspl');
    installPrintBridge(save);

    renderScreen({ reports, renditionFails: true });

    await chooseWarehouse(user);
    await chooseLocation(user, 'S230-01');
    await clickIssue(user);

    await waitFor(() => {
      expect(reports).toHaveLength(1);
    });
    expect(save).toHaveBeenCalledTimes(1);
    await expect(reports[0]?.clone().json()).resolves.toEqual({ outcome: 'SUCCEEDED' });
    expect(await screen.findByText(t.print.summary(1, 0))).toBeInTheDocument();
  });

  /* 세 번째 열은 「상태」 — 모든 줄에 사용 여부를 적는다(사용자 지시 2026-09-18 · omf-all-around#11). */
  it('상태 열에 사용중·미사용을 모든 줄에 적는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseWarehouse(user);

    expect(await screen.findByRole('columnheader', { name: '상태' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '발행' })).not.toBeInTheDocument();

    const stateOf = (locationCode: string): string | undefined => {
      const row = screen.getByText(locationCode).closest('tr');
      return row?.querySelectorAll('td')[2]?.textContent ?? undefined;
    };

    expect(stateOf('S230-01')).toBe('사용중');
    expect(stateOf('S230-02')).toBe('사용중');
    expect(stateOf('S230-03')).toBe('미사용');
  });

  it('사번이 없으면 발행을 열지 않는다', async () => {
    renderWithProviders(<PopLocationLabelScreen />, {
      route: '/pop/location-label',
      fetch: createStubFetch(routes({})),
    });

    expect(await screen.findByText(messages.popChrome.workerMissing)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.issue.action })).toBeDisabled();
  });
});
