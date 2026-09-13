import { messages } from '@omf-mes/i18n';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import {
  codeValuesResponse,
  completedRequest,
  draftRound,
  itemSpecsResponse,
  measurementsResponse,
  expiredMeasurement,
  overallJudgmentCodeValues,
  roundsResponse,
  waitingRequest,
} from './fixtures';
import type { CodeValueResponse } from './code-options';
import type { InspectionRequestResponse } from './types';
import { STORAGE_KEY } from './outbox';
import { PqcInspectionScreen } from './screen';

const t = messages.pqcInspection;

const GO_NEXT = '다음 대상으로';
const GO_BACK = '앞 대상으로';

/**
 * 대상만 바꾸는 이동 단추. **화면을 다시 세우지 않고** 주소만 옮기기 위해 화면 곁에 세운다 —
 * 다시 세우면 상태가 통째로 초기화되어, 「되돌림이 앞 건의 거부를 거두는가」를 묻지 못한다.
 */
const GoToNextTarget = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        navigate('/?ir=1002');
      }}
    >
      {GO_NEXT}
    </button>
  );
};

/**
 * 앞 대상으로 **되돌아가는** 단추. 한 번 읽은 대상이라 조회가 «즉시» 답하고, 그때는
 * 「불러오는 중」 틈이 생기지 않는다 — 그 틈이 초안을 대신 지워 주던 자리다.
 */
const GoBackToFirstTarget = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        navigate('/?ir=1001');
      }}
    >
      {GO_BACK}
    </button>
  );
};

/**
 * 요청이 실제로 무엇을 실어 갔는지 본다 — **화면이 무엇을 저장하는가**가 이 화면의 판정
 * 자료이므로, 그려진 글자보다 나간 본문이 더 중요한 자리가 많다.
 */
