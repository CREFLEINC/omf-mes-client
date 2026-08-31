import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import {
  anotherWaitingRequest,
  codeValuesResponse,
  confirmedRound,
  overallJudgmentCodeValues,
  queueItems,
  queueResponse,
  roundsResponse,
  waitingRequest,
} from './fixtures';
import { OqcInspectionScreen } from './screen';
import type { InspectionResultResponse } from './types';

/**
 * 이 스위트는 **전면 흐름을 훑지 않는다.** 「틀려도 조용한 것」이 모여 있는 집중 지점만 잰다:
 *
 * | 지점 | 무엇을 지키는가 |
 * | --- | --- |
 * | V1 | 5xx 뒤 재시도가 **같은 멱등 키**로 나간다 |
 * | V2 D1 | 배경 재조회가 편집 중인 초안을 덮지 않는다 |
 * | V2 D2 | 회차가 없는 의뢰끼리 옮겨도 앞 의뢰의 수량이 남지 않는다 |
 * | V2 D3 | 저장이 도는 중에 의뢰를 바꾸면 성공 문구가 새 의뢰 창에 서지 않는다 |
 *
 * 나머지(빈·오류·로딩 갈래)는 각 1건씩만 둔다.
 */

const t = messages.oqcInspection;

/** 응답 하나를 손에 쥐고 있다가 원할 때 푸는 문. 「도는 중」을 실제로 만들려면 필요하다. */
const createGate = () => {
  let release: (() => void) | null = null;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { opened, release: () => release?.() };
};

interface ScreenOptions {
  route?: string;
  queue?: (request: Request) => Response;
  /** 의뢰마다 돌려줄 회차. 기본은 「아직 아무도 판정하지 않음」이다 */
  roundsOf?: (inspectionRequestId: number) => InspectionResultResponse[];
  /** 저장 응답. 기본은 성공(201) */
  save?: (attempt: number) => Response;
  /** 저장 응답을 붙잡아 둘 문 */
  saveGate?: { opened: Promise<void> };
  /** 상세 응답을 붙잡아 둘 문 */
  detailGate?: { opened: Promise<void> };
}

const renderScreen = (options: ScreenOptions = {}) => {
  /** 저장 요청 원본 — 헤더와 몸통을 그대로 본다 */
  const saves: Request[] = [];

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const isSave = path === '/quality/inspection-results' && request.method === 'POST';

    if (path === '/quality/inspection-requests') {
      return options.queue?.(request) ?? jsonResponse(queueResponse());
    }

    if (path.startsWith('/quality/inspection-requests/')) {
      if (options.detailGate !== undefined) await options.detailGate.opened;

      const id = Number(path.split('/').at(-1));
      const found = queueItems.find((item) => item.inspectionRequestId === id);

      return found === undefined
        ? jsonResponse({ message: '없는 의뢰' }, { status: 404 })
        : jsonResponse(found);
    }

    if (path === '/mdm/code-values') {
      return jsonResponse(codeValuesResponse(overallJudgmentCodeValues));
    }

    if (path === '/quality/inspection-results' && request.method === 'GET') {
      const id = Number(url.searchParams.get('inspectionRequestId'));

      return jsonResponse(roundsResponse(options.roundsOf?.(id) ?? []));
    }

    if (isSave) {
      saves.push(request.clone());
      if (options.saveGate !== undefined) await options.saveGate.opened;

      return options.save?.(saves.length) ?? jsonResponse(confirmedRound, { status: 201 });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  const view = renderWithProviders(<OqcInspectionScreen />, {
    route: options.route ?? '/',
    fetch: stubFetch,
  });

  return { ...view, saves };
};

const openRow = (inspectionRequestNo: string) =>
  screen.getByRole('button', { name: t.queue.openRow(inspectionRequestNo) });

const acceptedField = () => screen.getByLabelText(t.result.fields.accepted);

/** 우측 창의 「대상 정보」 구획 — 좌측 표와 같은 숫자가 겹치므로 여기서 찾는다. */
const detailPane = () => within(screen.getByRole('region', { name: t.detail.heading }));

/** 수량 셋을 채우고 판정을 고른다 — 저장이 열리는 정상 경로. */
const fillJudgment = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(acceptedField(), '480');
  await user.type(screen.getByLabelText(t.result.fields.rejected), '15');
  await user.type(screen.getByLabelText(t.result.fields.held), '5');
  await user.click(screen.getByRole('combobox', { name: t.result.judgment }));
  await user.click(screen.getByRole('option', { name: '합격' }));
};

const pressSaveInDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: messages.oqcInspection.confirm.confirm,
    }),
  );
};

describe('OqcInspectionScreen — 확정 배선(V1)', () => {
  it('5xx 뒤 같은 값으로 다시 누르면 같은 멱등 키가 나간다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      /* 첫 시도만 실패시킨다 — 「적용됐는지 모르는」 상태를 만든다. */
      save: (attempt) =>
        attempt === 1
          ? jsonResponse({ message: '서버 오류' }, { status: 500 })
          : jsonResponse(confirmedRound, { status: 201 }),
    });

    await screen.findByLabelText(t.result.fields.accepted);
    await fillJudgment(user);

    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);
    await waitFor(() => expect(saves).toHaveLength(1));

    /*
     * ⚠ **시계를 얼리지 않는다.** 검사 시각이 누를 때마다 새로 읽히면 멱등 키의 지문이 달라져
     * 이 감지기가 겨눈 결함이 생기는데, 시계가 멈춰 있으면 그 결함이 있어도 시험이 통과한다.
     * 실제 시각이 움직이도록 두 누름 사이에 짧게 기다린다.
     */
    await new Promise((resolve) => setTimeout(resolve, 5));

    await pressSaveInDialog(user);
    await waitFor(() => expect(saves).toHaveLength(2));

    expect(saves[0]?.headers.get('Idempotency-Key')).toBe(saves[1]?.headers.get('Idempotency-Key'));
    /* ⛔ 계약이 선택으로 둔 헤더다 — 빈 값을 채워 보내면 서버가 400 으로 되돌린다. */
    expect(saves[0]?.headers.has('If-Match')).toBe(false);
    await expect(saves[1]?.clone().json()).resolves.toMatchObject({
      statusCode: '확정',
      overallJudgmentCode: 'ACCEPTED',
      inspectionRequestId: waitingRequest.inspectionRequestId,
      acceptedQty: 480,
      rejectedQty: 15,
      heldQty: 5,
      uomId: waitingRequest.uomId,
    });
  });
});

