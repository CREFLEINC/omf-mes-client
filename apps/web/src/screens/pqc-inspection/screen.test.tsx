import { messages } from '@omf-mes/i18n';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  codeValuesResponse,
  draftRound,
  itemSpecsResponse,
  measurementsResponse,
  expiredMeasurement,
  overallJudgmentCodeValues,
  roundsResponse,
  waitingRequest,
} from './fixtures';
import type { CodeValueResponse } from './code-options';
import { PqcInspectionScreen } from './screen';

const t = messages.pqcInspection;

/**
 * 요청이 실제로 무엇을 실어 갔는지 본다 — **화면이 무엇을 저장하는가**가 이 화면의 판정
 * 자료이므로, 그려진 글자보다 나간 본문이 더 중요한 자리가 많다.
 */
const renderScreen = (route = '/?ir=1001', rounds = [draftRound], specs = itemSpecsResponse()) => {
  const writes: Request[] = [];

  const fetch = createStubFetch([
    {
      /* 쓰기는 전부 여기서 잡는다 — 무엇이 나갔는지가 이 화면의 판정 자료다. */
      match: (request) => request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone() as Request);
        return jsonResponse(draftRound, { status: 201 });
      },
    },
    {
      match: (request) => new URL(request.url).pathname.endsWith('/measurements'),
      respond: () => jsonResponse(measurementsResponse([])),
    },
    {
      match: (request) => new URL(request.url).pathname.endsWith('/items'),
      respond: () => jsonResponse(specs),
    },
    {
      match: (request) => new URL(request.url).pathname === '/quality/inspection-results',
      respond: () => jsonResponse(roundsResponse(rounds)),
    },
    {
      /*
       * 회차 단건 — ⭐ **`ETag` 를 여기서만 준다.** 목록 200 에는 없고, 토큰 보관소가 응답이
       * 온 «경로»를 열쇠로 쓴다. 이 경로를 빠뜨리면 `If-Match` 를 채우지 못해 저장이 아예
       * 나가지 않는다 — 실제로 그 상태로 시험이 먼저 붉어졌다.
       */
      match: (request) =>
        /^\/quality\/inspection-results\/\d+$/.test(new URL(request.url).pathname),
      respond: () => jsonResponse(draftRound, { headers: { ETag: 'W/"1"' } }),
    },
    {
      match: (request) => new URL(request.url).pathname.startsWith('/quality/inspection-requests/'),
      respond: () => jsonResponse(waitingRequest),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: () => jsonResponse(codeValuesResponse(overallJudgmentCodeValues)),
    },
  ]);

  renderWithProviders(<PqcInspectionScreen />, { route, fetch });

  return { writes };
};

/**
 * 저장된 판정이 코드 목록에 «없는» 상태를 만든다 — 코드값이 사용 중지된 경우다.
 * 목록은 다른 코드 하나만 주고, 측정치·회차에는 `ACCEPTED` 가 저장돼 있다.
 */
const renderWithStoredJudgment = async (): Promise<{ measured: string }> => {
  const fetch = createStubFetch([
    {
      match: (request) => request.method !== 'GET',
      respond: () => jsonResponse(draftRound, { status: 201 }),
    },
    {
      match: (request) => new URL(request.url).pathname.endsWith('/measurements'),
      respond: () => jsonResponse(measurementsResponse([expiredMeasurement])),
    },
    {
      match: (request) => new URL(request.url).pathname.endsWith('/items'),
      respond: () => jsonResponse(itemSpecsResponse()),
    },
    {
      match: (request) => new URL(request.url).pathname === '/quality/inspection-results',
      respond: () => jsonResponse(roundsResponse([draftRound])),
    },
    {
      match: (request) =>
        /^\/quality\/inspection-results\/\d+$/.test(new URL(request.url).pathname),
      respond: () => jsonResponse(draftRound, { headers: { ETag: 'W/"1"' } }),
    },
    {
      match: (request) => new URL(request.url).pathname.startsWith('/quality/inspection-requests/'),
      respond: () => jsonResponse(waitingRequest),
    },
    {
      /* 목록에 저장된 코드가 «없다» — 다른 코드 하나만 준다. */
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: () =>
        jsonResponse(
          codeValuesResponse([
            { ...(overallJudgmentCodeValues[0] as CodeValueResponse), code: 'OTHER' },
          ]),
        ),
    },
  ]);

  renderWithProviders(<PqcInspectionScreen />, { route: '/?ir=1001', fetch });

  return { measured: expiredMeasurement.judgmentCode };
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.json()) as Record<string, unknown>;