const renderScreen = (
  route = '/?ir=1001',
  rounds = [draftRound],
  specs = itemSpecsResponse(),
  /**
   * 쓰기에 무엇으로 답할지. 기본은 201 — 거부 갈래를 볼 때만 바꾼다.
   *
   * 약속을 돌려주면 **답을 미룰 수 있다** — 큐가 밀린 상태(앞 건이 아직 답을 못 받았는데 뒤에
   * 새 건이 담긴다)를 만드는 유일한 길이다.
   */
  respondWrite: () => Response | Promise<Response> = () =>
    jsonResponse(draftRound, { status: 201 }),
  /** 화면 곁에 함께 세울 것. 대상 이동처럼 화면 밖에서 오는 일을 흉내 낼 때만 쓴다. */
  beside: ReactNode = null,
  /**
   * 의뢰 상세로 무엇을 답할지. 확정된 의뢰로 들어오는 갈래를 볼 때만 바꾼다.
   *
   * 함수로 주면 **읽을 때마다 새로 답한다** — 재조회가 앞과 «다른» 값을 내는 갈래를 잰다.
   */
  detail: InspectionRequestResponse | (() => InspectionRequestResponse) = waitingRequest,
) => {
  const writes: Request[] = [];
  /** 의뢰 상세를 몇 번 읽었는가. 저장 뒤 다시 읽는지가 #601 1-7 의 판정 자료다. */
  const detailReads: Request[] = [];

  const fetch = createStubFetch([
    {
      /* 쓰기는 전부 여기서 잡는다 — 무엇이 나갔는지가 이 화면의 판정 자료다. */
      match: (request) => request.method !== 'GET',
      respond: (request) => {
        writes.push(request.clone() as Request);
        return respondWrite();
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
      respond: (request) => {
        detailReads.push(request.clone() as Request);
        return jsonResponse(typeof detail === 'function' ? detail() : detail);
      },
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: () => jsonResponse(codeValuesResponse(overallJudgmentCodeValues)),
    },
    /* 좌단 머리의 「기준 … v…」·「샘플 …%」가 이 둘에서 나온다(§3). */
    {
      match: (request) =>
        /^\/quality\/inspection-plan-versions\/\d+$/.test(new URL(request.url).pathname),
      respond: () =>
        jsonResponse({
          inspectionPlanVersion: { inspectionPlanId: 1001, planVersion: 2, samplingRatio: 30 },
        }),
    },
    {
      match: (request) => /^\/quality\/inspection-plans\/\d+$/.test(new URL(request.url).pathname),
      respond: () => jsonResponse({ inspectionPlan: { inspectionPlanCode: 'IP-ABC-123' } }),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/uoms',
      respond: () => jsonResponse({ items: [{ uomId: 1001, uomCode: 'EA' }] }),
    },
  ]);

  renderWithProviders(
    <>
      <PqcInspectionScreen />
      {beside}
    </>,
    { route, fetch },
  );

  return { writes, detailReads };
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
   * §3 도면이 이 값을 **좌측 구획 머리**에 「기준 IP-ABC-123 v2」 형태로 둔다.
   *
   * ⛔ 내부 id 로 내지 않는다 — 현장에서 그 숫자는 아무것도 가리키지 않는다.
   */
  it('검사기준을 코드와 버전으로 좌측 구획 머리에 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(t.detail.planLabel('IP-ABC-123', 2))).toBeInTheDocument();
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
    /* 왼쪽 맥락은 한 문장으로 읽히는 자리다 — 조각을 나란히 두면 값끼리 붙어 읽힌다. */
    expect(target.textContent).toBe(
      [
        /* 이 픽스처의 의뢰에는 작업지시가 없다 — 지어내지 않고 빈 값 표식을 세운다. */
        `${t.detail.fields.workOrderId} ${t.emptyValue}`,
        `${t.detail.fields.itemId} ${String(waitingRequest.itemId)}`,
        `${t.detail.fields.lotId} ${String(waitingRequest.lotId)}`,
      ].join(' · '),
    );
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

  /*
   * ⭐ **샘플은 «비율(%)»이다.** 「30 이 개인가 %인가」를 묻던 미결(§8 #5)이 2026-09-02 에
   * 닫혔다 — 계약이 「샘플 비율(%)이 정본」으로 못박았다. 화면은 그 답을 단위와 함께 낸다(A-8).
   */
  it('샘플을 비율로 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(t.detail.sample(30))).toBeInTheDocument();
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

describe('PqcInspectionScreen — 숫자 키패드', () => {
  /*
   * ⚠ **키패드에 소수점 키가 없다**(설계 §3 도면 · 사용자 지시 2026-09-10) — 패드는 숫자만
   *   넣는다. 손으로 치는 길은 그대로라 소수는 자판으로 들어온다.
   */
  it('직접 입력과 화면 키패드가 같은 수량 초안을 고친다', async () => {
    renderScreen();

    const rejected = await screen.findByLabelText(t.result.fields.rejected);
    await userEvent.clear(rejected);
    await userEvent.type(rejected, '0.5');
    expect(rejected).toHaveValue('0.5');

    await userEvent.clear(rejected);
    await userEvent.click(rejected);

    const keypad = screen.getByRole('group', { name: t.pad.keypadLabel });
    expect(within(keypad).queryByRole('button', { name: t.pad.decimal })).not.toBeInTheDocument();

    await userEvent.click(within(keypad).getByRole('button', { name: '1' }));
    await userEvent.click(within(keypad).getByRole('button', { name: '5' }));

    expect(rejected).toHaveValue('15');
  });
});

describe('PqcInspectionScreen — 서버가 받은 뒤', () => {
  /*
   * ⛔ **확정 뒤 화면 상태를 손으로 칠하지 않고 다시 읽는다**(#601 1-7). PQC 표본 검사에서
   * 불합격 수가 공정별 합격판정개수를 넘으면 서버가 같은 작업지시의 생산LOT 전체를
   * 「검사 대기」로 일괄 전이한다 — 방금 보낸 한 건 말고도 상태가 바뀌어 있다.
   *
   * ⚠ 경로도 필드도 타입도 그대로라 컴파일러가 잡지 못하는 자리다. 이 시험이 그 자리를 잡는다.
   */
  it('서버가 저장을 받으면 의뢰 상세를 다시 읽는다', async () => {
    const { writes, detailReads } = renderScreen();

    await screen.findByLabelText(t.result.fields.rejected);
    const before = detailReads.length;

    await userEvent.type(screen.getByLabelText(t.result.fields.rejected), '2');
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(detailReads.length).toBeGreaterThan(before));
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
    expect(body.statusCode).toBe('DRAFT');
  });

  /*
   * ⭐ 표본 검사는 대표 구간이 있어야 불합격 시 회수 범위가 정해진다(§5-5). 비운 채 저장하면
   * 그 근거가 영영 없다.
   */
  it('적용 생산구간이 비어 있으면 검사 시각으로 채워 보낸다', async () => {
    const { writes } = renderScreen();

    await screen.findByRole('button', { name: t.result.save });

    /* 구간은 날짜·시각 두 칸이다 — 날짜를 비우면 그 한쪽이 통째로 빈 값이 된다. */
    await userEvent.clear(screen.getByLabelText(`${t.coverage.from} ${t.coverage.date}`));
    await userEvent.clear(screen.getByLabelText(`${t.coverage.to} ${t.coverage.date}`));
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

    /* 항목 판정은 버튼 둘이다(설계 §7) — 첫 항목의 [합격]을 누른다. */
    const groups = screen.getAllByRole('group', { name: t.measurements.columns.judgment });
    await userEvent.click(within(groups[0] as HTMLElement).getByRole('button', { name: '합격' }));
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
    let stored = '';

    try {
      renderScreen();

      await screen.findByRole('button', { name: t.result.save });
      await userEvent.click(screen.getByRole('button', { name: t.result.save }));

      await waitFor(() => {
        stored = globalThis.localStorage.getItem(STORAGE_KEY) ?? '';
        expect(stored).not.toBe('');
      });
    } finally {
      online.mockRestore();
    }

    const key = (JSON.parse(stored) as { idempotencyKey: string }[])[0]?.idempotencyKey;

    expect(key).toBeTruthy();

    /* 화면을 새로 세운다 — 되살아난 단말이다. 이번엔 연결돼 있다. */
    cleanup();
    const { writes } = renderScreen();

    await waitFor(() => expect(writes).toHaveLength(1));
    expect((writes[0] as Request).headers.get('Idempotency-Key')).toBe(key);
  });
});

describe('PqcInspectionScreen — 서버가 거부하면 (공유계약 C-7)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  /*
   * ⛔ **담는 순간 성공을 말한 뒤 거부되면 그 말을 거둬야 한다.** 거두지 않으면 거부된 건이
   * 큐에서 내려가 미동기 건수마저 0 으로 돌아오고, **기록이 유실됐는데 화면의 표시가 전부
   * 성공을 말한다.** 검사자는 그대로 다음 LOT 으로 넘어간다.
   *
   * ⚠ 화면이 아는 칸(수량 셋) 밖의 거부로 시험한다 — 인라인으로 소화되지 않는 것이야말로
   * 배너가 없으면 **아무 흔적도 남지 않는** 갈래다.
   */
  it('거부되면 성공 표시를 거두고 사유를 배너로 올린다', async () => {
    const { detailReads } = renderScreen(undefined, undefined, undefined, () =>
      jsonResponse({ errors: [{ scope: 'screen', code: 'FORBIDDEN' }] }, { status: 403 }),
    );

    await screen.findByRole('button', { name: t.result.save });
    const readsBefore = detailReads.length;
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    /*
     * 거부가 돌아오면 사유가 선다. ⚠ **담긴 직후의 성공 표시는 여기서 겨누지 않는다** —
     * 거부가 곧바로 돌아오면 그 표시는 눈 깜짝할 사이라 시험이 붙잡지 못한다. 그 갈래는
     * 「끊겨도 저장된다」가 덮는다.
     */
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    /* ⛔ 그리고 성공 표시가 남아 있으면 안 된다 — 남으면 유실을 성공으로 읽는다. */
    expect(screen.queryByText(t.result.saved)).not.toBeInTheDocument();
    /* 큐에서 내려갔으므로 머리는 「동기됨」이다 — 그래서 배너가 유일한 흔적이다. */
    expect(
      within(await screen.findByRole('banner')).getByText(t.header.synced),
    ).toBeInTheDocument();

    /*
     * ⛔ **거부는 다시 읽을 계기가 아니다**(#601 1-7). 재조회는 서버가 저장을 «받았을 때»의
     * 부수 효과를 따라잡으려는 것인데, 거부는 서버가 아무것도 바꾸지 않았다는 뜻이다.
     * 여기서도 다시 읽으면 4xx 가 돌아올 때마다 조회가 한 번씩 더 나가고, 그것을 「서버가
     * 무언가 바꿨다」는 신호로 읽을 근거가 사라진다.
     */
    expect(detailReads.length).toBe(readsBefore);
  });

  /*
   * ⛔ **배너가 세로 예산 밖으로 나가지 않는다.** §3 E-1 의 예산은 머리 64 + 본문 616 +
   * 액션바 88 = 768 이고 **슬랙이 0** 이다. 머리와 본문 «사이»에 세우면 그만큼 전체가 밀려
   * 1024×768 단말에서 **「검사 확정」이 접힌 아래로 내려간다** — 하필 저장이 실패해 다시
   * 눌러야 하는 순간이다.
   *
   * 결과 구획은 이미 흐르므로(`.pop-inspect > .pane`) 그 «안»에 서면 높이가 늘어도 액션바가
   * 제자리에 남는다. 배치는 jsdom 이 재지 못하므로 **어디에 붙어 있는지**로 지킨다.
   */
  it('거부 배너가 결과 구획 안에 선다 — 액션바를 밀어내지 않는다', async () => {
    renderScreen(undefined, undefined, undefined, () =>
      jsonResponse({ errors: [{ scope: 'screen', code: 'FORBIDDEN' }] }, { status: 403 }),
    );

    await screen.findByRole('button', { name: t.result.save });
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    const alert = await screen.findByRole('alert');

    expect(alert.closest('.pane')).toBe(screen.getByLabelText(t.result.heading));
  });

  /*
   * ⛔ **대상이 바뀌면 앞 건의 거부가 따라오지 않는다.** 이 화면은 라우트가 같아 대상만
   * 바뀔 때 다시 세워지지 않는다 — 지우지 않으면 **실패한 적 없는 대상 위에 「저장 실패」가
   * 서 있고**, 검사자는 그것을 이 대상의 결과로 읽는다.
   */
  it('다른 의뢰로 옮기면 앞 건의 거부가 따라오지 않는다', async () => {
    renderScreen(
      undefined,
      undefined,
      undefined,
      () => jsonResponse({ errors: [{ scope: 'screen', code: 'FORBIDDEN' }] }, { status: 403 }),
      <GoToNextTarget />,
    );

    await screen.findByRole('button', { name: t.result.save });
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    /* 주소의 대상만 바꾼다 — 화면을 다시 세우지 않는 것이 이 시험의 요점이다. */
    await userEvent.click(screen.getByRole('button', { name: GO_NEXT }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  /*
   * ⛔ **앞 대상에 친 측정값·판정도 따라오지 않는다.** 초안 effect 는 «줄 목록»이 달라질 때만
   * 도는데 줄 목록은 검사기준 버전이 정한다 — 같은 기준을 쓰는 다른 LOT 으로 옮기면 열쇠가
   * 그대로라 돌지 않았다. 남으면 저장이 붙는 순간 **다른 LOT 에 앞 대상의 측정치가 저장된다.**
   */
  it('이미 읽은 대상으로 돌아가도 앞 대상의 측정값·판정이 따라오지 않는다', async () => {
    renderScreen(
      undefined,
      undefined,
      undefined,
      undefined,
      <>
        <GoToNextTarget />
        <GoBackToFirstTarget />
      </>,
    );

    await screen.findByText(t.measurements.heading);

    /*
     * 한 번 다녀와야 앞 대상이 **조회 보관소에 남는다** — 돌아올 때 조회가 즉시 답하고,
     * 그때는 「불러오는 중」 틈이 없어 줄 목록이 한 번도 비지 않는다. 그 틈이 초안을 대신
     * 지워 주던 자리라, 여기서만 되돌림이 실제로 시험된다.
     */
    await userEvent.click(screen.getByRole('button', { name: GO_NEXT }));
    await screen.findByText(t.measurements.heading);

    const value = screen.getAllByLabelText(t.measurements.columns.value)[0] as HTMLInputElement;
    await userEvent.type(value, '9');

    const groups = screen.getAllByRole('group', { name: t.measurements.columns.judgment });
    await userEvent.click(within(groups[0] as HTMLElement).getByRole('button', { name: '합격' }));

    expect(value.value).toBe('9');
    expect(within(groups[0] as HTMLElement).getByRole('button', { name: '합격' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: GO_BACK }));

    await waitFor(() => {
      const moved = screen.getAllByLabelText(t.measurements.columns.value)[0] as HTMLInputElement;

      expect(moved.value).toBe('');
    });

    const movedGroups = screen.getAllByRole('group', { name: t.measurements.columns.judgment });
    expect(
      within(movedGroups[0] as HTMLElement).getByRole('button', { name: '합격' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});

/*
 * ⛔ **재조회가 검사자의 입력을 지우지 않는다**(#1091 리뷰). 되돌림 효과의 의존성에는 서버가
 * 내려주는 값(대상 수량·적용 구간)이 함께 들어 있어, **대상이 그대로여도** 재조회가 그 값을
 * 다르게 내면 효과가 다시 돈다 — 임시 저장 뒤 상세를 다시 읽으므로(#601 1-7) 실제로 일어난다.
 * 그때 항목 초안까지 지우면 검사자가 친 측정값이 말없이 사라진다.
 */
describe('PqcInspectionScreen — 재조회는 친 것을 지우지 않는다', () => {
  it('같은 대상에서 상세가 다시 와도 측정값·판정이 남는다', async () => {
    let reads = 0;
    const { writes } = renderScreen(
      '/?ir=1001',
      [draftRound],
      itemSpecsResponse(),
      undefined,
      null,
      () => {
        reads += 1;

        /* 두 번째 읽기부터 서버가 적용 구간을 채워 내린다 — 효과가 다시 도는 방아쇠다. */
        return reads === 1
          ? waitingRequest
          : { ...waitingRequest, coverageFromAt: '2026-09-12T01:00:00+09:00' };
      },
    );

    await screen.findByText(t.measurements.heading);

    const value = screen.getAllByLabelText(t.measurements.columns.value)[0] as HTMLInputElement;
    await userEvent.type(value, '9');

    /* 임시 저장이 상세 재조회를 부른다(#601 1-7) — 여기서 초안이 날아가던 자리다. */
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(reads).toBeGreaterThan(1));

    const after = screen.getAllByLabelText(t.measurements.columns.value)[0] as HTMLInputElement;
    expect(after.value).toBe('9');
  });
});

describe('PqcInspectionScreen — 액션바', () => {
  /*
   * ⭐ **터치 등급은 치수가 아니라 「틀렸을 때 무엇이 일어나는가」로 갈린다**(`pop-touch`).
   *
   * ⛔ **검사 확정은 되돌릴 수 없는 쓰기다**(B-10 — 정정이 아니라 재검 회차로만 고친다).
   * 스펙 §3 도면이 이 자리에 72 를 적었고, DS 의 `xl` 은 60px 이라 부족분을 제품이 채운다
   * (착수 이슈 #86 6항). 등급이 내려가면 **장갑 낀 손이 되돌릴 수 없는 단추를 12px 작게
   * 누른다** — 치수는 CSS 한 곳에 있으므로 여기서는 «등급»을 지킨다.
   */
  it('임시 저장은 주 조작 등급, 검사 확정은 되돌릴 수 없는 등급이다', async () => {
    renderScreen();

    const save = await screen.findByRole('button', { name: t.result.save });
    const confirm = screen.getByRole('button', { name: t.result.confirm });

    expect(save).toHaveClass(...popTouchClass('primary').split(' '));
    expect(confirm).toHaveClass(...popTouchClass('destructive').split(' '));
  });

  /*
   * ⛔ 잠긴 단추만 두지 않는다(G-3). 막혔으면 «무엇이» 막혔는지 함께 세운다.
   *
   * ⚠ **합계만은 예외다**(사용자 지시 2026-09-10) — 그 사실은 《결과 입력》이 이미 말하고
   *   있어 액션바에서 되풀이하지 않는다. 잠금은 그대로 걸린다.
   */
  it('확정이 막히면 잠기고, 합계 사유는 결과 입력이 말한다', async () => {
    renderScreen();

    expect(await screen.findByRole('button', { name: t.result.confirm })).toBeDisabled();
    expect(screen.queryByText(t.result.confirmBlockedByTotals)).not.toBeInTheDocument();
  });
});

/*
 * ⛔ **확정된 회차는 이 화면에서 고치지 않는다**(§6 · B-10 — 정정이 아니라 재검사 회차다).
 * 88단계 2회차에서 「검사를 확정했습니다」를 받은 뒤에도 같은 버튼으로 확정이 또 나갔고 둘
 * 다 성공했다. 새로 열어도 서버가 `COMPLETED` 를 주는데 화면이 빈 입력 상태로 다시 열렸다
 * — 잠그는 자리가 아예 없었다(#1091).
 */
describe('PqcInspectionScreen — 확정된 회차는 잠긴다', () => {
  it('확정된 의뢰로 들어오면 두 단추가 함께 잠기고 사유를 말한다', async () => {
    renderScreen('/?ir=1001', [draftRound], itemSpecsResponse(), undefined, null, completedRequest);

    expect(await screen.findByRole('button', { name: t.result.confirm })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled();

    /*
     * ⛔ **하지 않은 일을 방금 한 것처럼 말하지 않는다** — 어제 확정된 회차에 들어와도
     *    「확정했습니다」가 서면 검사자는 자기가 방금 확정한 줄 안다.
     */
    expect(screen.queryByText(t.result.confirmSucceeded)).not.toBeInTheDocument();
    /* ⛔ 한 사실이 두 문장으로 갈라 서지 않는다 — 사유는 «띠 하나»에만 있다. */
    expect(screen.getAllByText(t.result.confirmed)).toHaveLength(1);
  });

  /* ⚠ 서버에 닿기 전에도 잠긴다 — 담는 순간이 성공이라(C-1 #2) 그 사이가 열려 있었다. */
  it('방금 확정했으면 서버 상태를 다시 읽기 전에도 잠긴다', async () => {
    /* 항목이 없는 기준으로 연다 — 확정 조건 넷 중 「전 항목 판정」이 저절로 선다. */
    const { writes } = renderScreen('/?ir=1001', [draftRound], itemSpecsResponse([]));

    /* 합계를 맞추고(검사 수량은 대상 수량 500 으로 시작한다) 종합 판정을 고른다. */
    await userEvent.type(await screen.findByLabelText(t.result.fields.accepted), '500');
    await userEvent.click(screen.getByRole('combobox', { name: t.result.judgment }));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));

    const confirm = screen.getByRole('button', { name: t.result.confirm });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);

    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await screen.findByText(t.result.confirmSucceeded)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.result.confirm })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled();

    /*
     * ⭐ **한 띠가 둘을 함께 말한다**(사용자 지시 2026-09-12) — 확정됐다는 결과와, 그래서
     *    무엇을 할 수 없는지. 아래에 회색 줄로 또 세우면 같은 사실이 무게가 다른 문장
     *    둘로 갈라진다.
     */
    const banner = screen.getByText(t.result.confirmSucceeded).closest('[role]');
    expect(banner).not.toBeNull();
    expect(within(banner as HTMLElement).getByText(t.result.confirmed)).toBeInTheDocument();
    expect(screen.getAllByText(t.result.confirmed)).toHaveLength(1);
  });

  /*
   * ⛔ **화면을 다시 세워도 잠금이 남는다**(#1091 리뷰). 확정은 저장소에 남아 새로고침과 화면
   * 이동을 넘기는데, 「방금 확정했다」는 화면 상태 하나로 잠그면 다시 세우는 순간 잠금만
   * 사라진다 — 끊긴 망에서 나갔다 돌아온 검사자가 빈 화면을 다시 채워 같은 검사를 두 건으로
   * 만든다. 서버 상태도 기댈 수 없다: 아직 닿지 않았으므로 의뢰는 여전히 `REQUESTED` 다.
   */
  /*
   * ⛔ **잠금은 단추에서 끝나지 않는다**(#1146 ③). 88단계 3회차에서 「이 회차는 확정되어
   * 고칠 수 없습니다」가 뜬 옆에서 측정치가 99 로 바뀌고 항목 판정이 뒤집혔으며 진행 수가
   * 0/3 → 2/3 으로 움직였다. 저장이 막혀 서버는 안전했지만, 검사자는 **빈 화면을 다시 채우고
   * 저장됐다고 믿는다** — 아무것도 남지 않는다.
   */
  it('확정된 회차는 측정치·항목 판정·수량 칸도 함께 잠근다', async () => {
    renderScreen('/?ir=1001', [draftRound], itemSpecsResponse(), undefined, null, completedRequest);

    /* 좌단 — 측정값과 항목 판정 */
    const values = await screen.findAllByLabelText(t.measurements.columns.value);
    for (const value of values) expect(value).toBeDisabled();
    for (const judgment of screen.getAllByRole('button', { name: '합격' })) {
      expect(judgment).toBeDisabled();
    }

    /* 우단 — 수량과 종합 판정 */
    expect(screen.getByLabelText(t.result.fields.inspectedQty)).toBeDisabled();
    expect(screen.getByLabelText(t.result.fields.accepted)).toBeDisabled();
    expect(screen.getByLabelText(t.result.fields.rejected)).toBeDisabled();
    expect(screen.getByLabelText(t.result.fields.held)).toBeDisabled();
    expect(screen.getByRole('combobox', { name: t.result.judgment })).toBeDisabled();
  });

  /*
   * ⭐ **억제는 확정된 회차에만 걸린다**(#1146 리뷰 지적). 앞 시험은 「확정되면 사라진다」만
   * 재므로, 억제 조건을 넓혀 «모든» 회차의 잔여를 지워도 아무도 울지 않았다 — 잔여 경고는
   * 합계를 맞추게 하는 유일한 안내라, 조용히 사라지면 검사자가 어긋난 수량을 못 찾는다.
   */
  it('확정되지 않은 회차에는 잔여 수량 경고가 그대로 선다', async () => {
    renderScreen('/?ir=1001', [draftRound], itemSpecsResponse([]));

    /* 대상 수량 500 으로 시작하고 합격이 비어 있으니 500 이 남는다. */
    expect(await screen.findByText(/남았습니다/)).toBeInTheDocument();

    /* 합계를 맞추면 「일치합니다」로 바뀐다 — 둘 다 억제되면 안 된다. */
    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '500');
    expect(await screen.findByText(t.result.matched)).toBeInTheDocument();
  });

  /*
   * ⛔ **끝난 검사를 「아직 안 끝났다」로 말하지 않는다**(#1146 ①). 이 화면은 확정한 값을
   * 되읽지 않아 다시 열면 칸이 비고, 그 빈 칸으로 잰 잔여가 「120 EA 남았습니다」로 섰다 —
   * 확정을 마친 회차에서 검사자가 자기 일이 남은 줄 안다.
   */
  it('확정된 회차에는 잔여 수량 경고를 세우지 않는다', async () => {
    renderScreen('/?ir=1001', [draftRound], itemSpecsResponse(), undefined, null, completedRequest);

    /* 띠는 서야 한다 — 잠금 자체를 지운 것이 아니다. */
    expect(await screen.findByText(t.result.confirmed)).toBeInTheDocument();

    /* 어느 수량이 오든 「… 남았습니다」· 「… 많습니다」· 「일치합니다」가 서지 않아야 한다. */
    expect(screen.queryByText(/남았습니다|많습니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.matched)).not.toBeInTheDocument();
  });

  /*
   * ⛔ **화면 «안»에서 나갔다 돌아와도 잠긴다**(#1146 ②). 88단계 3회차에서 같은 회차가
   * 주소 새로고침으로 들어가면 잠기고 [화면 이동]으로 들어가면 안 잠겼다. **실기에는
   * 주소창이 없어** 작업자가 겪는 쪽이 뒤의 것이고, 그쪽만 열려 있었다.
   *
   * 이 갈래는 앞의 둘이 모두 «꺼진» 뒤다 — 큐는 비었고(보냈다) 「방금 확정했다」는 화면
   * 상태라 이동으로 사라진다. 기댈 것이 서버 상태 하나뿐인 자리다.
   */
  it('확정한 뒤 화면 안에서 나갔다 돌아와도 잠긴다', async () => {
    /*
     * 서버는 **쓰기 전후로 다르게 답한다** — 확정이 닿기 전에는 대기, 닿은 뒤에는 완료다.
     * 실제 서버가 하는 일을 그대로 흉내 낸다.
     */
    let confirmed = false;

    const { writes } = renderScreen(
      '/?ir=1001',
      [draftRound],
      itemSpecsResponse([]),
      () => {
        confirmed = true;

        return jsonResponse(draftRound, { status: 201 });
      },
      <>
        <GoToNextTarget />
        <GoBackToFirstTarget />
      </>,
      () => (confirmed ? completedRequest : waitingRequest),
    );

    await userEvent.type(await screen.findByLabelText(t.result.fields.accepted), '500');
    await userEvent.click(screen.getByRole('combobox', { name: t.result.judgment }));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));

    const confirm = screen.getByRole('button', { name: t.result.confirm });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);

    await waitFor(() => expect(writes).toHaveLength(1));

    /* 화면 «안»에서 다른 대상으로 갔다가 되돌아온다 — [화면 이동] 이 하는 일이다. */
    await userEvent.click(screen.getByRole('button', { name: GO_NEXT }));
    await userEvent.click(screen.getByRole('button', { name: GO_BACK }));

    expect(await screen.findByRole('button', { name: t.result.confirm })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled();
    expect(screen.getAllByText(t.result.confirmed)).toHaveLength(1);
  });

  it('큐에 확정이 남아 있으면 화면을 새로 세워도 잠긴다', async () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          idempotencyKey: 'k-confirm',
          body: {
            inspectionRequestId: 1001,
            inspectedQty: 120,
            acceptedQty: 120,
            rejectedQty: 0,
            heldQty: 0,
            uomId: 10,
            inspectedAt: '2026-09-12T10:00:00+09:00',
            statusCode: 'CONFIRMED',
          },
        },
      ]),
    );

    /* 서버는 답하지 않는다 — 큐가 비워지지 않아야 「아직 남아 있다」를 잰다. */
    renderScreen('/?ir=1001', [draftRound], itemSpecsResponse([]), () => {
      throw new TypeError('Failed to fetch');
    });

    expect(await screen.findByRole('button', { name: t.result.confirm })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled();
    expect(screen.getByText(t.result.confirmed)).toBeInTheDocument();

    globalThis.localStorage.clear();
  });

  /*
   * ⛔ **앞의 임시 저장이 거부됐다고 «확정»에 걸린 잠금을 풀지 않는다**(#1091 리뷰).
   * 큐는 밀릴 수 있어 임시 저장과 확정이 함께 서 있을 수 있고, 거부는 큐 전체에 하나뿐인
   * 값이라 「무엇이 거부됐는지」를 가르지 않으면 살아 있는 확정 위에 두 번째 확정이 얹힌다.
   *
   * ⚠ 확정이 큐를 빠져나간 «뒤»가 이 갈래가 실제로 갈리는 자리다 — 큐에 남아 있는 동안은
   * 큐 잠금이 대신 막아 준다.
   */
  it('임시 저장이 거부돼도 이어서 성공한 확정의 잠금은 풀리지 않는다', async () => {
    /*
     * 첫 쓰기(임시 저장)는 **답을 미뤘다가** 거부하고, 둘째 쓰기(확정)는 받는다. 미루지 않으면
     * 거부가 확정보다 «먼저» 도착해 담기는 순간 지워지므로(`enqueue` 가 거부 표시를 거둔다)
     * 이 갈래 자체가 만들어지지 않는다.
     */
    let written = 0;
    let refuseDraft = (): void => undefined;
    const draftAnswered = new Promise<void>((resolve) => {
      refuseDraft = resolve;
    });

    const { writes } = renderScreen('/?ir=1001', [draftRound], itemSpecsResponse([]), () => {
      written += 1;

      if (written === 1) {
        return draftAnswered.then(() =>
          jsonResponse({ errors: [{ scope: 'screen', code: 'FORBIDDEN' }] }, { status: 403 }),
        );
      }

      return jsonResponse(draftRound, { status: 201 });
    });

    await userEvent.type(await screen.findByLabelText(t.result.fields.accepted), '500');
    await userEvent.click(screen.getByRole('combobox', { name: t.result.judgment }));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));

    /* 임시 저장 → 확정을 잇달아 담는다. 큐는 앞부터 하나씩 나간다. */
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    const confirm = screen.getByRole('button', { name: t.result.confirm });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);

    /* 확정이 큐에 담긴 뒤에야 앞 건의 거부를 돌려준다. */
    refuseDraft();

    await waitFor(() => expect(writes).toHaveLength(2));

    /* 거부 배너가 섰다 — 이 시점에 잠금이 풀리면 두 번째 확정이 나갈 수 있다. */
    await screen.findByRole('alert');

    expect(screen.getByRole('button', { name: t.result.confirm })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled();
  });

  /*
   * ⛔ **보내지 못한 검사를 잠근 채 두지 않는다.** 담는 순간 성공을 말했으므로(C-1 #2) 잠금도
   * 그때 걸리는데, 서버가 받지 않기로 했다면 그 검사는 남지 않았다 — 잠긴 채로 두면 검사자가
   * 다시 넣을 길이 없다.
   */
  it('확정이 거부되면 두 단추가 다시 열린다', async () => {
    const { writes } = renderScreen('/?ir=1001', [draftRound], itemSpecsResponse([]), () =>
      jsonResponse({ errors: [{ scope: 'screen', code: 'FORBIDDEN' }] }, { status: 403 }),
    );

    await userEvent.type(await screen.findByLabelText(t.result.fields.accepted), '500');
    await userEvent.click(screen.getByRole('combobox', { name: t.result.judgment }));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));

    const confirm = screen.getByRole('button', { name: t.result.confirm });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);

    await waitFor(() => expect(writes).toHaveLength(1));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.result.save })).toBeEnabled();
    });
    expect(screen.getByRole('button', { name: t.result.confirm })).toBeEnabled();
  });
});
