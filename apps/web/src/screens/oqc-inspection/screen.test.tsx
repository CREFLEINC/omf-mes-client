import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
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
 * | V6 | **저장 이후** — 새 회차가 서고 성공 문구가 남고 재검사가 앞 회차를 가리킨다 |
 *
 * 나머지(빈·오류·로딩 갈래)는 각 1건씩만 둔다.
 *
 * ⭐ **목이 상태를 갖는다.** 저장이 성공하면 그 의뢰의 회차가 실제로 하나 늘어난다. 늘지 않는
 * 목으로는 「저장 이후」가 통째로 미검증으로 남고, 그 구간에 걸린 규율(성공 문구가 언제까지
 * 남는가 · 회차가 잠기는가 · 재검사가 무엇을 가리키는가)을 지워도 시험이 전부 통과한다.
 */

const t = messages.oqcInspection;
/** 고른 줄(대기 의뢰)을 다시 누른다 — 고르지 않은 상태로 돌아간다(#197). */
const reselectWaiting = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await screen.findByRole('button', {
      name: t.queue.openRow(waitingRequest.inspectionRequestNo),
    }),
  );
};

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
  /** 처음 갖고 있던 회차. 기본은 「아직 아무도 판정하지 않음」이다 */
  rounds?: Record<number, InspectionResultResponse[]>;
  /** 저장 응답. 기본은 성공(201) */
  save?: (attempt: number) => Response;
  /** 저장 응답을 붙잡아 둘 문 */
  saveGate?: { opened: Promise<void> };
  /** 상세 응답을 붙잡아 둘 문 */
  detailGate?: { opened: Promise<void> };
  /** 의뢰 기준 버전의 합격판정개수(omf-all-around#126). 기본은 없음 — 자동 판정이 없다 */
  acceptanceNumber?: number | null;
}

interface SaveBody {
  inspectionRequestId: number;
  acceptedQty: number;
  rejectedQty: number;
  heldQty: number;
  overallJudgmentCode?: string;
  previousResultId?: number;
}

/**
 * 저장이 성공했을 때 서버가 갖게 되는 새 회차.
 *
 * ⭐ **회차 번호를 서버가 센다** — 화면이 세지 않는다는 규율을 목도 지켜야, 화면이 몰래 세기
 * 시작해도 시험이 그것을 정상으로 통과시키지 않는다.
 */
const appendedRound = (body: SaveBody, existing: number): InspectionResultResponse => ({
  ...confirmedRound,
  inspectionResultId: 9200 + existing,
  inspectionResultNo: `IRS-OQC-90${String(existing)}`,
  inspectionRequestId: body.inspectionRequestId,
  inspectionRound: existing + 1,
  acceptedQty: body.acceptedQty,
  rejectedQty: body.rejectedQty,
  heldQty: body.heldQty,
  overallJudgmentCode: body.overallJudgmentCode ?? '',
  statusCode: 'CONFIRMED',
  ...(body.previousResultId === undefined ? {} : { previousResultId: body.previousResultId }),
});

