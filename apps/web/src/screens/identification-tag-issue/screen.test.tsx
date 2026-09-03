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
  LOT_NO,
  PROCESS_ID,
  TERMINAL_ID,
  WORKER_NO,
  WORK_ORDER_ID,
  lotWithProgress,
  makeIssue,
  makeLot,
  makeSerial,
  readyPrinter,
} from './fixtures';
import { IdentificationTagIssueScreen } from './screen';
import type { Printer } from './types';

const t = messages.identificationTagIssue;

const ENTRY_ROUTE = `/pop/tag-issue?workOrderId=${String(WORK_ORDER_ID)}&workerNo=${WORKER_NO}`;

/** 단말·공정을 아는 상태. 셸이 채우는 값이라 시험에서는 직접 넣는다. */
const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface Options {
  /** 단말 기능 구성의 라벨 발행 플래그 */
  canPrintLabel?: boolean;
  /** 게이팅 조회가 실패한다 */
  gateFails?: boolean;
  /** 이 공정의 기능 구성 행이 아예 없다 */
  noProcessRow?: boolean;
  /** 프린터 조회가 실패한다 */
  printersFail?: boolean;
  /** 돌려줄 프린터 목록. 기본은 준비된 프린터 한 대 */
  printers?: Printer[];
  goodQty?: number | null;
  issuedCount?: number;
  /** 발번 요청을 담아 둔다 */
  serialWrites?: Request[];
  /** 발행 기록 요청을 담아 둔다 */
  issueWrites?: Request[];
  /** 발번 응답 상태. 기본 201 */
  serialStatus?: number;
  /** 발행 기록 응답 상태. 기본 201 */
  issueStatus?: number;
  /** 발번 실패 응답의 본문 — 서버가 준 사유를 화면이 어떻게 다루는지 본다 */
  serialErrorBody?: unknown;
  /** 발행 기록 실패 응답의 본문 */
  issueErrorBody?: unknown;
}

const SERIAL_COUNT = 3;

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => pathOf(request).startsWith('/mdm/terminals/'),
    respond: () => {
      if (options.gateFails === true) {
        return jsonResponse({ message: '조회 실패' }, { status: 500 });
      }

      /* 이 공정의 구성 자체가 없는 상태 — 「없음」과 「닫힘」이 같아야 한다 */
      if (options.noProcessRow === true) return jsonResponse({ items: [] });

      return jsonResponse({
        items: [{ processId: PROCESS_ID, canPrintLabel: options.canPrintLabel ?? true }],
      });
    },
  },
  {
    match: (request) => request.method === 'GET' && pathOf(request) === '/trace/lots',
    respond: () => jsonResponse({ items: [makeLot()], page: { page: 1, size: 20, total: 1 } }),
  },
  {
    match: (request) => request.method === 'GET' && /^\/trace\/lots\/\d+$/.test(pathOf(request)),
    respond: () =>
      jsonResponse({
        ...lotWithProgress(options.goodQty === undefined ? 480 : options.goodQty),
        externalIdentifiers: [],
        holds: [],
      }),
  },
  {
    match: (request) => request.method === 'GET' && pathOf(request) === '/trace/serial-numbers',
    respond: () =>
      jsonResponse({
        items: [],
        page: { page: 1, size: 1, total: options.issuedCount ?? 200 },
      }),
  },
  {
    match: (request) => pathOf(request) === '/app/printers',
    respond: () =>
      options.printersFail === true
        ? jsonResponse({ message: '조회 실패' }, { status: 500 })
        : jsonResponse({ items: options.printers ?? [readyPrinter] }),
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request) === '/trace/serial-numbers',
    respond: (request) => {
      options.serialWrites?.push(request.clone());

      if (options.serialStatus !== undefined && options.serialStatus !== 201) {
        return jsonResponse(options.serialErrorBody ?? { message: '발번 거부' }, {
          status: options.serialStatus,
        });
      }

      const items = Array.from({ length: SERIAL_COUNT }, (_unused, index) => makeSerial(index + 1));

      return jsonResponse({ items, issuedCount: items.length }, { status: 201 });
    },
  },
  {
    match: (request) => request.method === 'POST' && pathOf(request) === '/app/document-issues',
    respond: (request) => {
      options.issueWrites?.push(request.clone());

      if (options.issueStatus !== undefined && options.issueStatus !== 201) {
        return jsonResponse(options.issueErrorBody ?? { message: '발행 기록 거부' }, {
          status: options.issueStatus,
        });
      }

      const items = Array.from({ length: SERIAL_COUNT }, (_unused, index) => makeIssue(index + 1));

      return jsonResponse({ items, issuedCount: items.length }, { status: 201 });
    },
  },
];

const renderScreen = (
  options: Options = {},
  route: string = ENTRY_ROUTE,
  identity: PopIdentity = IDENTIFIED,
) =>
  renderWithProviders(
    <PopIdentityProvider value={identity}>
      <IdentificationTagIssueScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes(options)), route },
  );

const selectLot = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = await screen.findByRole('button', { name: `${LOT_NO} ${t.lotList.select}` });
  await user.click(button);
};