describe('PqcInspectionScreen — 대상을 받는 방식', () => {
  /*
   * ⭐ 이 화면은 작업 화면에서 대상을 받아 열린다(스펙 §3·§5-9 에 조회·필터가 없다).
   * ⛔ 「목록에서 고르세요」라고 말하지 않는다 — 고를 목록이 이 화면에 없다.
   */
  it('진입 인자가 없으면 작업 화면에서 진입하라고 안내한다', async () => {
    renderScreen('/');

    expect(await screen.findByText(t.detail.nothingSelected)).toBeInTheDocument();
  });

  it('진입 인자가 식별자가 아니면 대상이 없는 것으로 다룬다', async () => {
    renderScreen('/?ir=0');

    expect(await screen.findByText(t.detail.nothingSelected)).toBeInTheDocument();
  });

  /*
   * ⚠ 검사 시점의 기준 버전이 고정된다 — 감추면 어느 기준으로 잰 값인지 알 수 없다.
   * §3 도면이 이 값을 **좌측 구획 머리**에 두므로 거기서 찾는다.
   */
  it('검사기준 버전을 좌측 구획 머리에 상시 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(t.detail.planVersionNote)).toBeInTheDocument();
    expect(
      screen.getByText(
        `${t.detail.fields.inspectionPlanVersionId} ${waitingRequest.inspectionPlanVersionId}`,
      ),
    ).toBeInTheDocument();
  });

  /*
   * ⛔ **§4-A 를 표시 목록으로 읽지 않는다.** 그 표는 테이블의 필드 표이고, 무엇을 어디에
   * 그리는지는 §3 도면이 정한다 — 도면의 헤더는 W/O·품목·LOT 다.
   */
  /*
   * 도면의 헤더는 W/O·품목·LOT(그릴 자료가 있는 셋)이고, 그리는 «형태»는 저장소 전례를
   * 따른다 — 읽기 전용 요약은 라벨과 값을 짝으로 둔다.
   */
  /*
   * 도면 §3 의 **위쪽 64 는 한 줄**이다 — 제목과 대상이 같은 머리에 선다. 대상 줄을 머리
   * «아래»에 따로 두면 세로 예산(헤더 64 + 본문 616 + 액션바 88 = 768)이 넘쳐 액션바가
   * 화면 밖으로 밀린다. 그래서 「무엇을 그리는가」와 함께 **어디에 서는가**도 지킨다.
   */
  it('작업지시·품목·대상 LOT 이 라벨과 함께 머리 한 줄에 선다', async () => {
    renderScreen();

    const target = await screen.findByLabelText(t.detail.heading);

    expect(target.closest('.pop-header')).not.toBeNull();
    expect([...target.children].map((child) => child.textContent)).toEqual([
      /* 이 픽스처의 의뢰에는 작업지시가 없다 — 지어내지 않고 빈 값 표식을 세운다. */
      `${t.detail.fields.workOrderId} ${t.emptyValue}`,
      `${t.detail.fields.itemId} ${String(waitingRequest.itemId)}`,
      `${t.detail.fields.lotId} ${String(waitingRequest.lotId)}`,
    ]);
  });

  /*
   * 도면 §3 머리 오른쪽 끝의 상태 표식이다. §5-7·§6 이 이 화면을 오프라인 지원 대상으로
   * 못박았으므로 **끊겼다는 사실을 화면이 말해야 한다.**
   *
   * ⚠ 대상을 못 불러온 갈래에서도 선다 — 그 화면이야말로 「연결이 끊겨서인가」를 물을
   * 자리다. 그래서 진입 인자가 없는 갈래로 확인한다.
   */
  it('연결이 끊기면 머리에서 그 사실을 말한다', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    try {
      renderScreen('/');

      const header = await screen.findByRole('banner');

      expect(within(header).getByText(messages.common.connection.offline)).toBeInTheDocument();
    } finally {
      online.mockRestore();
    }
  });

  /* ⚠ 샘플 수의 단위가 미확정이다 — 어느 한쪽으로 읽어 계산하지 않고 그 사실을 밝힌다. */
  it('샘플 단위가 미확정이라는 사실을 밝힌다', async () => {
    renderScreen();

    expect(await screen.findByText(t.detail.sampleUnitPending)).toBeInTheDocument();
  });
});

