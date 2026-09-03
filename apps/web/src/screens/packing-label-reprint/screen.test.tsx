import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  /** 대상별 발행 회차. 기본은 전건 0회(최초 발행) */
  issueCounts?: Record<number, number>;
  /** 발행 요약 조회가 실패한다 */
  summaryFails?: boolean;
  /** 재발행 사유 선택지. 기본 1건 */
  reasons?: {
    codeValueId: number;
    codeGroupId: number;
    code: string;
    codeName: string;
    displayOrder: number;
  }[];
  /** 발행 요청을 담아 둔다 */
  issueWrites?: Request[];
  /** 발행 응답 상태. 기본 201 */
  issueStatus?: number;
  /** 발행 실패 응답 본문 */
  issueErrorBody?: unknown;
}

export const REASON_CODE = 'DAMAGED';
export const REASON_NAME = '훼손';

const defaultReasons = [
  {
    codeValueId: 9001,
    codeGroupId: 900,
    code: REASON_CODE,
    codeName: REASON_NAME,
    displayOrder: 1,
  },
];

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
  {
    match: (request) => pathOf(request) === '/app/document-issues/summary',
    respond: (request) => {
      if (options.summaryFails === true) {
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      }

      /* 배열 질의는 반복 키로도 쉼표로도 실려 온다 — 둘 다 받아 낸다 */
      const params = new URL(request.url).searchParams;
      const ids = [...params.getAll('targetIds'), ...params.getAll('targetIds[]')].flatMap((raw) =>
        raw.split(','),
      );

      return jsonResponse({
        items: ids.map((raw) => ({
          targetTypeCode: 'LOT',
          targetId: Number(raw),
          issueCount: options.issueCounts?.[Number(raw)] ?? 0,
          lastIssuedAt: null,
        })),
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: options.reasons ?? defaultReasons,
        page: { page: 1, size: 100, total: 1 },
      }),
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
    respond: (request) => {
      options.issueWrites?.push(request.clone());

      if (options.issueStatus !== undefined && options.issueStatus >= 400) {
        return jsonResponse(options.issueErrorBody ?? { message: '거부' }, {
          status: options.issueStatus,
        });
      }

      return jsonResponse(
        {
          items: [
            {
              documentIssueLogId: 44001,
              documentTypeCode: 'PACKING_LABEL',
              target: { targetTypeCode: 'LOT', targetId: LOT_A_ID, displayName: LOT_A_NO },
              lotId: LOT_A_ID,
              issueSeq: 1,
              issuedBy: 3101,
              issuedByName: '샘플 작업자',
              issuedAt: '2026-09-03T09:12:30Z',
              printOutcome: 'PENDING',
            },
          ],
          issuedCount: 1,
        },
        { status: 201 },
      );
    },
  },
];

