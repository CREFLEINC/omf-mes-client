import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
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
  REASON_CODE,
  REASON_NAME,
  TERMINAL_ID,
  WORKER_NO,
  WORK_ORDER_ID,
  lotDetailResponse,
  makeLot,
  makeProgress,
  makeReason,
} from './fixtures';
import { ProductionLotCompleteScreen } from './screen';
import type { LotProgress } from './types';

const t = messages.productionLotComplete;

const ENTRY_ROUTE = `/pop/lot-complete?workOrderId=${String(WORK_ORDER_ID)}`;

/** 단말·공정·사번을 아는 상태. 셸이 채우는 값이라 시험에서는 직접 넣는다. */
const IDENTIFIED: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: WORKER_NO,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

interface Options {
  /** 단말 기능 구성의 완료 플래그. `undefined` 면 **키 자체가 없는** 응답을 만든다 */
  canCompleteWork?: boolean;
  /** 플래그 키를 아예 싣지 않는다 — 「없으면 닫힘」을 재는 자리 */
  omitFlag?: boolean;
  /** 게이팅 조회가 실패한다 */
  gateFails?: boolean;
  /** 이 공정의 기능 구성 행이 아예 없다 */
  noProcessRow?: boolean;
  /** 상세가 내리는 진척. `null` 이면 진척 없이 온다 */
  progress?: LotProgress | null;
  /** 상세 응답에 완료 시각이 실린다 */
  completedAt?: string;
  /** 상세 응답에 실을 ETag. 기본은 실린다 */
  etag?: string | null;
  /** 사유 목록 조회가 실패한다 */
  reasonsFail?: boolean;
  /** 완료 요청을 담아 둔다 */
  writes?: Request[];
  /** 완료 응답 상태. 기본 200 */
  writeStatus?: number;
  /** 목록이 비어 온다 — 빈 목록 문구를 재는 자리 */
  emptyLots?: boolean;
}

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
        items: [
          {
            processId: PROCESS_ID,
            /* ⛔ 플래그가 «없는» 응답도 만든다 — 8개 불리언은 required 가 아니다 */
            ...(options.omitFlag === true
              ? {}
              : { canCompleteWork: options.canCompleteWork ?? true }),
          },
        ],
      });
    },
  },
  {
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: () =>
      options.reasonsFail === true
        ? jsonResponse({ message: '조회 실패' }, { status: 500 })
        : jsonResponse({ items: [makeReason()], page: { page: 1, size: 200, total: 1 } }),
  },
  {
    match: (request) => request.method === 'GET' && pathOf(request) === '/trace/lots',
    respond: () =>
      options.emptyLots === true
        ? jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } })
        : jsonResponse({ items: [makeLot()], page: { page: 1, size: 20, total: 1 } }),
  },
  {
    match: (request) => request.method === 'GET' && /^\/trace\/lots\/\d+$/.test(pathOf(request)),
    respond: () =>
      jsonResponse(
        lotDetailResponse(
          options.progress === undefined ? makeProgress(480, 'UNDER') : options.progress,
          options.completedAt === undefined ? {} : { completedAt: options.completedAt },
        ),
        { headers: options.etag === null ? {} : { ETag: options.etag ?? '"7"' } },
      ),
  },
  {
    match: (request) => request.method === 'POST' && /:complete$/.test(pathOf(request)),
    respond: (request) => {
      options.writes?.push(request.clone());

      const status = options.writeStatus ?? 200;

      if (status !== 200) return jsonResponse({ message: '완료 거부' }, { status });

      return jsonResponse(makeLot({ completedAt: '2026-09-02T10:22:00+09:00' }));
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
      <ProductionLotCompleteScreen />
    </PopIdentityProvider>,
    { fetch: createStubFetch(routes(options)), route },
  );

const selectLot = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = await screen.findByRole('button', { name: `${LOT_NO} ${t.lotList.select}` });
  await user.click(button);
};