describe('PqcInspectionScreen — 검사 기준이 없는 갈래', () => {
  /**
   * 기준 없는 의뢰를 흉내 낸다 — 기준 버전이 비어 온다. 어느 경로를 «불렀는지»도 함께 센다.
   */
  const renderWithoutStandard = () => {
    const called: string[] = [];

    const fetch = createStubFetch([
      {
        match: (request) => request.method !== 'GET',
        respond: (request) => {
          called.push(new URL(request.url).pathname);
          return jsonResponse(draftRound, { status: 201 });
        },
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith('/items'),
        respond: (request) => {
          called.push(new URL(request.url).pathname);
          return jsonResponse(itemSpecsResponse());
        },
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith('/measurements'),
        respond: () => jsonResponse(measurementsResponse([])),
      },
      {
        match: (request) => new URL(request.url).pathname === '/quality/inspection-results',
        respond: () => jsonResponse(roundsResponse([draftRound])),
      },
      {
        match: (request) =>
          /^\/quality\/inspection-results\/\d+$/.test(new URL(request.url).pathname),
        respond: () => jsonResponse(draftRound, { headers: { ETag: 'W/"1"' } }),
      },
      {
        match: (request) =>
          new URL(request.url).pathname.startsWith('/quality/inspection-requests/'),
        /* 기준 버전이 «비어» 온다 — 기준 없이 만들어진 의뢰다. */
        respond: () => jsonResponse({ ...waitingRequest, inspectionPlanVersionId: undefined }),
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: () => jsonResponse(codeValuesResponse(overallJudgmentCodeValues)),
      },
    ]);

    renderWithProviders(<PqcInspectionScreen />, { route: '/?ir=1001', fetch });

    return { called };
  };

  /*
   * ⛔ 「기준을 먼저 등록하세요」로 되돌리면 현장이 멈춘다 — 기준 미등록은 실제로 일어나는
   * 상태이고, 확정이 「단순 선택이라도 하라」고 한 이유가 그것이다.
   */
  it('막지 않고 판정과 자유 입력을 그린다', async () => {
    renderWithoutStandard();

    expect(await screen.findByText(t.noStandard.note)).toBeInTheDocument();
    expect(screen.getByLabelText(t.noStandard.remarks)).toBeInTheDocument();
    /* 항목표는 이 갈래에 없다. */
    expect(screen.queryByText(t.measurements.heading)).not.toBeInTheDocument();
  });

  it('항목 목록 경로를 부르지 않는다', async () => {
    const { called } = renderWithoutStandard();

    await screen.findByText(t.noStandard.note);

    expect(called.some((path) => path.endsWith('/items'))).toBe(false);
  });

  /*
   * ⛔ 두 값짜리 목록을 따로 만들지 않는다 — 이 갈래의 판정은 **종합 판정 그것**이고
   * 우측 구획에 이미 있다(통지 #589). 좌우에 같은 값을 두 번 두지 않는다.
   */
  it('종합 판정을 좌측에 다시 두지 않는다', async () => {
    renderWithoutStandard();

    await screen.findByText(t.noStandard.note);

    /* 우측 구획에 하나만 있어야 한다 — 둘이면 어느 쪽이 정본인지 알 수 없다. */
    expect(screen.getAllByLabelText(t.result.judgment)).toHaveLength(1);
  });

  it('자유 입력을 적고 저장할 수 있다', async () => {
    renderWithoutStandard();

    await screen.findByText(t.noStandard.note);
    await userEvent.type(screen.getByLabelText(t.noStandard.remarks), '외관 양호');
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    expect(await screen.findByText(t.result.saved)).toBeInTheDocument();
  });
});

describe('PqcInspectionScreen — 검사 항목 구획', () => {
  /* ⭐ 무엇이 남았는지가 이 구획의 정보다(스펙 §3 「진행 2 / 3」). */
  it('진행 n / m 을 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(t.measurements.progress(0, 5))).toBeInTheDocument();
  });

  /*
   * ⛔ **항목 판정과 종합 판정은 그룹이 다르다** — 항목에는 「보류」가 없다. 합쳐 쓰면 항목
   * 선택칸에 보류가 떠서 설계와 어긋난 값이 저장된다.
   */
  it('항목 판정과 종합 판정을 서로 다른 코드 그룹으로 부른다', async () => {
    const requested: string[] = [];

    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: (request) => {
          requested.push(new URL(request.url).searchParams.get('codeGroupCode') ?? '');
          return jsonResponse(codeValuesResponse(overallJudgmentCodeValues));
        },
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith('/measurements'),
        respond: () => jsonResponse(measurementsResponse([])),
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith('/items'),
        respond: () => jsonResponse(itemSpecsResponse()),
      },
      {
        match: (request) => new URL(request.url).pathname === '/quality/inspection-results',
        respond: () => jsonResponse(roundsResponse([draftRound])),
      },
      {
        match: (request) =>
          new URL(request.url).pathname.startsWith('/quality/inspection-requests/'),
        respond: () => jsonResponse(waitingRequest),
      },
    ]);

    renderWithProviders(<PqcInspectionScreen />, { route: '/?ir=1001', fetch });

    await screen.findByText(t.measurements.heading);

    await waitFor(() => expect(requested.length).toBeGreaterThanOrEqual(2));
    expect(requested).toContain('INSPECTION_RESULT_OVERALL_JUDGMENT');
    expect(requested).toContain('INSPECTION_MEASUREMENT_JUDGMENT');
  });
});