const renderScreen = (options: ScreenOptions = {}) => {
  /** 저장 요청 원본 — 헤더와 몸통을 그대로 본다 */
  const saves: Request[] = [];
  /** 목이 든 회차. 저장이 성공하면 여기가 늘어난다 — 실제 서버가 하는 일이다 */
  const rounds = new Map<number, InspectionResultResponse[]>(
    Object.entries(options.rounds ?? {}).map(([id, list]) => [Number(id), list]),
  );
  /** 공통코드를 몇 번 불렀나 — 저장이 마스터까지 다시 부르지 않는지 본다 */
  let codeValueCalls = 0;
  /** 목록을 몇 번 불렀나 — 저장 뒤 목록이 «다시» 서는지 본다 */
  let queueCalls = 0;

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const isSave = path === '/quality/inspection-results' && request.method === 'POST';

    /* 세션 · OA 공장 판정(검사 기본 정보의 시리얼/LOT 칸 · #136) — 합성 계정은 OA 공장이 없다. */
    if (path.endsWith('/app/sessions/current')) return jsonResponse(SYNTHETIC_SESSION);
    if (path === '/mdm/plants')
      return jsonResponse({
        items: [],
        page: { page: 1, size: 100, totalItems: 0, totalPages: 0 },
      });

    if (path === '/quality/inspection-requests') {
      queueCalls += 1;

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

    if (path.startsWith('/quality/inspection-plan-versions/')) {
      return jsonResponse({
        inspectionPlanVersion: {
          inspectionPlanVersionId: Number(path.split('/').at(-1)),
          samplingMethodCode: 'SAMPLE_BY_LOT',
          acceptanceNumber: options.acceptanceNumber ?? null,
        },
      });
    }

    if (path === '/mdm/code-values') {
      codeValueCalls += 1;

      return jsonResponse(codeValuesResponse(overallJudgmentCodeValues));
    }

    if (path === '/quality/inspection-results' && request.method === 'GET') {
      const id = Number(url.searchParams.get('inspectionRequestId'));

      return jsonResponse(roundsResponse(rounds.get(id) ?? []));
    }

    if (isSave) {
      saves.push(request.clone());
      if (options.saveGate !== undefined) await options.saveGate.opened;

      const response = options.save?.(saves.length);

      if (response !== undefined) return response;

      /* 성공했으면 그 의뢰의 회차가 실제로 하나 는다. */
      const body = (await request.clone().json()) as SaveBody;
      const existing = rounds.get(body.inspectionRequestId) ?? [];
      const created = appendedRound(body, existing.length);

      rounds.set(body.inspectionRequestId, [...existing, created]);

      return jsonResponse(created, { status: 201 });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  const view = renderWithProviders(
    <SessionProvider>
      <OqcInspectionScreen />
    </SessionProvider>,
    {
      route: options.route ?? '/',
      fetch: stubFetch,
    },
  );

  return {
    ...view,
    saves,
    rounds,
    codeValueCallsAt: () => codeValueCalls,
    queueCallsAt: () => queueCalls,
  };
};

const acceptedField = () => screen.getByLabelText(t.result.fields.accepted);

/**
 * 상세에서 다른 의뢰로 옮긴다 — 목록과 상세를 갈아 끼우므로(omf-all-around#136) 「← 목록」으로 돌아가(저장하지 않은
 * 입력이 있으면 「저장하지 않고 이동」) 그 줄을 연다. 옮긴 뒤 지켜야 할 규칙(R2 · R3)은 종전과 같다.
 */
const switchTo = async (user: ReturnType<typeof userEvent.setup>, inspectionRequestNo: string) => {
  await user.click(
    await screen.findByRole('button', { name: t.queue.openRow(inspectionRequestNo) }),
  );
  const leave = screen.queryByRole('button', { name: t.detail.leaveAnyway });
  if (leave !== null) await user.click(leave);
};

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

/*
 * ⛔ **서버가 거부한 사유를 삼키지 않는다**(SHIP-FINAL-01 D1).
 *
 * D1 실측에서 저장이 400 으로 막혔는데 「화면은 조용히 폼 그대로였다」는 보고가 있었다. 여기서
 * 두 봉투 모양(표준 `{errors:[…]}` · 실측이 인용한 **낱개** 항목) 모두로 재현해 보니 **사유는
 * 뜬다** — 낱개는 정규화가 봉투로 인정하지 않아 `kind:'http'` 로 떨어지지만, 그때도 배너가
 * 서버 문구를 함께 낸다. 그래서 「안 보였다」는 다른 까닭(확인 창 뒤·스크롤 밖)일 가능성이
 * 크다. 조용히 지나가는 일이 다시 생기지 않도록 이 자리를 그물로 남긴다.
 */
describe('OqcInspectionScreen — 저장이 거부될 때', () => {
  it('서버가 짚어 준 사유가 화면에 그대로 뜬다', async () => {
    const user = userEvent.setup();
    renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      save: () =>
        jsonResponse(
          {
            scope: 'field',
            code: 'INVALID',
            message: 'INSPECTION_RESULT_STATUS 에 없거나 사용 중지된 코드입니다.',
            field: 'statusCode',
          },
          { status: 400 },
        ),
    });

    await screen.findByLabelText(t.result.fields.accepted);
    await fillJudgment(user);
    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);

    expect(
      await screen.findByText('INSPECTION_RESULT_STATUS 에 없거나 사용 중지된 코드입니다.'),
    ).toBeInTheDocument();
  });
});

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
      /* ⛔ 영문이다 — 옛 한국어 값은 서버가 400 INVALID 로 막는다(D1 · `inspection-status.ts`). */
      statusCode: 'CONFIRMED',
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

    await switchTo(user, anotherWaitingRequest.inspectionRequestNo);

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
    await switchTo(user, anotherWaitingRequest.inspectionRequestNo);
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