/** 좌단 《포장 단위》 안에서만 찾는다 — 같은 LOT 번호가 우단에도 선다. */
const handlingUnitPane = () => within(screen.getByLabelText(t.handlingUnit.sectionLabel));
const reprintPane = () => within(screen.getByLabelText(t.targets.sectionLabel));

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
    expect(await handlingUnitPane().findByText(LOT_A_NO)).toBeInTheDocument();
    expect(handlingUnitPane().getByText(ITEM_CODE)).toBeInTheDocument();
    /* 단위를 받았으면 수량에 붙인다 — 단위 없는 수량과 다른 값이다 */
    expect(handlingUnitPane().getByText(`100 ${UOM_CODE}`)).toBeInTheDocument();
  });

  it('LOT 이 둘 이상이면 혼적을 경고한다', async () => {
    renderScreen({ lotIds: [LOT_A_ID, LOT_B_ID] });

    expect(await handlingUnitPane().findByText(LOT_B_NO)).toBeInTheDocument();
    expect(screen.getByText(t.handlingUnit.mixedLot(2))).toBeInTheDocument();
  });

  it('LOT 이 하나면 혼적을 경고하지 않는다', async () => {
    renderScreen();

    expect(await handlingUnitPane().findByText(LOT_A_NO)).toBeInTheDocument();
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

describe('P-02-09 재출력 대상·실행', () => {
  const selectLabel = (lotNo: string) => `${t.targets.packingLabel} ${lotNo} ${t.targets.select}`;

  it('대상마다 포장 라벨과 인식표 두 줄이 서고 인식표는 고를 수 없다', async () => {
    renderScreen();

    const tagButton = await reprintPane().findByRole('button', {
      name: `${t.targets.identificationTag} ${LOT_A_NO} ${t.targets.select}`,
    });

    expect(tagButton).toBeDisabled();
    expect(reprintPane().getByText(t.targets.serialUnavailable)).toBeInTheDocument();
  });

  it('발행 회차를 요약 한 번으로 채운다 — 줄마다 부르지 않는다', async () => {
    renderScreen({ lotIds: [LOT_A_ID, LOT_B_ID], issueCounts: { [LOT_A_ID]: 2 } });

    expect(await reprintPane().findByText(t.targets.issueCount(2))).toBeInTheDocument();
    /* 이력이 없는 대상은 「0회」가 아니라 「없음」으로 말한다 */
    expect(reprintPane().getAllByText(t.targets.neverIssued).length).toBeGreaterThan(0);
  });

  it('요약을 못 받으면 회차를 0 으로 찍지 않고 사유를 말한다', async () => {
    renderScreen({ summaryFails: true });

    expect(await reprintPane().findByText(t.targets.summaryFailed)).toBeInTheDocument();
    expect(reprintPane().getAllByText(t.targets.issueCountUnknown).length).toBeGreaterThan(0);
  });

  it('대상을 고르지 않으면 재출력이 비활성이다', async () => {
    renderScreen();

    await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) });

    expect(screen.getByRole('button', { name: t.action.submit })).toBeDisabled();
  });

  it('이미 발행된 대상을 고르면 사유가 필요하고, 고르기 전에는 재출력이 비활성이다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueCounts: { [LOT_A_ID]: 1 } });

    await user.click(await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) }));

    expect(reprintPane().getByText(t.reason.required)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.action.submit })).toBeDisabled();
  });

  it('이력이 없는 대상만 고르면 사유 없이 재출력하고, 신규 기록에 사유를 싣지 않는다', async () => {
    const user = userEvent.setup();
    const issueWrites: Request[] = [];
    renderScreen({ issueWrites });

    await user.click(await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) }));

    const submit = screen.getByRole('button', { name: t.action.submit });
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    const body = (await issueWrites[0]!.json()) as {
      documentTypeCode: string;
      targets: { targetTypeCode: string; targetId: number; lotId: number }[];
      reissueReasonCode?: string;
    };

    expect(body.documentTypeCode).toBe('PACKING_LABEL');
    expect(body.targets).toEqual([{ targetTypeCode: 'LOT', targetId: LOT_A_ID, lotId: LOT_A_ID }]);
    expect(body.reissueReasonCode).toBeUndefined();
  });

  it('쓰기에 사번 헤더를 싣는다 — 없으면 서버가 거부한다', async () => {
    const user = userEvent.setup();
    const issueWrites: Request[] = [];
    renderScreen({ issueWrites });

    await user.click(await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) }));
    await user.click(screen.getByRole('button', { name: t.action.submit }));

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    expect(issueWrites[0]!.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(issueWrites[0]!.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('셸이 없으면 발행까지만 하고 그 사실을 말한다 — 발행 실패로 말하지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) }));
    await user.click(screen.getByRole('button', { name: t.action.submit }));

    expect(await screen.findByText(t.print.shellUnavailable)).toBeInTheDocument();
    expect(screen.queryByText(t.error.issueTitle)).not.toBeInTheDocument();
  });

  it('발행이 거부되면 사유를 보이고 대상 선택은 남는다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueStatus: 403 });

    await user.click(await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) }));
    await user.click(screen.getByRole('button', { name: t.action.submit }));

    expect(await screen.findByText(t.error.forbidden)).toBeInTheDocument();
    expect(reprintPane().getByRole('button', { name: selectLabel(LOT_A_NO) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('사유 목록이 비면 칸을 감추지 않고 비활성 + 사유로 둔다', async () => {
    renderScreen({ reasons: [] });

    expect(await reprintPane().findByText(t.reason.empty)).toBeInTheDocument();
    expect(reprintPane().getByLabelText(t.reason.label)).toBeDisabled();
  });

  /*
   * ⭐ **이 화면의 주 흐름이다** — 재발행이 정상 경로다(스펙 §5-1). 「사유를 싣지 않는다」만
   * 검사하면 사유가 «실리는» 자리가 통째로 비어도 시험이 통과한다.
   */
  it('이미 발행된 대상을 고르고 사유를 고르면 그 사유가 실려 나간다', async () => {
    const user = userEvent.setup();
    const issueWrites: Request[] = [];
    renderScreen({ issueCounts: { [LOT_A_ID]: 2 }, issueWrites });

    await user.click(await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) }));
    await user.click(reprintPane().getByLabelText(t.reason.label));
    await user.click(screen.getByRole('option', { name: REASON_NAME }));

    const submit = screen.getByRole('button', { name: t.action.submit });
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    const body = (await issueWrites[0]!.json()) as { reissueReasonCode?: string };
    expect(body.reissueReasonCode).toBe(REASON_CODE);
  });

  it('단말에 출력 권한이 없으면 대상을 골라도 재출력이 잠긴다', async () => {
    const user = userEvent.setup();
    renderScreen({ canPrintLabel: false });

    await user.click(await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) }));

    expect(screen.getByRole('button', { name: t.action.submit })).toBeDisabled();
  });

  it('사번이 없으면 대상을 골라도 재출력이 잠긴다', async () => {
    const user = userEvent.setup();
    renderScreen({}, `/pop/packing-label-reprint?handlingUnitId=${String(HANDLING_UNIT_ID)}`);

    await user.click(await reprintPane().findByRole('button', { name: selectLabel(LOT_A_NO) }));

    expect(screen.getByRole('button', { name: t.action.submit })).toBeDisabled();
  });
});