describe('PqcInspectionScreen — 저장이 실어 가는 것', () => {
  /*
   * ⛔ **처분은 잠정이라 저장하지 않는다**(REQ-PR-0025). 보내면 정본이 둘이 되고, 뒤에 오는
   * 확정이 이 잠정값과 어긋나도 어느 쪽이 옳은지 화면이 말할 수 없다.
   */
  it('본문에 처분을 싣지 않는다', async () => {
    const { writes } = renderScreen();

    await screen.findByLabelText(t.result.fields.rejected);
    await userEvent.type(screen.getByLabelText(t.result.fields.rejected), '2');
    await userEvent.click(screen.getByLabelText(t.disposition.rework));
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);
    /* 키 이름 화이트리스트가 아니라 «있어야 할 키 전량»으로 견준다. */
    expect(Object.keys(body).sort()).toEqual(
      [
        'acceptedQty',
        'coverageFromAt',
        'coverageToAt',
        'heldQty',
        'inspectedAt',
        'inspectedQty',
        'inspectionRequestId',
        'rejectedQty',
        'statusCode',
        'uomId',
      ].sort(),
    );
  });

  /*
   * ⭐ **저장은 되돌릴 수 없는 쓰기라 멱등 키를 싣는다** — 5xx 나 끊김 뒤에 다시 눌러도
   * 서버가 다른 쓰기로 보지 않는다.
   *
   * ⛔ **`If-Match` 는 싣지 않는다.** 이 경로는 언제나 «새로 만들기»라 견줄 판본이 없다 —
   * 실으면 서버가 없는 판본을 찾다가 412 로 되돌린다.
   */
  it('멱등 키를 싣고 판본 헤더는 싣지 않는다', async () => {
    const { writes } = renderScreen();

    await screen.findByRole('button', { name: t.result.save });
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const sent = writes[0] as Request;
    expect(sent.headers.get('Idempotency-Key')).toBeTruthy();
    expect(sent.headers.get('If-Match')).toBeNull();
  });

  /*
   * ⛔ 검사자·단말을 보내지 않는다 — 서버가 인증 주체에서 채운다. 화면이 세션 값을 실으면
   * 품질 감사 기록에 엉뚱한 사람이 남고, 값이 그럴듯한 정수라 아무도 눈치채지 못한다.
   */
  it('검사자와 단말을 보내지 않는다', async () => {
    /* 회차가 없으면 «새로 만들기» 경로다 — 그때 본문에 상태가 실린다. */
    const { writes } = renderScreen('/?ir=1001', []);

    await screen.findByRole('button', { name: t.result.save });
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);
    expect(body).not.toHaveProperty('inspectorId');
    expect(body).not.toHaveProperty('terminalId');
    expect(body.statusCode).toBe('작성중');
  });

  /*
   * ⭐ 표본 검사는 대표 구간이 있어야 불합격 시 회수 범위가 정해진다(§5-5). 비운 채 저장하면
   * 그 근거가 영영 없다.
   */
  it('적용 생산구간이 비어 있으면 검사 시각으로 채워 보낸다', async () => {
    const { writes } = renderScreen();

    await screen.findByRole('button', { name: t.result.save });

    const from = screen.getByLabelText(t.coverage.from);
    await userEvent.clear(from);
    await userEvent.clear(screen.getByLabelText(t.coverage.to));
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);
    expect(body.coverageFromAt).toBe(body.inspectedAt);
    expect(body.coverageToAt).toBe(body.inspectedAt);
  });

  /*
   * ⛔ 측정치는 자체 쓰기 경로가 없다 — 결과 저장에 함께 실린다. 판정하지 않은 줄은 싣지
   * 않는다: 사람이 내리지 않은 판정을 만들지 않는다.
   */
  it('판정한 항목만 측정치로 함께 싣는다', async () => {
    const { writes } = renderScreen();

    await screen.findByText(t.measurements.heading);

    /* DS 선택칸은 네이티브 select 가 아니라 조합 상자다 — 열고 고른다. */
    const judgments = screen.getAllByRole('combobox', { name: t.measurements.columns.judgment });
    await userEvent.click(judgments[0] as HTMLElement);
    await userEvent.click(screen.getByRole('option', { name: '합격' }));
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);
    const sent = body.measurements as Array<Record<string, unknown>>;

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ judgmentCode: 'ACCEPTED', sampleNo: 1 });
  });

  it('아무 항목도 판정하지 않았으면 측정치 키 자체를 싣지 않는다', async () => {
    const { writes } = renderScreen();

    await screen.findByRole('button', { name: t.result.save });
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).not.toHaveProperty('measurements');
  });
});

