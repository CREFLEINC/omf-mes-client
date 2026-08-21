import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { CODE_GROUPS } from './code-options';
import {
  codeValuesResponse,
  confirmedRound,
  draftRound,
  expiredMeasurement,
  itemSpecsResponse,
  measurementsResponse,
  overallJudgmentCodeValues,
  pageOf,
  queueItems,
  queueResponse,
  reinspectionRound,
  roundsResponse,
  waitingRequest,
} from './fixtures';
import type { InspectionMeasurementResponse } from './measurement-rows';
import { IqcInspectionScreen } from './screen';
import type { InspectionResultResponse } from './types';

const t = messages.iqcInspection;

/** 요청이 실제로 무엇을 실어 갔는지 본다 — 주소가 조건을 몰았음을 그것으로 증명한다. */
const renderScreen = (
  route = '/',
  respond: (request: Request) => Response = () => jsonResponse(queueResponse()),
  /** 회차 응답. 기본은 작성중 1회차이고, 빈 배열이면 아직 손대지 않은 의뢰다 */
  rounds = [draftRound],
  /** 그 회차에 저장된 측정치 */
  measurements: InspectionMeasurementResponse[] = [],
  /** 검사기준 버전의 항목 규격. 빈 목록이면 그리드가 빈 자리 문구를 그린다 */
  specs = itemSpecsResponse(),
  /**
   * 저장이 성공한 «뒤» 서버가 갖게 되는 회차. 비우면 저장 전후가 같다.
   *
   * ⭐ 저장이 회차를 만드는 갈래를 재려면 이것이 필요하다 — 목록이 저장 전 상태로 굳어
   * 있으면 화면은 새 회차가 생긴 것을 영영 모르고, 그 상태에서 통과한 시험은 아무것도
   * 증명하지 않는다.
   */
  roundsAfterWrite: InspectionResultResponse[] | null = null,
) => {
  const sent: URL[] = [];
  /** 저장 요청 원본 — 본문과 헤더를 그대로 본다 */
  const writes: Request[] = [];

  const view = renderWithProviders(<IqcInspectionScreen />, {
    route,
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/quality/inspection-requests',
        respond: (request) => {
          sent.push(new URL(request.url));
          return respond(request);
        },
      },
      /*
       * 의뢰를 고르면 상세와 회차를 부른다 — 스텁을 빠뜨리면 그 요청이 조용히 실패한다.
       * **경로의 번호를 지킨다** — 늘 같은 건을 돌려주면 목록과 상세가 다른 의뢰를 가리키는
       * 상태를 시험이 정상으로 통과시킨다.
       */
      {
        match: (request) =>
          new URL(request.url).pathname.startsWith('/quality/inspection-requests/'),
        respond: (request) => {
          const id = Number(new URL(request.url).pathname.split('/').at(-1));
          const found = queueItems.find((item) => item.inspectionRequestId === id);

          return found === undefined
            ? jsonResponse({ message: '없는 의뢰' }, { status: 404 })
            : jsonResponse(found);
        },
      },
      /* 공통코드 — 종합 판정 선택지를 채운다. */
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: (request) => {
          sent.push(new URL(request.url));
          return jsonResponse(codeValuesResponse(overallJudgmentCodeValues));
        },
      },
      /* 측정치 — 회차 단건보다 «먼저» 둔다. 경로가 회차 단건의 접두를 포함하기 때문이다. */
      {
        match: (request) =>
          new URL(request.url).pathname.endsWith('/measurements') && request.method === 'GET',
        respond: () => jsonResponse(measurementsResponse(measurements)),
      },
      /* 검사기준 버전의 항목 규격 — 그리드의 줄 수를 정한다. */
      {
        match: (request) => new URL(request.url).pathname.endsWith('/items'),
        respond: (request) => {
          sent.push(new URL(request.url));
          return jsonResponse(specs);
        },
      },
      /* 회차 한 건 — 잠금 토큰이 여기서 온다(목록 200 에는 ETag 가 없다). */
      {
        match: (request) =>
          new URL(request.url).pathname.startsWith('/quality/inspection-results/') &&
          request.method === 'GET',
        respond: () => jsonResponse(rounds[0] ?? draftRound, { headers: { ETag: 'W/"7"' } }),
      },
      /* 저장 — POST(신규)와 PUT(수정) 둘 다 받는다. */
      {
        match: (request) =>
          new URL(request.url).pathname.startsWith('/quality/inspection-results') &&
          request.method !== 'GET',
        respond: (request) => {
          writes.push(request);

          const responder = confirmResponder;
          if (responder !== null && new URL(request.url).pathname.endsWith(':confirm')) {
            return responder(request);
          }

          return jsonResponse(draftRound, { status: request.method === 'POST' ? 201 : 200 });
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/quality/inspection-results',
        respond: () =>
          jsonResponse(
            roundsResponse(
              writes.length > 0 && roundsAfterWrite !== null ? roundsAfterWrite : rounds,
            ),
          ),
      },
    ]),
  });

  return { sent, writes, view };
};