describe('OqcInspectionScreen — 편집 초안 vs 서버 조회(V2)', () => {
  it('D1 — 같은 값을 돌려주는 배경 재조회가 도착해도 친 수량이 남는다', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
    });

    await screen.findByLabelText(t.result.fields.accepted);
    await user.type(acceptedField(), '480');

    await queryClient.invalidateQueries({ queryKey: ['oqc-inspection'] });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(acceptedField()).toHaveValue('480');
  });

  it('D2 — 회차가 없는 의뢰끼리 옮기면 앞 의뢰에 친 수량이 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({ route: `/?ir=${String(waitingRequest.inspectionRequestId)}` });

    await screen.findByLabelText(t.result.fields.accepted);
    await user.type(acceptedField(), '480');
    expect(acceptedField()).toHaveValue('480');

    await user.click(openRow(anotherWaitingRequest.inspectionRequestNo));

    await waitFor(() =>
      expect(detailPane().getByText(anotherWaitingRequest.inspectionRequestNo)).toBeInTheDocument(),
    );
    expect(acceptedField()).toHaveValue('');
  });

  it('D3 — 저장이 도는 중에 의뢰를 바꾸면 성공 문구가 새 의뢰 창에 서지 않는다', async () => {
    const user = userEvent.setup();
    const gate = createGate();
    const { saves, queryClient } = renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      saveGate: gate,
    });

    await screen.findByLabelText(t.result.fields.accepted);
    await fillJudgment(user);

    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);
    await waitFor(() => expect(saves).toHaveLength(1));

    /* 나가 있는 사이에 다른 의뢰로 옮긴다 — 앞 대상의 쓰기는 이제 남의 것이다. */
    await user.click(openRow(anotherWaitingRequest.inspectionRequestNo));
    await waitFor(() =>
      expect(detailPane().getByText(anotherWaitingRequest.inspectionRequestNo)).toBeInTheDocument(),
    );

    gate.release();

    /*
     * ⚠ **초안이 비었는지로 기다리지 않는다.** 그것은 D2 가 지키는 것이고, 여기서 쓰면 D2 를
     * 깨는 결함이 이 시험까지 함께 죽여 «무엇이 깨졌는지»를 가린다. 쓰기가 끝난 것만 기다린다.
     */
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(screen.queryByText(t.result.saved)).not.toBeInTheDocument();
  });
});

describe('OqcInspectionScreen — 좌측 네 갈래', () => {
  it('부르는 중에는 「불러오는 중」이다', () => {
    renderScreen();

    expect(screen.getByText(t.queue.loading)).toBeInTheDocument();
  });

  it('실패를 「결과 없음」으로 접지 않는다', async () => {
    renderScreen({ queue: () => jsonResponse({ message: '서버 오류' }, { status: 500 }) });

    expect(await screen.findByText(t.queue.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(t.queue.empty)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('조건에 맞는 것이 없으면 조건을 넓히라고 말한다', async () => {
    renderScreen({ queue: () => jsonResponse(queueResponse([])) });

    expect(await screen.findByText(t.queue.empty)).toBeInTheDocument();
  });

  it('결과는 있는데 이 쪽에 없으면 앞쪽으로 가라고 말한다 — 조건 문제와 가르지 않는다', async () => {
    renderScreen({
      route: '/?page=9',
      queue: () => jsonResponse(queueResponse([], { page: 9, size: 50, total: 120 })),
    });

    expect(await screen.findByText(/이 쪽에는 결과가 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.pageNav.toFirstPage })).toBeInTheDocument();
  });
});

describe('OqcInspectionScreen — 우측 네 갈래', () => {
  it('고르기 전에는 무엇을 해야 하는지 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.detail.nothingSelected)).toBeInTheDocument();
  });

  it('상세를 부르는 중에는 「불러오는 중」이다', async () => {
    const gate = createGate();

    renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      detailGate: gate,
    });

    expect(await screen.findByText(t.detail.loading)).toBeInTheDocument();

    gate.release();
  });

  it('상세 실패를 「고르지 않음」으로 접지 않는다', async () => {
    renderScreen({ route: '/?ir=999999' });

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.detail.nothingSelected)).not.toBeInTheDocument();
  });

  it('고른 의뢰의 대상 정보와 판정 폼이 함께 선다', async () => {
    renderScreen({ route: `/?ir=${String(waitingRequest.inspectionRequestId)}` });

    await screen.findByLabelText(t.result.fields.accepted);

    expect(detailPane().getByText(waitingRequest.inspectionRequestNo)).toBeInTheDocument();
    expect(detailPane().getByText(waitingRequest.targetTypeCode)).toBeInTheDocument();
  });
});