describe('PqcInspectionScreen — 끊겨도 저장된다 (공유계약 C-1)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  /*
   * ⭐ **담는 순간이 곧 성공이다**(C-1 #2). 현장 검사가 통신에 묶이면 안 된다(스펙 §5-7) —
   * 끊긴 망에서 저장이 실패로 보이면 검사자는 종이에 적고 나중에 옮긴다.
   */
  it('연결이 끊겨 있어도 저장이 성공으로 보이고 미동기 건수가 선다', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    try {
      const { writes } = renderScreen();

      await screen.findByRole('button', { name: t.result.save });
      await userEvent.click(screen.getByRole('button', { name: t.result.save }));

      const header = await screen.findByRole('banner');

      /* 담겼다는 사실이 곧 성공이다 — 서버에 물어보지 않았는데도 저장이 끝났다고 말한다. */
      expect(await screen.findByText(t.result.saved)).toBeInTheDocument();
      /* ⭐ 그 대신 **닿지 않았다는 사실**을 머리가 말한다(C-1 #4). 이것이 위 표시의 전제다. */
      expect(within(header).getByText(messages.common.connection.unsent(1))).toBeInTheDocument();
      expect(within(header).getByText(messages.common.connection.offline)).toBeInTheDocument();
      /* ⛔ 요청은 나가지 않았다 — 나갔다면 「끊겨 있다」가 거짓이다. */
      expect(writes).toHaveLength(0);
    } finally {
      online.mockRestore();
    }
  });

  /*
   * ⛔ **멱등 키가 새로고침을 넘어야 한다**(C-1 #5). 키를 메모리에만 들면 되살아난 화면이
   * 새 키로 보내고, **같은 검사가 두 건의 결과로 기록된다** — 확정은 되돌릴 수 없는 쓰기라
   * 그 사고가 특히 비싸다.
   */
  it('끊긴 동안 담긴 건이 새로고침을 넘어 같은 멱등 키로 나간다', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let stored: string | null = null;

    try {
      renderScreen();

      await screen.findByRole('button', { name: t.result.save });
      await userEvent.click(screen.getByRole('button', { name: t.result.save }));

      await waitFor(() => {
        stored = globalThis.localStorage.getItem('omf-mes.pqc-inspection.outbox');
        expect(stored).not.toBeNull();
      });
    } finally {
      online.mockRestore();
    }

    const key = (JSON.parse(stored as unknown as string) as { idempotencyKey: string }[])[0]
      ?.idempotencyKey;

    expect(key).toBeTruthy();

    /* 화면을 새로 세운다 — 되살아난 단말이다. 이번엔 연결돼 있다. */
    cleanup();
    const { writes } = renderScreen();

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((writes[0] as Request).headers.get('Idempotency-Key')).toBe(key);
  });
});

describe('PqcInspectionScreen — 액션바', () => {
  /*
   * ⛔ 잠긴 단추만 두지 않는다(G-3). 막혔으면 «무엇이» 막혔는지 함께 세운다.
   */
  it('확정이 막히면 사유를 함께 세운다', async () => {
    renderScreen();

    /*
     * 수량이 비어 합계가 서지 않는다 — 남은 것을 정확히 가리켜야 한다(뭉치면 무엇을
     * 고칠지 알 수 없다).
     */
    expect(await screen.findByText(t.result.confirmBlockedByTotals)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.result.confirm })).toBeDisabled();
  });

  /* ⛔ 되돌릴 수 없는 쓰기다 — 누르기 «전에» 그 사실을 알린다. */
  it('확정 경고를 누르기 전에 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(t.result.confirmNote)).toBeInTheDocument();
  });
});