const completeButton = () => screen.getByRole('button', { name: t.action.complete });
const closeUnderButton = () => screen.getByRole('button', { name: t.action.closeUnder });

const chooseReason = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('combobox', { name: t.reason.label }));
  await user.click(await screen.findByRole('option', { name: REASON_NAME }));
};

describe('ProductionLotCompleteScreen — 단말 게이팅', () => {
  it('완료 권한이 없으면 두 버튼을 모두 막고 사유를 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ canCompleteWork: false });

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
    await selectLot(user);

    expect(completeButton()).toBeDisabled();
    expect(closeUnderButton()).toBeDisabled();
  });

  /** ⛔ 「없음」을 「통과」로 다루지 않는다 — 8개 불리언은 required 가 아니다. */
  it('플래그가 응답에 없으면 닫힘으로 다룬다', async () => {
    const user = userEvent.setup();
    renderScreen({ omitFlag: true });

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
    await selectLot(user);

    expect(completeButton()).toBeDisabled();
  });

  it('이 공정의 행이 없으면 닫힘으로 다룬다', async () => {
    const user = userEvent.setup();
    renderScreen({ noProcessRow: true });

    expect(await screen.findByText(t.gate.denied)).toBeInTheDocument();
    await selectLot(user);

    expect(completeButton()).toBeDisabled();
  });

  /** ⛔ 조회 실패를 통과로 처리하지 않는다(F-6). 문구도 「없습니다」와 구분한다. */
  it('게이팅 조회가 실패하면 「확인할 수 없다」로 막고 다시 시도를 준다', async () => {
    renderScreen({ gateFails: true });

    expect(await screen.findByText(t.gate.unavailable)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.gate.retry })).toBeInTheDocument();
  });

  it('단말을 모르면 막고 사유를 말한다', async () => {
    renderScreen({}, ENTRY_ROUTE, { terminalId: null, processId: null, workerNo: WORKER_NO });

    expect(await screen.findByText(t.gate.unidentified)).toBeInTheDocument();
  });
});

describe('ProductionLotCompleteScreen — 완료 판정', () => {
  it('목표를 채우면 완료만 열린다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(500, 'NORMAL') });

    await selectLot(user);

    await waitFor(() => {
      expect(completeButton()).toBeEnabled();
    });
    expect(closeUnderButton()).toBeDisabled();
  });

  /** §5-4 · R27 — 계획값은 상한이 아니다. */
  it('초과 달성도 완료를 막지 않고 안내를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(520, 'OVER') });

    await selectLot(user);

    await waitFor(() => {
      expect(completeButton()).toBeEnabled();
    });
    expect(screen.getByText(t.judgment.overNotice)).toBeInTheDocument();
  });

  it('미달이면 사유를 고르기 전까지 두 버튼이 모두 막힌다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(480, 'UNDER') });

    await selectLot(user);

    await waitFor(() => {
      expect(screen.getByText(t.judgment.under)).toBeInTheDocument();
    });
    expect(completeButton()).toBeDisabled();
    expect(closeUnderButton()).toBeDisabled();
  });

  it('미달 사유를 고르면 미달 마감만 열린다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(480, 'UNDER') });

    await selectLot(user);
    await chooseReason(user);

    await waitFor(() => {
      expect(closeUnderButton()).toBeEnabled();
    });
    expect(completeButton()).toBeDisabled();
  });

  /** §6 — 아무것도 안 만든 LOT 은 마감할 것이 없다. */
  it('누적 양품이 0 이면 두 버튼이 모두 막힌다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(0, 'UNDER') });

    await selectLot(user);

    await waitFor(() => {
      expect(screen.getByText(t.blocked.nothingProduced)).toBeInTheDocument();
    });
    expect(completeButton()).toBeDisabled();
    expect(closeUnderButton()).toBeDisabled();
  });

  /** ⛔ 「모른다」를 「통과」로 다루지 않는다 — 완료는 되돌릴 수 없다. */
  it('진척을 받지 못하면 막고 사유를 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: null });

    await selectLot(user);

    expect(await screen.findByText(t.detail.progressUnavailable)).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
    expect(closeUnderButton()).toBeDisabled();
  });

  it('이미 완료된 LOT 은 막고 사유를 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({
      progress: makeProgress(500, 'NORMAL'),
      completedAt: '2026-09-01T10:00:00+09:00',
    });

    await selectLot(user);

    expect(await screen.findByText(t.blocked.alreadyCompleted)).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
  });

  it('사번이 없으면 막고 사번 인증을 먼저 하라고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(500, 'NORMAL') }, ENTRY_ROUTE, {
      terminalId: TERMINAL_ID,
      processId: PROCESS_ID,
      workerNo: null,
    });

    await selectLot(user);

    expect(await screen.findByText(t.blocked.missingWorker)).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();
  });

  /** 사유를 고를 수 없으면 미달 마감을 열지 않는다 — 필수 칸이 빈 채로 나간다. */
  it('사유 목록을 못 받으면 미달 마감을 열지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(480, 'UNDER'), reasonsFail: true });

    await selectLot(user);

    expect(await screen.findByText(t.reason.loadFailed)).toBeInTheDocument();
    expect(closeUnderButton()).toBeDisabled();
  });
});

