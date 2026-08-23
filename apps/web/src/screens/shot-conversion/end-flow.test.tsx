import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  businessUnitsResponse,
  effectiveResponse,
  enabledListResponse,
  itemsResponse,
  moldListResponse,
  makeRatio,
  plantsResponse,
  policyCodeOf,
  processesResponse,
  ratioListResponse,
} from './fixtures';
import { ShotConversionScreen } from './screen';
import type { OperationPolicy } from './types';

const t = messages.shotConversion;
const te = t.end;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

/** 끝낼 수 있는 줄과 이미 끝난 줄을 함께 둔다 — 방향이 줄마다 다르다. */
const rows: OperationPolicy[] = [
  makeRatio(9003, 0.25, { itemId: 21, effectiveFrom: '2026-03-01' }),
  makeRatio(9004, 1, { processId: 31, effectiveTo: '2026-12-31' }),
];

interface Options {
  writes?: Request[];
  policies?: OperationPolicy[];
  writeStatus?: number;
  writeBody?: unknown;
}

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => isPath(request, '/app/operation-policies/9003'),
    respond: (request) => {
      options.writes?.push(request);

      return options.writeStatus === undefined
        ? jsonResponse(makeRatio(9003, 0.25, { itemId: 21, effectiveTo: '2026-06-30' }))
        : jsonResponse(options.writeBody ?? { errors: [] }, { status: options.writeStatus });
    },
  },
  {
    match: (request) =>
      isPath(request, '/app/operation-policies') &&
      policyCodeOf(request) === 'SHOT_CONVERSION_ENABLED',
    respond: () => jsonResponse(enabledListResponse()),
  },
  {
    match: (request) => isPath(request, '/app/operation-policies'),
    respond: () => jsonResponse(ratioListResponse(options.policies ?? rows)),
  },
  {
    match: (request) => isPath(request, '/app/operation-policies/effective'),
    respond: () => jsonResponse(effectiveResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/molds'),
    respond: () => jsonResponse(moldListResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/items'),
    respond: () => jsonResponse(itemsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/processes'),
    respond: () => jsonResponse(processesResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/plants'),
    respond: () => jsonResponse(plantsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/business-units'),
    respond: () => jsonResponse(businessUnitsResponse()),
  },
];

const renderScreen = (options: Options = {}) =>
  renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(routes(options)) });

const pane = (): HTMLElement => screen.getByRole('region', { name: t.ratioList.paneTitle });
const dialog = () => within(screen.getByRole('dialog'));

const itemScope = t.scope.entry(t.scope.itemId, 'ITM-201 · 가상 하우징');
const processScope = t.scope.entry(t.scope.processId, 'PRC-301 · 가상 프레스');

const openEnd = async (): Promise<void> => {
  const user = userEvent.setup();

  await within(pane()).findByText(itemScope);
  await user.click(within(pane()).getByRole('button', { name: te.label(itemScope) }));
  await screen.findByRole('dialog');
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

const onlyWrite = (writes: readonly Request[]): Request => {
  const [first] = writes;

  if (first === undefined) throw new Error('나간 쓰기가 없습니다.');

  return first;
};

describe('W-05-01 ③ — 끝낼 수 있는 줄', () => {
  it('끝이 없는 정책에는 종료 단추가 열린다', async () => {
    renderScreen();

    expect(await within(pane()).findByRole('button', { name: te.label(itemScope) })).toBeEnabled();
  });

  /** ⛔ 감추지 않고 사유와 함께 잠근다(G-2). */
  it('이미 끝난 정책의 단추는 잠기고 사유가 붙는다', async () => {
    renderScreen();

    const button = await within(pane()).findByRole('button', { name: te.label(processScope) });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', te.alreadyEnded);
  });

  /** 줄이 여럿일 때 「정책 종료」만으로는 어느 것인지 모른다. */
  it('단추의 접근 이름에 대상이 담긴다', async () => {
    renderScreen();

    const button = await within(pane()).findByRole('button', { name: te.label(itemScope) });

    expect(button).toHaveTextContent(te.action);
  });
});

describe('W-05-01 ③ — 끝내는 창', () => {
  /** ⛔ 「지우는 것이 아니다」를 먼저 말한다 — 이 창에서 가장 오해하기 쉬운 자리다. */
  it('지우는 것이 아니라고 말하고 그 이유까지 담는다', async () => {
    renderScreen();
    await openEnd();

    expect(dialog().getByText(te.notDeleted)).toBeInTheDocument();
    expect(dialog().getByText(te.target(itemScope))).toBeInTheDocument();
  });

  /** ⚠ 끝낸 뒤 무엇이 적용될지는 이 창이 알 수 없다 — 서버가 판정한다. */
  it('끝낸 뒤 무엇이 적용되는지 단정하지 않는다', async () => {
    renderScreen();
    await openEnd();

    expect(dialog().getByText(te.afterNote)).toBeInTheDocument();

    const text = screen.getByRole('dialog').textContent ?? '';

    expect(text).not.toContain('삭제');
  });

  it('종료일을 고르지 않으면 막는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openEnd();
    await user.click(dialog().getByRole('button', { name: te.action }));

    expect(dialog().getByText(te.dateRequired)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  /** ⭐ 문구에 그 시작일을 담는다 — 그것이 언제인지 창에서 알 길이 없다. */
  it('시작일보다 앞선 날은 그 시작일을 문구에 담아 막는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openEnd();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: te.action }));

    expect(dialog().getByText(te.dateBeforeStart('2026-03-01'))).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('고치면 그 사유가 사라진다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openEnd();
    await user.click(dialog().getByRole('button', { name: te.action }));
    expect(dialog().getByText(te.dateRequired)).toBeInTheDocument();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-06-30');

    expect(dialog().queryByText(te.dateRequired)).not.toBeInTheDocument();
  });

  it('취소하면 아무것도 나가지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openEnd();
    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});

describe('W-05-01 ③ — 끝낸다', () => {
  /**
   * ⭐ **지금 값을 통째로 되보내며 종료일만 바꾼다.** 계약이 수정 본문의 값 칸을 선택으로
   * 두어, 종료일만 실으면 서버가 그것을 「나머지를 비우라」로 읽을 수 있다.
   */
  it('비율과 시작일을 그대로 두고 종료일만 바꾼다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openEnd();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-06-30');
    await user.click(dialog().getByRole('button', { name: te.action }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = onlyWrite(writes);

    expect(request.method).toBe('PUT');
    expect(await bodyOf(request)).toEqual({
      valueNumeric: 0.25,
      valueText: null,
      valueBoolean: null,
      effectiveFrom: '2026-03-01',
      effectiveTo: '2026-06-30',
    });
  });

  it('멱등 키가 실리고 잠금 토큰은 실리지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openEnd();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-06-30');
    await user.click(dialog().getByRole('button', { name: te.action }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('Idempotency-Key')).not.toBeNull();
    expect(onlyWrite(writes).headers.get('If-Match')).toBeNull();
  });

  it('성공하면 창이 닫힌다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openEnd();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-06-30');
    await user.click(dialog().getByRole('button', { name: te.action }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('실패하면 창이 남고 이유가 선다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({
      writes,
      writeStatus: 400,
      writeBody: {
        errors: [{ scope: 'screen', code: 'INVALID', message: '지금은 끝낼 수 없습니다.' }],
      },
    });
    await openEnd();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-06-30');
    await user.click(dialog().getByRole('button', { name: te.action }));

    expect(await screen.findByText('지금은 끝낼 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('앞서 실패한 저장의 배너가 다음 창에 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({
      writeStatus: 400,
      writeBody: {
        errors: [{ scope: 'screen', code: 'INVALID', message: '지금은 끝낼 수 없습니다.' }],
      },
    });
    await openEnd();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-06-30');
    await user.click(dialog().getByRole('button', { name: te.action }));
    expect(await screen.findByText('지금은 끝낼 수 없습니다.')).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));
    await user.click(within(pane()).getByRole('button', { name: te.label(itemScope) }));
    await screen.findByRole('dialog');

    expect(screen.queryByText('지금은 끝낼 수 없습니다.')).not.toBeInTheDocument();
  });

  it('다시 열면 앞서 고른 날이 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openEnd();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-06-30');
    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));
    await user.click(within(pane()).getByRole('button', { name: te.label(itemScope) }));
    await screen.findByRole('dialog');

    expect(dialog().getByLabelText(te.dateLabel)).toHaveValue('');
  });
});

