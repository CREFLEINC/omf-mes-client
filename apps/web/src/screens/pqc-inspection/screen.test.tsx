import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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

  /* §4-A 의 필드 표를 그대로 그린다 — 「늘 같은 값」이라는 이유로 칸을 빼지 않는다. */
  it('유형·대상·실적을 헤더에 그린다', async () => {
    renderScreen();

    expect(await screen.findByText(t.detail.fields.inspectionTypeCode)).toBeInTheDocument();
    expect(screen.getByText(t.detail.fields.target)).toBeInTheDocument();
    expect(screen.getByText(t.detail.fields.productionResultId)).toBeInTheDocument();
  });

  /* ⚠ 샘플 수의 단위가 미확정이다 — 어느 한쪽으로 읽어 계산하지 않고 그 사실을 밝힌다. */
  it('샘플 단위가 미확정이라는 사실을 밝힌다', async () => {
    renderScreen();

    expect(await screen.findByText(t.detail.sampleUnitPending)).toBeInTheDocument();
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

describe('PqcInspectionScreen — 저장된 측정치가 칸에 붙는다', () => {
  /*
   * ⛔ **항목 규격과 측정치는 서로 다른 조회다** — 규격이 먼저 오고 측정치가 나중에 온다.
   * 그 사이 줄의 열쇠는 그대로라, 되돌림이 열쇠만 보면 깨어나지 않아 **저장된 값이 화면
   * 칸에 영영 안 붙는다.** 실제로 그 상태로 화면에 나갔고, 칸은 비었는데 「규격 밖」 표만
   * 붙어 있는 모습으로 드러났다.
   */
  it('나중에 도착한 측정치가 입력 칸에 채워진다', async () => {
    let measurementsReady = false;

    const fetch = createStubFetch([
      {
        match: (request) => request.method !== 'GET',
        respond: () => jsonResponse(draftRound, { status: 201 }),
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith('/measurements'),
        respond: () => {
          /*
           * 첫 조회는 비어 있고 저장 뒤 재조회에서 값이 온다 — 항목 규격과 측정치가 서로
           * 다른 조회라 실제로 이 차가 난다.
           */
          const items = measurementsReady ? [expiredMeasurement] : [];
          measurementsReady = true;
          return jsonResponse(measurementsResponse(items));
        },
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
        match: (request) =>
          new URL(request.url).pathname.startsWith('/quality/inspection-requests/'),
        respond: () => jsonResponse(waitingRequest),
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: () => jsonResponse(codeValuesResponse(overallJudgmentCodeValues)),
      },
    ]);

    renderWithProviders(<PqcInspectionScreen />, { route: '/?ir=1001', fetch });

    await screen.findByText(t.measurements.heading);

    /* 저장이 회차를 무효화해 측정치를 다시 부른다 — 그때 값이 도착한다. */
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    /*
     * 줄에 붙었으면 **입력 칸에도** 붙어야 한다 — 이 둘이 갈리던 것이 이번 결함이다.
     * 되돌림은 렌더 «뒤» 효과라 한 렌더 늦게 반영된다.
     */
    await waitFor(() => {
      const values = screen.getAllByLabelText(t.measurements.columns.value) as HTMLInputElement[];
      /* 줄 차례는 채번(sequenceNo)이 정하므로 «값»으로 찾는다 — 자리로 찾으면 차례가 바뀔 때 헛통과한다. */
      expect(values.map((input) => input.value)).toContain(String(expiredMeasurement.numericValue));
    });
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
        'overallJudgmentCode',
        'rejectedQty',
      ].sort(),
    );
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

describe('PqcInspectionScreen — 액션바', () => {
  /*
   * ⛔ 잠긴 단추만 두지 않는다(G-3). 막혔으면 «무엇이» 막혔는지 함께 세운다.
   */
  it('확정이 막히면 사유를 함께 세운다', async () => {
    renderScreen();

    /*
     * 회차의 수량·판정은 이미 채워져 있고 검사 항목이 아직 판정되지 않았다 —
     * 남은 것을 정확히 가리켜야 한다(뭉치면 무엇을 고칠지 알 수 없다).
     */
    expect(await screen.findByText(t.result.confirmBlockedByItems)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.result.confirm })).toBeDisabled();
  });

  /* ⛔ 되돌릴 수 없는 쓰기다 — 누르기 «전에» 그 사실을 알린다. */
  it('확정 경고를 누르기 전에 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(t.result.confirmNote)).toBeInTheDocument();
  });
});