/** 저장 요청의 본문을 읽는다. 한 번만 읽을 수 있으므로 복제해서 쓴다. */
const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

/**
 * `sent` 에는 큐·항목 규격·공통코드가 섞여 담긴다. 갈래를 갈라 읽지 않으면 「마지막 요청」이
 * 엉뚱한 것을 가리킨다 — 큐 단언은 큐만 본다.
 */
/**
 * 확정 요청의 응답을 시험이 갈아 끼우는 자리. 기본은 성공이고, 실패를 섞어야 하는 시험만
 * 채운다 — 매 시험이 시작할 때 비운다.
 */
let confirmResponder: ((request: Request) => Response) | null = null;

beforeEach(() => {
  confirmResponder = null;
});

const queueCalls = (sent: URL[]) =>
  sent.filter((url) => url.pathname === '/quality/inspection-requests');

const lastQuery = (sent: URL[]) => queueCalls(sent).at(-1)?.searchParams;
const openButton = (no: string) => screen.getByRole('button', { name: t.queue.openRow(no) });

describe('IqcInspectionScreen', () => {
  it('검사 대기 큐를 그린다', async () => {
    renderScreen();

    expect(await screen.findByText('IR-2026-0001')).toBeInTheDocument();
  });

  it('고정 축을 늘 실어 보낸다 — 사용자가 끌 수 없는 이 화면의 정의다', async () => {
    const { sent } = renderScreen();

    await waitFor(() => expect(queueCalls(sent)).toHaveLength(1));

    expect(lastQuery(sent)?.get('inspectionTypeCode')).toBe('IQC');
    expect(lastQuery(sent)?.get('pendingOnly')).toBe('true');
  });

  it('주소가 담은 조건을 그대로 실어 보낸다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { sent } = renderScreen('/?it=1001&sp=2002&q=IR&page=2');

    await waitFor(() => expect(queueCalls(sent)).toHaveLength(1));

    expect(lastQuery(sent)?.get('itemId')).toBe('1001');
    expect(lastQuery(sent)?.get('supplierId')).toBe('2002');
    expect(lastQuery(sent)?.get('q')).toBe('IR');
    expect(lastQuery(sent)?.get('page')).toBe('2');
  });

  it('조건을 바꾸면 첫 쪽부터 다시 부른다 — 좁힌 결과가 3쪽에 못 미칠 수 있다', async () => {
    const { sent } = renderScreen('/?page=3');

    await waitFor(() => expect(queueCalls(sent)).toHaveLength(1));

    await userEvent.type(screen.getByLabelText(t.filters.item), '1001');
    await userEvent.click(screen.getByRole('button', { name: t.filters.apply }));

    await waitFor(() => expect(queueCalls(sent).length).toBeGreaterThan(1));
    expect(lastQuery(sent)?.get('page')).toBe('1');
    expect(lastQuery(sent)?.get('itemId')).toBe('1001');
  });

  it('의뢰를 고르면 그 줄이 현재가 된다', async () => {
    renderScreen();

    await screen.findByText('IR-2026-0002');
    await userEvent.click(openButton('IR-2026-0002'));

    await waitFor(() => expect(openButton('IR-2026-0002')).toHaveAttribute('aria-current', 'true'));
  });

  it('쪽을 옮겨도 조건과 고른 의뢰는 그대로다', async () => {
    const { sent } = renderScreen('/?it=1001&ir=1002', () =>
      jsonResponse(queueResponse(queueItems, pageOf(120, 1, 50))),
    );

    await screen.findByText('IR-2026-0001');
    await userEvent.click(screen.getByRole('button', { name: t.pageNav.next }));

    await waitFor(() => expect(lastQuery(sent)?.get('page')).toBe('2'));
    expect(lastQuery(sent)?.get('itemId')).toBe('1001');
    expect(openButton('IR-2026-0002')).toHaveAttribute('aria-current', 'true');
  });

  it('조회가 실패하면 배너를 세우고 다시 시도할 자리를 준다', async () => {
    let attempts = 0;

    const { sent } = renderScreen('/', () => {
      attempts += 1;
      return attempts === 1
        ? jsonResponse({ message: '서버 오류' }, { status: 500 })
        : jsonResponse(queueResponse());
    });

    const retry = await screen.findByRole('button', { name: messages.common.retry });
    await userEvent.click(retry);

    await waitFor(() => expect(queueCalls(sent).length).toBeGreaterThan(1));
    expect(await screen.findByText('IR-2026-0001')).toBeInTheDocument();
  });

  /**
   * 아래 셋은 리뷰가 잡은 자리다 — 감지기가 없어서 통과했던 갈래들이다.
   * 조회가 실패했을 때 화면이 「조건을 넓혀라」·「전체 0건」이라고 **거짓을 말하던** 자리.
   */
  it('조회가 실패하면 조건을 넓히라고 말하지 않는다 — 조건은 멀쩡하고 요청이 실패한 것이다', async () => {
    renderScreen('/', () => jsonResponse({ message: 'x' }, { status: 500 }));

    await screen.findByRole('button', { name: messages.common.retry });

    expect(screen.getByText(t.queue.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(t.queue.empty)).not.toBeInTheDocument();
  });

  it('조회가 실패하면 총계를 단언하지 않는다 — 모르는 건수를 지어내지 않는다', async () => {
    renderScreen('/', () => jsonResponse({ message: 'x' }, { status: 500 }));

    await screen.findByRole('button', { name: messages.common.retry });

    expect(screen.queryByRole('navigation', { name: t.pageNav.label })).not.toBeInTheDocument();
  });

  it('부르는 중에도 총계를 단언하지 않는다', () => {
    renderScreen('/', () => jsonResponse(queueResponse()));

    expect(screen.getByText(t.queue.loading)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: t.pageNav.label })).not.toBeInTheDocument();
  });

  it('셀 것이 있으면 쪽 이동이 선다', async () => {
    renderScreen();

    expect(await screen.findByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });

  it('아무것도 고르지 않았으면 무엇을 해야 하는지 말한다', async () => {
    renderScreen();

    expect(await screen.findByText(t.detail.nothingSelected)).toBeInTheDocument();
  });

  it('의뢰를 고르면 그 의뢰의 상세가 선다 — 목록과 상세가 같은 건을 가리킨다', async () => {
    renderScreen('/?ir=1002');

    expect(await screen.findByText(t.detail.fields.inspectionPlanVersionId)).toBeInTheDocument();
    expect(await screen.findByText(t.detail.planVersionNote)).toBeInTheDocument();
  });

  it('회차에 저장된 수량이 편집 칸에 되돌아온다', async () => {
    renderScreen('/?ir=1001');

    await screen.findByText(t.result.round(1));

    expect(screen.getByLabelText(t.result.fields.accepted)).toHaveValue('480');
    expect(screen.getByLabelText(t.result.fields.rejected)).toHaveValue('15');
    expect(screen.getByLabelText(t.result.fields.held)).toHaveValue('5');
  });

  it('되돌아온 수량이 합계 제약을 만족하면 일치한다고 말한다', async () => {
    renderScreen('/?ir=1001');

    expect(await screen.findByText(t.result.matched)).toBeInTheDocument();
  });

  /*
   * ⭐ 리뷰가 잡은 자리다. 회차 값만 의존성에 두면 «회차가 없는 의뢰끼리» 옮길 때
   * 네 값이 모두 그대로여서 되돌림이 깨어나지 않고, 앞 의뢰에 친 수량이 다음 화면에 남는다.
   * 저장이 붙는 순간 다른 LOT 에 앞 의뢰의 수량을 저장하는 길이 된다.
   */
  it('회차가 없는 의뢰끼리 옮겨도 앞 의뢰에 친 수량이 남지 않는다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.notStarted);
    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '123');
    expect(screen.getByLabelText(t.result.fields.accepted)).toHaveValue('123');

    await userEvent.click(screen.getByRole('button', { name: t.queue.openRow('IR-2026-0002') }));

    await waitFor(() => expect(screen.getByLabelText(t.result.fields.accepted)).toHaveValue(''));
  });

  it('회차가 없으면 저장이 새로 만든다', async () => {
    const { writes } = renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.notStarted);
    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '500');
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.method).toBe('POST');
  });

  /*
   * ⭐ 계약에서 사라진 두 칸이다. 화면이 세션 값을 실으면 품질 감사 기록에 엉뚱한 사람이
   * 검사자로 남고, 값이 그럴듯한 정수라 아무도 눈치채지 못한다(omf-mes#173).
   */
  it('검사자와 단말을 보내지 않는다 — 서버가 인증 주체에서 채운다', async () => {
    const { writes } = renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.notStarted);
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);
    expect(body).not.toHaveProperty('inspectorId');
    expect(body).not.toHaveProperty('terminalId');
    expect(body.statusCode).toBe('작성중');
  });

  it('작성중 회차가 있으면 그것을 고치고 잠금 토큰을 싣는다', async () => {
    const { writes } = renderScreen('/?ir=1001');

    await screen.findByText(t.result.round(1));
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = writes[0] as Request;
    expect(request.method).toBe('PUT');
    expect(request.headers.get('If-Match')).toBe('W/"7"');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('저장이 끝나면 회차를 다시 부른다 — 화면과 서버가 갈리지 않게', async () => {
    const { writes, sent } = renderScreen('/?ir=1001');

    await screen.findByText(t.result.round(1));
    const before = queueCalls(sent).length;
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(queueCalls(sent).length).toBeGreaterThan(before));
  });

  /*
   * ⭐ 리뷰가 잡은 자리다. 저장 표시를 값이 바뀌는 자리에서 지우지 않으면, 검사자가 수량을
   * 고치고 「저장했습니다」를 보고 자리를 떠 고친 값이 사라진다.
   */
  it('저장한 뒤 값을 더 고치면 「저장했습니다」를 지운다 — 저장되지 않은 변경이 있다', async () => {
    renderScreen('/?ir=1001');

    await screen.findByText(t.result.round(1));
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await screen.findByText(t.result.saved);

    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '9');

    await waitFor(() => expect(screen.queryByText(t.result.saved)).not.toBeInTheDocument());
  });

  it('검사 시점에 고정된 기준 버전으로 항목을 부른다 — 최신 기준을 따로 찾지 않는다', async () => {
    const { sent } = renderScreen('/?ir=1001');

    await screen.findByRole('region', { name: messages.iqcInspection.measurements.heading });

    const itemsCall = sent.find((url) => url.pathname.endsWith('/items'));
    expect(itemsCall?.pathname).toContain(String(waitingRequest.inspectionPlanVersionId));
  });

  /*
   * ⭐ 리뷰가 잡은 자리다. 「아직 재지 않았다」는 검사자가 무엇을 더 재야 하는지 말하는
   * 신호라, 부르는 중에 단언하면 이미 잰 값을 다시 재게 만들 수 있다.
   */
  /*
   * ⭐ 리뷰가 잡은 자리다. 측정치 조회는 회차가 없을 때 «비활성»이고, 비활성이면 isPending
   * 이 계속 참이다. 그것을 그대로 쓰면 그리드가 영영 「불러오는 중」에 머문다.
   * ⚠ 줄이 있으면 빈 자리 문구가 아예 안 그려지므로, 항목이 0건인 기준으로 재야 갈린다.
   */
  it('아직 시작하지 않은 의뢰의 그리드가 「불러오는 중」에 머물지 않는다', async () => {
    renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), [], [], itemSpecsResponse([]));

    expect(
      await screen.findByText(messages.iqcInspection.measurements.noItems),
    ).toBeInTheDocument();
    expect(screen.queryByText(messages.iqcInspection.measurements.loading)).not.toBeInTheDocument();
  });

  it('교정 만료로 잰 측정치가 있으면 경고를 세우되 막지는 않는다', async () => {
    renderScreen(
      '/?ir=1001',
      () => jsonResponse(queueResponse()),
      [draftRound],
      [expiredMeasurement],
    );

    expect(
      await screen.findByText(messages.iqcInspection.measurements.calibrationWarningTitle),
    ).toBeInTheDocument();
    /* 저장 단추가 그대로 선다 — 알리기만 하고 차단하지 않는다. */
    expect(screen.getByRole('button', { name: t.result.save })).toBeEnabled();
  });

  /*
   * ⛔ 판정 그룹이 둘이다. 항목 판정에는 보류가 없어 합쳐 쓰면 종합 선택칸의 값 집합이
   * 달라진다 — 그룹을 «이름»으로 부르되 어느 이름인지가 중요하다(omf-mes#179).
   */
  it('종합 판정 그룹을 이름으로 부른다 — 정수 id 를 박지 않는다', async () => {
    const { sent } = renderScreen('/?ir=1001');

    await screen.findByLabelText(t.result.judgment);

    const call = sent.find((url) => url.pathname === '/mdm/code-values');
    expect(call?.searchParams.get('codeGroupCode')).toBe(CODE_GROUPS.overallJudgment);
    expect(call?.searchParams.has('codeGroupId')).toBe(false);
  });

  it('항목 판정 그룹을 종합 판정에 쓰지 않는다 — 그쪽에는 보류가 없다', async () => {
    const { sent } = renderScreen('/?ir=1001');

    await screen.findByLabelText(t.result.judgment);

    const groups = sent
      .filter((url) => url.pathname === '/mdm/code-values')
      .map((url) => url.searchParams.get('codeGroupCode'));

    expect(groups).not.toContain(CODE_GROUPS.measurementJudgment);
  });

  it('확정하면 되돌릴 수 없는 쓰기가 잠금 토큰과 함께 나간다', async () => {
    const { writes } = renderScreen('/?ir=1001');

    await screen.findByText(t.result.round(1));
    await userEvent.click(await screen.findByRole('button', { name: t.result.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = writes[0] as Request;
    expect(new URL(request.url).pathname).toContain(':confirm');
    expect(request.headers.get('If-Match')).toBe('W/"7"');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
    expect(await bodyOf(request)).toEqual({ overallJudgmentCode: 'ACCEPTED' });
  });

  /*
   * ⭐ 확정은 되돌릴 수 없는 쓰기다 — 이 순간 LOT 상태가 전이하고 보류 해제가 기록된다.
   * 통신이 끊기거나 5xx 가 온 뒤 다시 누를 때 «새 키»가 나가면 서버가 그것을 다른 쓰기로
   * 보고 두 번 실행할 수 있다. 그래서 수명을 until-applied 로 고른다(#263).
   */
  it('확정이 실패한 뒤 다시 눌러도 같은 멱등 키를 쓴다 — 두 번 실행되면 되돌릴 수 없다', async () => {
    let shouldFail = true;

    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [draftRound]);

    /* 첫 시도는 5xx 로 떨어뜨린다 — 적용됐는지 알 수 없는 상태다. */
    const failOnce = (request: Request): Response => {
      if (shouldFail) {
        shouldFail = false;
        return jsonResponse({ message: '서버 오류' }, { status: 500 });
      }

      return jsonResponse(draftRound);
    };

    confirmResponder = failOnce;

    await screen.findByText(t.result.round(1));
    const button = await screen.findByRole('button', { name: t.result.confirm });

    await userEvent.click(button);
    await waitFor(() => expect(writes).toHaveLength(1));

    await userEvent.click(button);
    await waitFor(() => expect(writes).toHaveLength(2));

    expect(writes[1]?.headers.get('Idempotency-Key')).toBe(
      writes[0]?.headers.get('Idempotency-Key'),
    );
  });

  /*
   * ⭐ 리뷰가 잡은 Blocker 다. 판정을 싣지 않으면 저장 뒤 재조회가 «저장 전» 판정을 돌려주고
   * 초안 되돌림이 사용자가 고른 값을 덮는다. 그러고 확정하면 고른 것과 다른 판정이 나가는데
   * 그 쓰기는 되돌릴 수 없다 — 불량 가능성이 있는 LOT 이 정상으로 풀린다.
   */
  it('임시 저장이 고른 판정을 함께 싣는다 — 싣지 않으면 저장 뒤 되돌아간다', async () => {
    const { writes } = renderScreen('/?ir=1001');

    await screen.findByText(t.result.round(1));

    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '보류' }));

    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).toMatchObject({ overallJudgmentCode: 'HELD' });
  });

  it('아직 고르지 않은 판정은 키 자체를 싣지 않는다 — 빈 문자열은 코드가 아니다', async () => {
    const { writes } = renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.notStarted);
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).not.toHaveProperty('overallJudgmentCode');
  });

  it('저장된 판정이 선택칸에 되돌아온다 — 표시명으로 보인다', async () => {
    renderScreen('/?ir=1001');

    /* DS Select 는 트리거 버튼이라 값이 아니라 보이는 라벨로 잰다. */
    await waitFor(() => expect(screen.getByLabelText(t.result.judgment)).toHaveTextContent('합격'));
  });

  it('상세 조회가 실패해도 「고르지 않음」으로 접지 않는다 — 다시 골라도 같은 실패가 온다', async () => {
    renderScreen('/?ir=9999');

    expect(await screen.findByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    expect(screen.queryByText(t.detail.nothingSelected)).not.toBeInTheDocument();
  });

  it('조건에 맞는 것이 없으면 조건을 넓히라고 말한다', async () => {
    renderScreen('/', () => jsonResponse(queueResponse([], pageOf(0))));

    expect(await screen.findByText(t.queue.empty)).toBeInTheDocument();
  });

  it('결과는 있는데 이 쪽에 없으면 앞쪽으로 가라고 말한다 — 조건이 아니라 쪽이 문제다', async () => {
    const { sent } = renderScreen('/?page=9', () =>
      jsonResponse(queueResponse([], pageOf(120, 9, 50))),
    );

    expect(await screen.findByText(t.pageNav.beyondLast)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.pageNav.toFirstPage }));

    await waitFor(() => expect(lastQuery(sent)?.get('page')).toBe('1'));
  });
});