/**
 * ⭐ **집중 지점 V6 — 저장 «이후».**
 *
 * 목이 저장 뒤 회차를 늘리지 않으면 이 구간이 통째로 미검증으로 남는다. 그 상태에서는 성공
 * 문구가 언제까지 남는지 · 회차가 잠기는지 · 재검사가 무엇을 가리키는지를 지워도 시험이 전부
 * 통과한다 — 실제로 그랬다(검증 회차 지적).
 */
describe('OqcInspectionScreen — 저장 이후(V6)', () => {
  it('저장이 성공하면 새 회차가 확정으로 서고 성공 문구가 «남는다»', async () => {
    const user = userEvent.setup();

    renderScreen({ route: `/?ir=${String(waitingRequest.inspectionRequestId)}` });

    await screen.findByLabelText(t.result.fields.accepted);
    await fillJudgment(user);
    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);

    /* 새 회차가 도착한 «뒤»에 본다 — 잠깐 떴다 사라지는 문구를 통과시키지 않으려고. */
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.result.reinspect })).toBeInTheDocument(),
    );

    expect(screen.getByText(t.result.saved)).toBeInTheDocument();
    expect(screen.getByLabelText(t.result.fields.accepted)).toBeDisabled();
    /* 성공했으면 확인 창이 닫힌다 — 실패에는 닫지 않는다(같은 멱등 키로 다시 눌러야 한다). */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('재검사가 앞 회차를 가리키고, 회차 번호를 화면이 세지 않는다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      rounds: { [waitingRequest.inspectionRequestId]: [confirmedRound] },
    });

    await user.click(await screen.findByRole('button', { name: t.result.reinspect }));
    await fillJudgment(user);
    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);
    await waitFor(() => expect(saves).toHaveLength(1));

    const body = (await saves[0]?.clone().json()) as Record<string, unknown>;

    expect(body.previousResultId).toBe(confirmedRound.inspectionResultId);
    /* ⛔ 회차 번호는 서버가 +1 한다 — 화면이 실어 보내면 두 사람이 같은 번호를 만든다. */
    expect('inspectionRound' in body).toBe(false);

    /* 앞 회차가 지워지지 않고 사슬로 쌓인다 — 이력이 두 줄이 된다. */
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: t.history.heading })).getAllByRole('listitem'),
      ).toHaveLength(2),
    );
  });

  it('저장이 공통코드까지 다시 부르지 않는다 — 마스터는 저장이 바꾸지 않는다', async () => {
    const user = userEvent.setup();
    const { codeValueCallsAt } = renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
    });

    await screen.findByLabelText(t.result.fields.accepted);

    const before = codeValueCallsAt();

    await fillJudgment(user);
    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.result.reinspect })).toBeInTheDocument(),
    );

    expect(codeValueCallsAt()).toBe(before);
  });

  /**
   * ⚠ **이미 본 의뢰로 «되돌아가는» 길이어야 한다.** 처음 고르는 의뢰는 회차 조회가 부르는
   * 중이라 폼이 잠깐 사라졌다 다시 서고, 그 우연한 재장착이 확인 창을 함께 지운다 — 그 길로
   * 재면 폼을 의뢰에 매어 두지 않아도 시험이 통과한다(실측). 캐시가 찬 의뢰로 돌아가면 폼이
   * 자리를 지키므로 **매어 둔 것이 있어야만** 창이 닫힌다.
   */
  /**
   * ⭐ **판정한 의뢰가 목록에서 빠지는지는 서버가 정한다.** 화면이 그 판단을 흉내 내지 않는
   * 대신 목록을 다시 부른다 — 다시 부르지 않으면 「대기·진행만 보기」에 방금 판정한 줄이 그대로
   * 남아, 검사자가 **이미 한 일을 다시 하러 들어간다.**
   */
  it('저장 뒤 목록을 다시 부른다', async () => {
    const user = userEvent.setup();
    const { queueCallsAt } = renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
    });

    await screen.findByLabelText(t.result.fields.accepted);

    const before = queueCallsAt();

    await fillJudgment(user);
    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.result.reinspect })).toBeInTheDocument(),
    );

    await waitFor(() => expect(queueCallsAt()).toBeGreaterThan(before));
  });

  /**
   * ⭐ **재검사가 다시 검사하는 대상은 앞 회차가 아니라 의뢰다.** 폼에 회차를 넘기지 않으면서
   * (「아직 없는 새 회차」다) 수량만 그 회차에서 가져오면 두 말이 한 화면에서 어긋난다.
   */
  it('재검사 중에는 검사수량이 의뢰의 대상 수량이다', async () => {
    const user = userEvent.setup();

    renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      /* 앞 회차가 «다른» 수량을 들고 있어야 두 값이 갈린다. */
      rounds: { [waitingRequest.inspectionRequestId]: [{ ...confirmedRound, inspectedQty: 300 }] },
    });

    /*
     * 「검사수량」 라벨의 «짝»만 읽는다 — 폼에는 잔여·합계에도 같은 숫자가 설 수 있고, 우측
     * 대상 정보에도 같은 라벨이 있다.
     */
    const inspectedQtyText = (): string => {
      const label = within(screen.getByRole('form', { name: t.result.heading })).getByText(
        t.result.fields.inspectedQty,
      );

      return label.parentElement?.querySelector('dd')?.textContent ?? '';
    };

    await screen.findByRole('button', { name: t.result.reinspect });
    expect(inspectedQtyText()).toBe('300');

    await user.click(screen.getByRole('button', { name: t.result.reinspect }));

    expect(inspectedQtyText()).toBe(String(waitingRequest.targetQty));
  });

  it('열어 둔 확인 창은 의뢰를 바꾸면 닫힌다 — 앞 의뢰의 창이 새 번호를 달고 서면 안 된다', async () => {
    const user = userEvent.setup();

    renderScreen();

    /* ① 먼저 B 를 열어 회차·상세를 캐시에 채운다. */
    await user.click(
      await screen.findByRole('button', {
        name: t.queue.openRow(anotherWaitingRequest.inspectionRequestNo),
      }),
    );
    await screen.findByLabelText(t.result.fields.accepted);

    /* ② A 로 옮겨 확인 창을 연다. */
    await switchTo(user, waitingRequest.inspectionRequestNo);
    await waitFor(() =>
      expect(detailPane().getByText(waitingRequest.inspectionRequestNo)).toBeInTheDocument(),
    );
    await fillJudgment(user);
    await user.click(screen.getByRole('button', { name: t.result.save }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    /* ③ 캐시가 찬 B 로 되돌아간다 — 폼이 자리를 지킨다. */
    await switchTo(user, anotherWaitingRequest.inspectionRequestNo);
    await waitFor(() =>
      expect(detailPane().getByText(anotherWaitingRequest.inspectionRequestNo)).toBeInTheDocument(),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
  it('고르기 전에는 목록만 서고 상세(판정)는 서지 않는다(#136)', async () => {
    renderScreen();

    expect(
      await screen.findByRole('button', {
        name: t.queue.openRow(waitingRequest.inspectionRequestNo),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(t.result.fields.accepted)).not.toBeInTheDocument();
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
    /* 고른 것이 사라진 것처럼 목록으로 돌아가지 않는다 — 상세 자리에 실패가 선다. */
    expect(screen.queryByText(messages.common.inspectionHub.pickRequest)).not.toBeInTheDocument();
  });

  it('고른 의뢰의 대상 정보와 판정 폼이 함께 선다', async () => {
    renderScreen({ route: `/?ir=${String(waitingRequest.inspectionRequestId)}` });

    await screen.findByLabelText(t.result.fields.accepted);

    expect(detailPane().getByText(waitingRequest.inspectionRequestNo)).toBeInTheDocument();
    expect(
      detailPane().getByText(
        t.queue.target(t.queue.targetTypes.SHIPMENT_REQUEST ?? '', waitingRequest.targetId),
      ),
    ).toBeInTheDocument();
    /* 목록은 옆에 그대로 선다 — 목록과 상세가 나란히 선다(#185). */
    expect(
      await screen.findByRole('button', {
        name: t.queue.openRow(waitingRequest.inspectionRequestNo),
      }),
    ).toBeInTheDocument();
  });
});

/*
 * omf-all-around#136 — 목록과 상세(판정)를 갈아 끼운다(IQC #133 과 같은 짜임). 「← 목록」은 검색 조건 · 쪽을 남기고,
 * 저장하지 않은 입력이 있으면 한 번 묻는다.
 */
describe('OqcInspectionScreen — 목록 ↔ 상세(#136)', () => {
  it('줄을 누르면 옆에 상세가 서고, 같은 줄을 다시 눌러 닫아도 검색 조건이 그대로다', async () => {
    const user = userEvent.setup();

    renderScreen({ route: '/?q=OQC&pd=0' });

    await user.click(
      await screen.findByRole('button', {
        name: t.queue.openRow(waitingRequest.inspectionRequestNo),
      }),
    );
    await screen.findByLabelText(t.result.fields.accepted);

    /* 입력이 없으면 묻지 않고 바로 돌아간다. */
    await reselectWaiting(user);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByLabelText(t.filters.keyword)).toHaveValue('OQC');
    expect(screen.getByRole('checkbox', { name: t.filters.pendingOnly })).not.toBeChecked();
  });

  it('저장하지 않은 수량이 있으면 묻고, 「계속 작성」이면 입력이 그대로 남는다', async () => {
    const user = userEvent.setup();

    renderScreen({ route: `/?ir=${String(waitingRequest.inspectionRequestId)}` });

    await screen.findByLabelText(t.result.fields.accepted);
    await user.type(acceptedField(), '480');
    await reselectWaiting(user);

    expect(screen.getByRole('dialog', { name: t.detail.leaveUnsaved })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.detail.keepEditing }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(acceptedField()).toHaveValue('480');
  });

  it('「저장하지 않고 이동」이면 상세가 닫히고 아무것도 저장하지 않는다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen({ route: `/?ir=${String(waitingRequest.inspectionRequestId)}` });

    await screen.findByLabelText(t.result.fields.accepted);
    await user.type(acceptedField(), '480');
    await reselectWaiting(user);
    await user.click(screen.getByRole('button', { name: t.detail.leaveAnyway }));

    await waitFor(() =>
      expect(screen.queryByLabelText(t.result.fields.accepted)).not.toBeInTheDocument(),
    );
    expect(saves).toHaveLength(0);
  });

  it('저장하지 않은 수량이 있으면 목록에서 다른 의뢰를 눌러도 묻는다(#185)', async () => {
    const user = userEvent.setup();

    renderScreen({ route: `/?ir=${String(waitingRequest.inspectionRequestId)}` });

    await screen.findByLabelText(t.result.fields.accepted);
    await user.type(acceptedField(), '480');
    await user.click(
      await screen.findByRole('button', {
        name: t.queue.openRow(anotherWaitingRequest.inspectionRequestNo),
      }),
    );

    expect(screen.getByRole('dialog', { name: t.detail.leaveUnsaved })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.detail.keepEditing }));
    expect(acceptedField()).toHaveValue('480');
  });

  it('확정된 회차는 고칠 칸이 없으니 묻지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      rounds: {
        [waitingRequest.inspectionRequestId]: [
          { ...confirmedRound, inspectionRequestId: waitingRequest.inspectionRequestId },
        ],
      },
    });

    await screen.findByRole('button', { name: t.result.reinspect });
    await reselectWaiting(user);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', {
        name: t.queue.openRow(waitingRequest.inspectionRequestNo),
      }),
    ).toBeInTheDocument();
  });
});

