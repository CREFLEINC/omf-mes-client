import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  HANDLING_UNIT_ID,
  HANDLING_UNIT_NO,
  ITEM_CODE,
  ITEM_ID,
  LOT_A_ID,
  LOT_A_NO,
  LOT_B_ID,
  LOT_B_NO,
  PROCESS_ID,
  TERMINAL_ID,
  UOM_CODE,
  UOM_ID,
  WORKER_NO,
  handlingUnit,
  lotNoOf,
  makeContent,
  readyPrinter,
} from './fixtures';
import { PackingLabelReprintScreen } from './screen';

const t = messages.packingLabelReprint;

const ENTRY_ROUTE = `/pop/packing-label-reprint?handlingUnitId=${String(HANDLING_UNIT_ID)}&workerNo=${WORKER_NO}`;

/** 단말·공정을 아는 상태. 셸이 채우는 값이라 시험에서는 직접 넣는다. */
const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface Options {
  /** 포장에 담긴 LOT. 둘이면 혼적이다 */
  lotIds?: number[];
  /** 포장 단위 조회가 실패한다 */
  handlingUnitFails?: boolean;
  /** LOT 이름 조회가 실패한다 */
  lotNamesFail?: boolean;
  canPrintLabel?: boolean;
}

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => pathOf(request).startsWith('/mdm/terminals/'),
    respond: () =>
      jsonResponse({
        items: [{ processId: PROCESS_ID, canPrintLabel: options.canPrintLabel ?? true }],
      }),
  },
  {
    match: (request) => pathOf(request) === `/inventory/handling-units/${String(HANDLING_UNIT_ID)}`,
    respond: () => {
      if (options.handlingUnitFails === true) {
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      }

      return jsonResponse({
        handlingUnit,
        contents: (options.lotIds ?? [LOT_A_ID]).map((lotId) => makeContent(lotId)),
      });
    },
  },
  {
    match: (request) => pathOf(request).startsWith('/trace/lots/'),
    respond: (request) => {
      if (options.lotNamesFail === true) {
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      }

      const lotId = Number(pathOf(request).split('/').pop());

      return jsonResponse({
        lot: { lotId, lotNo: lotNoOf[lotId] ?? '', itemId: ITEM_ID },
        externalIdentifiers: [],
        holds: [],
      });
    },
  },
  {
    match: (request) => pathOf(request) === `/mdm/items/${String(ITEM_ID)}`,
    respond: () =>
      jsonResponse({
        item: { itemId: ITEM_ID, itemCode: ITEM_CODE, itemName: '샘플 품목' },
        editability: { editableFields: [] },
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/uoms',
    respond: () =>
      jsonResponse({
        items: [{ uomId: UOM_ID, uomCode: UOM_CODE, uomName: '개', isActive: true }],
        page: { page: 1, size: 20, total: 1 },
      }),
  },
  {
    match: (request) => pathOf(request) === '/app/printers',
    respond: () => jsonResponse({ items: [readyPrinter] }),
  },
];

const renderScreen = (options: Options = {}, route = ENTRY_ROUTE, identity = IDENTIFIED) =>
  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <PackingLabelReprintScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes(options)), route },
  );

describe('P-02-09 포장 라벨·인식표 재출력', () => {
  it('진입한 포장 단위의 번호와 내용물을 이름으로 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(HANDLING_UNIT_NO)).toBeInTheDocument();
    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();
    expect(await screen.findByText(ITEM_CODE)).toBeInTheDocument();
    /* 단위를 받았으면 수량에 붙인다 — 단위 없는 수량과 다른 값이다 */
    expect(await screen.findByText(`100 ${UOM_CODE}`)).toBeInTheDocument();
  });

  it('LOT 이 둘 이상이면 혼적을 경고한다', async () => {
    renderScreen({ lotIds: [LOT_A_ID, LOT_B_ID] });

    expect(await screen.findByText(LOT_B_NO)).toBeInTheDocument();
    expect(screen.getByText(t.handlingUnit.mixedLot(2))).toBeInTheDocument();
  });

  it('LOT 이 하나면 혼적을 경고하지 않는다', async () => {
    renderScreen();

    expect(await screen.findByText(LOT_A_NO)).toBeInTheDocument();
    expect(screen.queryByText(t.handlingUnit.mixedLot(1))).not.toBeInTheDocument();
  });

  it('이름 조회가 실패하면 번호를 대신 찍지 않고 사유를 말한다', async () => {
    renderScreen({ lotNamesFail: true });

    expect(await screen.findByText(t.handlingUnit.namesFailed)).toBeInTheDocument();
    expect(screen.queryByText(String(LOT_A_ID))).not.toBeInTheDocument();
  });

  it('포장 단위 조회가 실패하면 사유를 말한다', async () => {
    renderScreen({ handlingUnitFails: true });

    expect(await screen.findByText(t.handlingUnit.loadFailed)).toBeInTheDocument();
  });

  it('포장 단위를 받지 못하면 사유를 말하고 조회하지 않는다', async () => {
    renderScreen({}, `/pop/packing-label-reprint?workerNo=${WORKER_NO}`);

    expect(await screen.findByText(t.entry.missingHandlingUnit)).toBeInTheDocument();
  });

  it('사번이 없으면 재출력할 수 없다고 말한다', async () => {
    renderScreen({}, `/pop/packing-label-reprint?handlingUnitId=${String(HANDLING_UNIT_ID)}`);

    expect(await screen.findByText(t.entry.missingWorker)).toBeInTheDocument();
  });

  it('단말에 출력 권한이 없으면 사유를 말한다', async () => {
    renderScreen({ canPrintLabel: false });

    await waitFor(() => {
      expect(screen.getByText(t.gate.denied)).toBeInTheDocument();
    });
  });

  it('단말을 모르면 권한을 통과로 처리하지 않는다', async () => {
    renderScreen({}, ENTRY_ROUTE, { terminalId: null, processId: null, workerNo: WORKER_NO });

    expect(await screen.findByText(t.gate.unidentified)).toBeInTheDocument();
  });
});