describe('IqcInspectionScreen — 재검사 회차', () => {
  /**
   * ⭐ 이 슬라이스의 핵심이다. 사슬을 가리키지 않으면 서버가 회차를 +1 할 근거가 없어 같은
   * 의뢰에 1회차를 두 번 만들려 하고, 그 표에는 `UNIQUE(의뢰, 회차)` 가 걸려 있다.
   */
  it('재검사 저장이 앞 회차를 가리킨다', async () => {
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      confirmedRound,
    ]);

    await screen.findByText(t.result.round(1));
    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = writes[0] as Request;
    expect(request.method).toBe('POST');
    expect(await bodyOf(request)).toMatchObject({
      previousResultId: confirmedRound.inspectionResultId,
    });
  });

  /* 재검사가 아닌 저장에 사슬을 실으면 평범한 회차가 남의 뒤에 붙는다. */
  it('평소 저장은 앞 회차 키를 싣지 않는다', async () => {
    const { writes } = renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.notStarted);
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).not.toHaveProperty('previousResultId');
  });

  /*
   * ⛔ **회차를 미리 만들지 않는다.** 만들면 열어 보고 그만둔 사람마다 빈 회차가 쌓이고,
   * 그 순간 의뢰가 COMPLETED 에서 IN_PROGRESS 로 돌아가 대기 큐에 다시 뜬다.
   */
  it('재검사를 열기만 해서는 아무것도 보내지 않는다', async () => {
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      confirmedRound,
    ]);

    await screen.findByText(t.result.round(1));
    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));

    expect(writes).toHaveLength(0);
  });

  /*
   * ⚠ 앞 회차의 측정치가 남으면 아직 아무것도 재지 않은 새 회차에 값이 들어 있는 것처럼
   * 보이고, 검사자가 그것을 «자기가 잰 값»으로 읽는다.
   */
  it('재검사 중에는 앞 회차의 측정치를 그리지 않는다', async () => {
    renderScreen(
      '/?ir=1001',
      () => jsonResponse(queueResponse()),
      [confirmedRound],
      [expiredMeasurement],
    );

    await screen.findByText(t.result.round(1));
    expect(await screen.findByText(t.measurements.calibrationExpired)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));

    await waitFor(() =>
      expect(screen.queryByText(t.measurements.calibrationExpired)).not.toBeInTheDocument(),
    );
  });

  /* 재검사 중에는 확정본이 「앞 회차」가 되므로 이력 쪽이 제자리다. */
  it('재검사 중에는 확정본이 이전 회차 이력으로 옮겨 간다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [confirmedRound]);

    await screen.findByText(t.result.round(1));
    expect(screen.queryByText(t.history.heading)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));

    expect(screen.getByText(t.history.heading)).toBeInTheDocument();
  });

  it('회차가 둘이면 앞 회차가 이력에 남는다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      reinspectionRound,
      confirmedRound,
    ]);

    await screen.findByText(t.result.round(2));
    expect(screen.getByText(t.history.heading)).toBeInTheDocument();
  });
});