const quantityField = () =>
  screen.getByLabelText(`${t.issue.quantityLabel} (${t.issue.quantityUnit})`);

const submitButton = () => screen.getByRole('button', { name: t.issue.submit });

describe('IdentificationTagIssueScreen — 단말 게이팅', () => {
  it('발행 권한이 없으면 발행을 막고 사유를 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ canPrintLabel: false });

    await selectLot(user);

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('게이팅을 «확인할 수 없으면» 권한 없음과 다르게 말한다 — 모르는 것을 통과로 치지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ gateFails: true });

    await selectLot(user);

    expect(await screen.findByText(t.gate.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(t.gate.denied)).not.toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('이 공정의 기능 구성 행이 없으면 닫힘으로 다룬다 — 구성되지 않은 공정은 열려 있지 않다', async () => {
    const user = userEvent.setup();
    renderScreen({ noProcessRow: true });

    await selectLot(user);

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('단말을 모르면 발행을 열지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({}, ENTRY_ROUTE, { terminalId: null, processId: null, workerNo: WORKER_NO });

    await selectLot(user);

    expect(await screen.findByText(t.gate.unidentified)).toBeInTheDocument();
  });

  it('사번이 없으면 발행하지 않는다 — 서버가 거부할 쓰기를 만들지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({}, `/pop/tag-issue?workOrderId=${String(WORK_ORDER_ID)}`);

    await selectLot(user);

    expect(await screen.findByText(t.entry.missingWorker)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });
});

describe('IdentificationTagIssueScreen — 장비 상태', () => {
  it('프린터를 확인하지 못하면 사유만 말한다 — 이름표를 앞에 덧대지 않는다', async () => {
    renderScreen({ printersFail: true });

    expect(await screen.findByText(t.device.printerUnknown)).toBeInTheDocument();
    expect(screen.queryByText(`${t.device.printerLabel} ${t.device.printerUnknown}`)).toBeNull();
  });

  it('쓸 수 있는 프린터가 없으면 없다고 말한다', async () => {
    renderScreen({ printers: [] });

    expect(await screen.findByText(t.device.printerNone)).toBeInTheDocument();
  });

  it('프린터가 있으면 이름표와 이름을 함께 세운다', async () => {
    renderScreen();

    expect(
      await screen.findByText(`${t.device.printerLabel} ${readyPrinter.displayName}`),
    ).toBeInTheDocument();
  });
});

describe('IdentificationTagIssueScreen — 서버가 준 사유', () => {
  it('수량 칸에 붙은 서버 오류를 인라인으로 낸다 — 어디에도 안 나오는 오류를 만들지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      serialStatus: 400,
      serialErrorBody: {
        errors: [
          {
            scope: 'field',
            field: 'quantity',
            code: 'OVER_LIMIT',
            message: '미발행 양품 수를 넘습니다',
          },
        ],
      },
    });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    expect(await screen.findByText('미발행 양품 수를 넘습니다')).toBeInTheDocument();
  });

  it('화면에 칸이 없는 오류는 배너로 올린다 — 삼키지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      issueStatus: 422,
      issueErrorBody: {
        errors: [
          {
            scope: 'field',
            field: 'reissueReasonCode',
            code: 'REQUIRED',
            message: '재발행 사유가 필요합니다',
          },
        ],
      },
    });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    expect(await screen.findByText(t.result.serialsOnlyTitle)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('재발행 사유가 필요합니다');
  });

  it('400 은 다시 시도를 두지 않는다 — 값이 그대로면 답도 그대로다', async () => {
    const user = userEvent.setup();
    renderScreen({ serialStatus: 400 });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    const banner = await screen.findByRole('alert');
    expect(within(banner).queryByRole('button', { name: messages.common.retry })).toBeNull();
  });

  it('500 은 다시 시도를 둔다 — 같은 요청이 다음에 통할 수 있다', async () => {
    const user = userEvent.setup();
    renderScreen({ serialStatus: 500 });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });
});