/*
 * omf-all-around#126 — 기준에 합격판정개수가 있으면 수량으로 판정을 채우고, 다르게 고르면 변경 사유를 받아야 저장된다.
 * IQC(#125)와 같은 규칙이다. fillJudgment 는 합격 480 · 불합격 15 · 보류 5 를 치고 「합격」을 고른다.
 */
describe('OqcInspectionScreen — 합격판정개수 기준 자동 판정(#126)', () => {
  const change = t.result.judgmentChange;

  it('합격판정개수 5 · 불합격 15 인데 합격을 고르면 사유 칸이 서고, 사유를 넣어야 저장되며 사유가 실린다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      acceptanceNumber: 5,
    });

    await screen.findByLabelText(t.result.fields.accepted);
    await fillJudgment(user);

    const reason = await screen.findByLabelText(new RegExp(change.reason));
    expect(screen.getByText(change.required)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled();

    await user.type(reason, '  고객 승인 — 출하 허용 ');
    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);

    await waitFor(() => expect(saves).toHaveLength(1));
    const body = (await (saves[0] as Request).json()) as Record<string, unknown>;
    expect(body.overallJudgmentCode).toBe('ACCEPTED');
    expect(body.judgmentChangeReason).toBe('고객 승인 — 출하 허용');
  });

  it('수량을 치면 판정을 자동으로 채운다 — 불합격 15 > 5 는 불합격이고 사유 칸이 없다', async () => {
    const user = userEvent.setup();
    renderScreen({
      route: `/?ir=${String(waitingRequest.inspectionRequestId)}`,
      acceptanceNumber: 5,
    });

    await screen.findByLabelText(t.result.fields.accepted);
    await user.type(acceptedField(), '480');
    await user.type(screen.getByLabelText(t.result.fields.rejected), '15');
    await user.type(screen.getByLabelText(t.result.fields.held), '5');

    expect(await screen.findByText(new RegExp(change.expected('불합격')))).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.result.judgment })).toHaveTextContent('불합격');
    expect(screen.queryByLabelText(new RegExp(change.reason))).toBeNull();
  });

  it('합격판정개수가 없는 기준이면 자동 판정·사유 칸이 없고, 사유 없이 저장된다(종전 그대로)', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen({ route: `/?ir=${String(waitingRequest.inspectionRequestId)}` });

    await screen.findByLabelText(t.result.fields.accepted);
    await fillJudgment(user);

    expect(screen.queryByLabelText(new RegExp(change.reason))).toBeNull();
    await user.click(screen.getByRole('button', { name: t.result.save }));
    await pressSaveInDialog(user);

    await waitFor(() => expect(saves).toHaveLength(1));
    const body = (await (saves[0] as Request).json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('judgmentChangeReason');
  });
});