describe('ProductionLotCompleteScreen — 완료 쓰기', () => {
  it('완료 처리는 사유 없이 보내고 멱등 키·사번·잠금 토큰을 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ progress: makeProgress(500, 'NORMAL'), writes });

    await selectLot(user);
    await waitFor(() => {
      expect(completeButton()).toBeEnabled();
    });
    await user.click(completeButton());

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0];

    if (request === undefined) throw new Error('완료 요청이 없습니다.');

    expect(request.headers.get('X-Worker-No')).toBe(WORKER_NO);
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
    /* 상세가 남긴 토큰을 그대로 싣는다 — 동시 완료를 서버가 가른다(B-1) */
    expect(request.headers.get('If-Match')).toBe('"7"');

    const body = (await request.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty('completionVarianceReasonCode');
    expect(body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.occurredAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('미달 마감은 고른 사유를 싣는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ progress: makeProgress(480, 'UNDER'), writes });

    await selectLot(user);
    await chooseReason(user);
    await waitFor(() => {
      expect(closeUnderButton()).toBeEnabled();
    });
    await user.click(closeUnderButton());

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const request = writes[0];

    if (request === undefined) throw new Error('미달 마감 요청이 없습니다.');

    const body = (await request.json()) as Record<string, unknown>;

    expect(body.completionVarianceReasonCode).toBe(REASON_CODE);
  });

  /**
   * ⛔ **토큰이 없다고 멈추지 않는다.** 계약이 이 오퍼레이션의 `If-Match` 를 선택으로 두었다 —
   * 오프라인 큐가 토큰을 싣지 못하기 때문이다(C-9). 없으면 그대로 보낸다.
   */
  it('잠금 토큰이 없으면 헤더 없이 보낸다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ progress: makeProgress(500, 'NORMAL'), etag: null, writes });

    await selectLot(user);
    await waitFor(() => {
      expect(completeButton()).toBeEnabled();
    });
    await user.click(completeButton());

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    expect(writes[0]?.headers.get('If-Match')).toBeNull();
  });

  it('완료하면 결과를 알린다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(500, 'NORMAL') });

    await selectLot(user);
    await waitFor(() => {
      expect(completeButton()).toBeEnabled();
    });
    await user.click(completeButton());

    expect(await screen.findByText(t.result.completed)).toBeInTheDocument();
  });

  /** ⛔ 409 에 「다시 시도」를 주지 않는다 — 같은 토큰으로 다시 보내면 또 막힌다. */
  it('충돌이면 다시 불러오기를 준다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(500, 'NORMAL'), writeStatus: 409 });

    await selectLot(user);
    await waitFor(() => {
      expect(completeButton()).toBeEnabled();
    });
    await user.click(completeButton());

    expect(await screen.findByText(t.error.conflict)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.error.reload })).toBeInTheDocument();
  });

  it('권한 거부에는 다시 시도를 주지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ progress: makeProgress(500, 'NORMAL'), writeStatus: 403 });

    await selectLot(user);
    await waitFor(() => {
      expect(completeButton()).toBeEnabled();
    });
    await user.click(completeButton());

    expect(await screen.findByText(t.error.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});

describe('ProductionLotCompleteScreen — 목록', () => {
  it('작업지시가 없으면 사유를 말한다', async () => {
    renderScreen({}, '/pop/lot-complete');

    expect(await screen.findByText(t.entry.missingWorkOrder)).toBeInTheDocument();
  });

  /**
   * ⛔ **빈 목록이 위쪽 띠와 다른 이야기를 하지 않는다.** 작업지시가 없는데 「이 작업지시에
   * 완료할 LOT 이 없습니다」라고 하면, 사용자는 작업지시가 있는데 LOT 만 없는 것으로 읽는다
   * (실측 — 사용자 확인에서 잡혔다).
   */
  it('작업지시가 없으면 빈 목록이 「이 작업지시에」라고 말하지 않는다', async () => {
    renderScreen({}, '/pop/lot-complete');

    expect(await screen.findByText(t.lotList.emptyNoWorkOrder)).toBeInTheDocument();
    expect(screen.queryByText(t.lotList.empty)).not.toBeInTheDocument();
  });

  it('작업지시가 있으면 빈 목록이 그 작업지시를 가리킨다', async () => {
    renderScreen({ emptyLots: true });

    expect(await screen.findByText(t.lotList.empty)).toBeInTheDocument();
    expect(screen.queryByText(t.lotList.emptyNoWorkOrder)).not.toBeInTheDocument();
  });

  /**
   * ⛔ **슬롯 안내가 무엇을 가리키는지 말하게 한다.** 수 없이 「계획값이며 상한이 아닙니다」만
   * 두면 사용자가 뜻을 잡지 못한다(실측 — 사용자 확인에서 잡혔다).
   */
  it('슬롯 안내가 남은 LOT 수를 함께 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.lotList.slotNotice(1))).toBeInTheDocument();
  });

  it('셀 LOT 이 없으면 슬롯 안내를 내지 않는다', async () => {
    renderScreen({ emptyLots: true });

    await screen.findByText(t.lotList.empty);

    expect(screen.queryByText(t.lotList.slotNotice(0))).not.toBeInTheDocument();
  });

  /** ⚠ 목록 조회에 진척 질의가 없다 — 비워 두고 사유를 말한다(`omf-mes#399` 3번). */
  it('목록의 양품 열은 비우고 사유를 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.lotList.goodQtyPending)).toBeInTheDocument();
  });

  it('완료되지 않은 LOT 만 조회한다', async () => {
    const seen: string[] = [];
    renderWithProviders(
      <PopIdentityProvider value={IDENTIFIED}>
        <ProductionLotCompleteScreen />
      </PopIdentityProvider>,
      {
        fetch: createStubFetch([
          {
            match: (request) => {
              if (request.method === 'GET' && pathOf(request) === '/trace/lots') {
                seen.push(new URL(request.url).search);

                return true;
              }

              return false;
            },
            respond: () => jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } }),
          },
          ...routes({}),
        ]),
        route: ENTRY_ROUTE,
      },
    );

    await waitFor(() => {
      expect(seen).toHaveLength(1);
    });

    expect(seen[0]).toContain('completed=false');
    expect(seen[0]).toContain(`workOrderId=${String(WORK_ORDER_ID)}`);
    /* ⛔ 값 목록이 확정되지 않은 축을 얹으면 목록이 조용히 빈다 */
    expect(seen[0]).not.toContain('statusCode');
    expect(seen[0]).not.toContain('lotTypeCode');
  });
});