describe('IdentificationTagIssueScreen — 대상 LOT 과 미발행 양품', () => {
  it('목록의 양품 열을 채우지 못하는 사유를 보인다 — 비운 칸을 말없이 두지 않는다', async () => {
    renderScreen();

    expect(await screen.findByText(t.lotList.goodQtyPending)).toBeInTheDocument();
  });

  it('고른 LOT 의 양품·기발행·미발행을 세운다', async () => {
    const user = userEvent.setup();
    renderScreen({ goodQty: 480, issuedCount: 200 });

    await selectLot(user);

    const unissued = await screen.findByText(`280 ${t.issue.countUnit}`);
    expect(unissued).toBeInTheDocument();
    expect(screen.getByText(`480 ${t.issue.countUnit}`)).toBeInTheDocument();
    expect(screen.getByText(`200 ${t.issue.countUnit}`)).toBeInTheDocument();
  });

  it('양품 누계를 받지 못하면 «확인할 수 없음»이라 말하고 발행을 막는다 — 0으로 치지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ goodQty: null });

    await selectLot(user);

    await waitFor(() => {
      expect(screen.getAllByText(t.issue.unknownValue).length).toBeGreaterThan(0);
    });

    await user.type(quantityField(), '10');

    expect(await screen.findByText(t.quantity.unknownUnissued)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('미발행 양품보다 많이 치면 인라인으로 막는다', async () => {
    const user = userEvent.setup();
    renderScreen({ goodQty: 480, issuedCount: 200 });

    await selectLot(user);
    await user.type(quantityField(), '281');

    expect(await screen.findByText(t.quantity.exceedsUnissued)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('발행 «전»에는 번호를 그리지 않는다 — 서버가 매기는 값을 지어내지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);

    expect(await screen.findByText(t.preview.beforeIssue)).toBeInTheDocument();
  });
});

describe('IdentificationTagIssueScreen — 발행 두 걸음', () => {
  it('개체를 먼저 만들고 그 개체로 발행 기록을 만든다 — 순서가 강제된다', async () => {
    const user = userEvent.setup();
    const serialWrites: Request[] = [];
    const issueWrites: Request[] = [];
    renderScreen({ serialWrites, issueWrites });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    expect(serialWrites).toHaveLength(1);
    expect(await serialWrites[0]?.json()).toEqual({ lotId: 90101, quantity: 3 });

    const issueBody = (await issueWrites[0]?.json()) as {
      documentTypeCode: string;
      targets: { targetId: number; lotId: number }[];
    };
    expect(issueBody.targets).toHaveLength(3);
    expect(issueBody.targets[0]?.targetId).toBe(770001);
  });

  it('쓰기 둘 다에 사번 헤더를 싣는다 — 없으면 서버가 거부한다', async () => {
    const user = userEvent.setup();
    const serialWrites: Request[] = [];
    const issueWrites: Request[] = [];
    renderScreen({ serialWrites, issueWrites });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    await waitFor(() => {
      expect(issueWrites).toHaveLength(1);
    });

    expect(serialWrites[0]?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(issueWrites[0]?.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(serialWrites[0]?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('발번이 실패하면 발행 기록을 부르지 않는다', async () => {
    const user = userEvent.setup();
    const issueWrites: Request[] = [];
    renderScreen({ serialStatus: 409, issueWrites });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    expect(await screen.findByText(t.error.duplicateSerial)).toBeInTheDocument();
    expect(issueWrites).toHaveLength(0);
  });

  it('일련번호가 겹치면(409) 다시 시도할 경로를 준다 — 번호를 서버가 매기므로 고칠 값이 없다', async () => {
    const user = userEvent.setup();
    renderScreen({ serialStatus: 409 });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    const banner = await screen.findByRole('alert');
    expect(within(banner).getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('출력 권한이 없으면(403) 다시 시도를 두지 않는다 — 같은 답이 온다', async () => {
    const user = userEvent.setup();
    renderScreen({ serialStatus: 403 });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    expect(await screen.findByText(t.error.forbidden)).toBeInTheDocument();
    const banner = screen.getByRole('alert');
    expect(within(banner).queryByRole('button', { name: messages.common.retry })).toBeNull();
  });
});

describe('IdentificationTagIssueScreen — ①만 성공한 상태', () => {
  it('개체는 만들어졌고 발행 기록이 없으면 그 사실을 그린다', async () => {
    const user = userEvent.setup();
    renderScreen({ issueStatus: 500 });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    expect(await screen.findByText(t.result.serialsOnlyTitle)).toBeInTheDocument();
    /* 서버가 준 사유가 이 배너 안으로 접혀 들어온다 — 실패 배너를 따로 세우지 않는다. */
    expect(screen.getByRole('alert')).toHaveTextContent(t.result.serialsOnlyBody);
  });

  it('다시 시도가 개체를 다시 만들지 않는다 — 번호에 구멍을 내지 않는다', async () => {
    const user = userEvent.setup();
    const serialWrites: Request[] = [];
    const issueWrites: Request[] = [];
    renderScreen({ issueStatus: 500, serialWrites, issueWrites });

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    await screen.findByText(t.result.serialsOnlyTitle);
    expect(serialWrites).toHaveLength(1);
    expect(issueWrites).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: t.result.retryDocuments }));

    await waitFor(() => {
      expect(issueWrites).toHaveLength(2);
    });
    expect(serialWrites).toHaveLength(1);
  });

  it('발행이 끝나면 서버가 매긴 번호 범위를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    expect(
      await screen.findByText(`SN-SAMPLE-0001${t.preview.rangeSeparator}SN-SAMPLE-0003`),
    ).toBeInTheDocument();
  });

  it('셸 밖에서는 인쇄만 못 한다고 말한다 — 발행이 실패한 것이 아니다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);
    await user.type(quantityField(), '3');
    await user.click(submitButton());

    expect(await screen.findByText(t.print.shellUnavailable)).toBeInTheDocument();
  });
});

describe('IdentificationTagIssueScreen — 재인쇄', () => {
  it('사유 값 목록이 없어 재인쇄를 진행할 수 없다고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await selectLot(user);
    await user.click(screen.getByRole('button', { name: t.issue.reissue }));

    expect(await screen.findByText(t.reissueDialog.reasonPending)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.reissueDialog.confirm })).toBeDisabled();
  });
});