describe('IqcInspectionScreen — 확정 결과 문면', () => {
  /* 확정을 누른 «그 순간»에만 나온다 — 그것이 결과이지 상태가 아니라는 증거다. */
  it('확정하면 됐다고 말한다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      { ...draftRound, acceptedQty: 500, rejectedQty: 0, heldQty: 0 },
    ]);

    await screen.findByText(t.result.round(1));
    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));

    expect(await screen.findByText(t.result.confirmSucceeded)).toBeInTheDocument();
  });

  it('다른 의뢰로 옮기면 그 문면이 지워진다 — 그 의뢰에서 한 일이 아니다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      { ...draftRound, acceptedQty: 500, rejectedQty: 0, heldQty: 0 },
    ]);

    await screen.findByText(t.result.round(1));
    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));
    await screen.findByText(t.result.confirmSucceeded);

    await userEvent.click(
      screen.getByRole('button', { name: t.queue.openRow(queueItems[1]!.inspectionRequestNo) }),
    );

    await waitFor(() =>
      expect(screen.queryByText(t.result.confirmSucceeded)).not.toBeInTheDocument(),
    );
  });
});

describe('IqcInspectionScreen — 재검사 저장 뒤', () => {
  /**
   * ⛔ **저장 한 번에 회차 하나다.** 저장이 새 회차를 만들면 그 회차는 이제 실재하는 작성중
   * 회차라 다음 저장은 그것을 «고쳐야» 한다. 재검사 모드가 남아 있으면 저장할 때마다 새
   * 회차가 쌓이고, 검사자는 자기가 방금 넣은 값이 어디로 갔는지 알 수 없다.
   */
  it('재검사 저장이 끝나면 다음 저장은 새 회차를 또 만들지 않는다', async () => {
    const { writes } = renderScreen(
      '/?ir=1001',
      () => jsonResponse(queueResponse()),
      [confirmedRound],
      [],
      itemSpecsResponse(),
      [confirmedRound, reinspectionRound],
    );

    await screen.findByText(t.result.round(1));
    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    /* 저장이 끝나면 화면은 새로 생긴 2회차를 그린다 — 재검사 모드가 풀린 자리다. */
    await screen.findByText(t.result.round(2));

    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(2));

    expect((writes[1] as Request).method).toBe('PUT');
  });

  /**
   * ⭐ **다른 의뢰로 옮기면 재검사 모드가 풀린다.** 풀리지 않으면 옆 의뢰가 «사용자가 열지
   * 않았는데» 재검사 모드로 열린다 — 확정된 판정 옆에 빈 칸이 놓이고, 검사자는 그 의뢰의
   * 검사가 아직 안 끝난 줄 알고 값을 넣어 저장한다. 그 순간 멀쩡히 끝난 의뢰에 회차가
   * 하나 더 쌓이고 의뢰 상태가 완료에서 진행으로 되돌아간다.
   */
  /**
   * ⛔ **그만두면 확정본의 값이 돌아온다.** 비우면 그만둔 자리에 확정된 회차가 «수량 없이»
   * 놓인다 — 판정이 끝난 기록인데 화면이 비어 있으니 검사자는 자기가 방금 그것을 지웠다고
   * 읽고, 확정된 회차는 고칠 수 없으므로 되돌릴 방법도 찾지 못한다.
   */
  it('재검사를 그만두면 확정본 수량이 돌아온다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [confirmedRound]);

    await screen.findByText(t.result.round(1));
    const accepted = () => screen.getByLabelText(t.result.fields.accepted) as HTMLInputElement;
    const stored = accepted().value;
    expect(stored).not.toBe('');

    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));
    expect(accepted().value).toBe('');

    await userEvent.click(screen.getByRole('button', { name: t.result.reinspectCancel }));

    expect(accepted().value).toBe(stored);
  });

  it('다른 의뢰로 옮기면 재검사 모드가 풀린다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [confirmedRound]);

    await screen.findByText(t.result.round(1));
    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));
    expect(screen.getByText(t.result.reinspectRound)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: t.queue.openRow(queueItems[1]!.inspectionRequestNo) }),
    );

    await waitFor(() => expect(screen.getByText(t.result.round(1))).toBeInTheDocument());
    expect(screen.queryByText(t.result.reinspectRound)).not.toBeInTheDocument();
  });
});