/**
 * ⛔ **끝낸 뒤 목록을 다시 받는다.**
 *
 * 이 자원에는 잠금이 없어 **다시 받는 것이 「무엇이 실제로 저장됐는가」를 아는 유일한 길**이다.
 * 받지 않으면 방금 끝낸 정책이 여전히 열려 있는 것처럼 남아, 사용자는 **끝내기가 안 먹은 줄
 * 알고 한 번 더 누른다.**
 */
describe('W-05-01 ③ — 끝낸 뒤 목록', () => {
  it('바뀐 상태를 다시 받아 그린다', async () => {
    const user = userEvent.setup();
    let ended = false;
    const custom: StubRoute[] = [
      {
        match: (request) =>
          request.method === 'PUT' && isPath(request, '/app/operation-policies/9003'),
        respond: () => {
          ended = true;

          return jsonResponse(
            makeRatio(9003, 0.25, {
              itemId: 21,
              effectiveFrom: '2026-03-01',
              effectiveTo: '2026-06-30',
            }),
          );
        },
      },
      {
        match: (request) => isPath(request, '/app/operation-policies'),
        respond: () =>
          jsonResponse(
            ratioListResponse([
              makeRatio(9003, 0.25, {
                itemId: 21,
                effectiveFrom: '2026-03-01',
                ...(ended ? { effectiveTo: '2026-06-30' } : {}),
              }),
            ]),
          ),
      },
      ...routes({}),
    ];

    renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(custom) });
    await openEnd();

    await user.type(dialog().getByLabelText(te.dateLabel), '2026-06-30');
    await user.click(dialog().getByRole('button', { name: te.action }));

    /* 끝난 뒤에는 그 줄의 종료 단추가 잠긴다 — 목록을 다시 받았다는 증거다. */
    await waitFor(() =>
      expect(within(pane()).getByRole('button', { name: te.label(itemScope) })).toBeDisabled(),
    );
    expect(
      within(pane()).getByText(t.period.closed('2026-03-01', '2026-06-30')),
    ).toBeInTheDocument();
  });
});
