import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionProvider, type Session } from '../../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION, signedInRoute } from '../../test/session-harness';
import { CODE_GROUPS } from './code-options';
import {
  codeValuesResponse,
  completedRequest,
  confirmedRound,
  draftRound,
  expiredMeasurement,
  itemSpecsResponse,
  measurementsResponse,
  overallJudgmentCodeValues,
  pageOf,
  queueItems,
  requestWithoutPlanVersion,
  queueResponse,
  reinspectionRound,
  roundsResponse,
  waitingRequest,
} from './fixtures';
import type { InspectionMeasurementResponse } from './measurement-rows';
import { IqcInspectionScreen } from './screen';
import type { InspectionResultResponse } from './types';

const t = messages.iqcInspection;
const closeDetail = messages.common.inspectionHub.closeDetail;

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

  const view = renderWithProviders(
    <SessionProvider>
      <IqcInspectionScreen />
    </SessionProvider>,
    {
      route,
      session: testSession,
      fetch: createStubFetch([
        /* 화면이 들어올 때 세션을 다시 읽는다(#104) — 같은 세션을 돌려준다. */
        signedInRoute(testSession),
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
            const found = [...queueItems, requestWithoutPlanVersion, completedRequest].find(
              (item) => item.inspectionRequestId === id,
            );

            return found === undefined
              ? jsonResponse({ message: '없는 의뢰' }, { status: 404 })
              : jsonResponse(found);
          },
        },
        /* LOT 상세 — 시험이 상태를 정했을 때만 답한다(불량 LOT 안내 · omf-all-around#106 후속). */
        {
          match: (request) =>
            /^\/trace\/lots\/\d+$/.test(new URL(request.url).pathname) && lotStatusForTest !== null,
          respond: () =>
            jsonResponse({
              lot: { lotId: 9001, lotNo: 'SYN-LOT-1', statusCode: lotStatusForTest },
              holds: [],
            }),
        },
        {
          match: (request) => new URL(request.url).pathname === '/quality/nonconformances',
          respond: () =>
            jsonResponse({
              items: [{ nonconformanceId: 6601 }],
              page: { page: 1, size: 1, total: 1 },
            }),
        },
        /* 불량 코드 마스터 — 불합격 사유(omf-all-around#106). 대분류 1 · 상세 1. */
        {
          match: (request) => new URL(request.url).pathname === '/quality/defect-codes',
          respond: () =>
            jsonResponse({
              items: [
                { defectCodeId: 7001, defectCode: 'APP', defectName: '외관', isActive: true },
                {
                  defectCodeId: 7002,
                  defectCode: 'APP-SCR',
                  defectName: '스크래치',
                  parentDefectCodeId: 7001,
                  isActive: true,
                },
              ],
              page: { page: 1, size: 500, total: 2 },
            }),
        },
        /* 원인 코드 마스터 — 추정 원인(omf-all-around#130). 대분류 1 · 상세 1 · 사용 중지 1. */
        {
          match: (request) => new URL(request.url).pathname === '/quality/cause-codes',
          respond: () =>
            jsonResponse({
              items: [
                { causeCodeId: 8001, causeCode: 'SUP', causeName: '공급사', isActive: true },
                {
                  causeCodeId: 8002,
                  causeCode: 'SUP-PRC',
                  causeName: '공급사 공정',
                  parentCauseCodeId: 8001,
                  isActive: true,
                },
                { causeCodeId: 8009, causeCode: 'OLD', causeName: '옛 원인', isActive: false },
              ],
              page: { page: 1, size: 500, total: 3 },
            }),
        },
        /* 작성중 회차에 임시 저장된 사유(#122 · P-48) — 시험이 `draftRecordsForTest` 로 채운다. */
        {
          match: (request) =>
            new URL(request.url).pathname === '/quality/defect-records' && request.method === 'GET',
          respond: (request) => {
            sent.push(new URL(request.url));
            if (draftRecordsFailForTest)
              return jsonResponse({ message: '서버 오류' }, { status: 500 });
            return jsonResponse({
              items: draftRecordsForTest,
              page: { page: 1, size: 20, total: draftRecordsForTest.length },
            });
          },
        },
        /* 불량 기록 등록 — ⛔ 확정이 사유를 싣는 뒤로는 나가지 않는다(#121 · P-47). 나가면 `writes` 에 잡힌다. */
        {
          match: (request) =>
            new URL(request.url).pathname === '/quality/defect-records' &&
            request.method === 'POST',
          respond: (request) => {
            writes.push(request);
            return jsonResponse({ defectRecordId: 1 }, { status: 201 });
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
        /* 단위 목록 — 수량 옆 단위 코드(표시 전용). 요청 크기를 시험이 본다. */
        {
          match: (request) => new URL(request.url).pathname === '/mdm/uoms',
          respond: (request) => {
            sent.push(new URL(request.url));
            return jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } });
          },
        },
        /* 검사기준 버전 단건 — 샘플링 규칙. 시험이 채우지 않으면 없다(404 · 종전처럼 의뢰수량). */
        {
          match: (request) =>
            /^\/quality\/inspection-plan-versions\/\d+$/.test(new URL(request.url).pathname),
          respond: () =>
            samplingVersion === null
              ? jsonResponse({ message: '없는 버전' }, { status: 404 })
              : jsonResponse({ inspectionPlanVersion: samplingVersion }),
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
    },
  );

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
/** 검사기준 버전 단건 응답의 샘플링 칸. 샘플 검사수량을 재는 시험만 채운다. */
let samplingVersion: {
  samplingMethodCode: string;
  samplingRatio: number | null;
  acceptanceNumber?: number | null;
} | null = null;

/** 세션 — 기본은 작업자가 연결된 계정이다(검사자를 풀 수 있다 · omf-all-around#104). */
const LINKED_SESSION: Session = {
  ...SYNTHETIC_SESSION,
  worker: { workerId: 8501, workerNo: 'SYN-W-01', workerName: '합성 작업자' },
};
let testSession: Session = LINKED_SESSION;
/** LOT 상세의 품질 상태. `null` 이면 LOT 상세에 답하지 않는다(종전 시험들). */
let lotStatusForTest: string | null = null;
/** 작성중 회차의 불량 기록(#122). 기본은 없음이다. */
let draftRecordsForTest: {
  defectRecordId: number;
  defectCodeId: number;
  defectDescription?: string;
  suspectedCauseCodeId?: number;
}[] = [];
/** 작성중 사유 조회를 실패시킨다(#122 리뷰 M2). */
let draftRecordsFailForTest = false;

beforeEach(() => {
  testSession = LINKED_SESSION;
  lotStatusForTest = null;
  draftRecordsForTest = [];
  draftRecordsFailForTest = false;
  confirmResponder = null;
  samplingVersion = null;
});

const queueCalls = (sent: URL[]) =>
  sent.filter((url) => url.pathname === '/quality/inspection-requests');

const lastQuery = (sent: URL[]) => queueCalls(sent).at(-1)?.searchParams;
/**
 * 줄을 여는 단추. **의뢰번호가 든 접근 이름으로 찾는다** — 첫 칸이 품목으로 바뀌면서
 * 접근 이름이 「품목 · 검사 의뢰 … 열기」가 됐고, 품목 이름은 조회가 도착해야 정해진다.
 */
const openButton = (no: string) =>
  screen.getByRole('button', { name: (accessibleName: string) => accessibleName.includes(no) });

/** 큐가 그려질 때까지 기다리는 자리. 의뢰번호는 **열이 아니라 접근 이름에 있다.** */
const findOpenButton = (no: string) =>
  screen.findByRole('button', { name: (accessibleName: string) => accessibleName.includes(no) });

/*
 * #185 — 목록과 상세가 나란히 선다. 이 도우미는 상세를 닫고 다른 의뢰를 고른다(#133 의 「← 목록」 자리).
 * 저장 안 한 입력이 있으면 한 번 묻는데, 이 도우미는 「버리고 목록으로」를 고른다.
 */
const goToRequest = async (no: string): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: closeDetail }));
  const leave = screen.queryByRole('button', { name: t.detail.leaveAnyway });
  if (leave !== null) await userEvent.click(leave);
  await userEvent.click(await findOpenButton(no));
};

/** [임시 저장]은 마지막 저장 상태와 달라진 것이 있을 때만 켜진다 — 누르기 전에 한 칸을 바꾼다. */
const editQuantity = async (): Promise<void> => {
  await userEvent.type(screen.getByLabelText(t.result.fields.held), '1');
};

/*
 * 입력 칸 위의 검사 회차(「N회차」) — 아래 검사 항목별 결과의 측정 회차와 같은 글이라(#133) 입력 영역 안에서만 찾는다.
 */
const findRound = async (round: number): Promise<HTMLElement> =>
  within(await screen.findByRole('form', { name: t.result.heading })).findByText(
    t.result.round(round),
  );

describe('IqcInspectionScreen', () => {
  it('검사 대기 큐를 그린다', async () => {
    renderScreen();

    expect(await findOpenButton('IR-2026-0001')).toBeInTheDocument();
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

    /*
     * 의뢰번호로 좁힌다 — 품목·공급사는 이제 **골라서** 넣으므로(omf-all-around#40) 이 판정에
     * 필요 없는 선택 창·선택지 조회까지 끌고 들어온다. 재는 것은 「조건이 바뀌면 첫 쪽」이다.
     */
    await userEvent.type(screen.getByLabelText(t.filters.keyword), 'IR-1');
    await userEvent.click(screen.getByRole('button', { name: t.filters.apply }));

    await waitFor(() => expect(queueCalls(sent).length).toBeGreaterThan(1));
    expect(lastQuery(sent)?.get('page')).toBe('1');
    expect(lastQuery(sent)?.get('q')).toBe('IR-1');
  });

  it('같은 조건으로 다시 조회하면 외부에서 새로 생긴 의뢰를 받는다', async () => {
    let calls = 0;
    const { sent } = renderScreen('/', () => {
      calls += 1;
      return jsonResponse(
        calls === 1 ? queueResponse([], pageOf(0)) : queueResponse([waitingRequest], pageOf(1)),
      );
    });

    expect(await screen.findByText(t.queue.empty)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.filters.apply }));

    await waitFor(() => expect(queueCalls(sent)).toHaveLength(2));
    expect(await findOpenButton(waitingRequest.inspectionRequestNo)).toBeInTheDocument();
    expect(lastQuery(sent)?.get('inspectionTypeCode')).toBe('IQC');
    expect(lastQuery(sent)?.get('pendingOnly')).toBe('true');
  });

  it('의뢰를 고르면 목록 옆에 그 의뢰의 상세가 선다(#185)', async () => {
    renderScreen();

    await findOpenButton('IR-2026-0002');
    await userEvent.click(openButton('IR-2026-0002'));

    expect(await screen.findByRole('button', { name: closeDetail })).toBeInTheDocument();
    /* 「검사 기본 정보」는 상자 제목이 아니라 경로의 한 단계로만 선다(#133). */
    expect(screen.queryByRole('heading', { name: t.detail.sectionTitle })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: messages.common.shell.breadcrumb })).getByText(
        t.detail.sectionTitle,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: closeDetail })).toBeInTheDocument();
    /* 목록은 그대로 남는다 — 다른 줄을 바로 고를 수 있다. */
    expect(screen.getByRole('button', { name: t.pageNav.next })).toBeInTheDocument();
  });

  it('쪽을 옮겨도 조건은 그대로이고, 상세에서 목록으로 돌아와도 조건이 남는다', async () => {
    const { sent } = renderScreen('/?it=1001', () =>
      jsonResponse(queueResponse(queueItems, pageOf(120, 1, 50))),
    );

    await findOpenButton('IR-2026-0001');
    await userEvent.click(screen.getByRole('button', { name: t.pageNav.next }));

    await waitFor(() => expect(lastQuery(sent)?.get('page')).toBe('2'));
    expect(lastQuery(sent)?.get('itemId')).toBe('1001');

    await userEvent.click(await findOpenButton('IR-2026-0002'));
    await userEvent.click(await screen.findByRole('button', { name: closeDetail }));

    await findOpenButton('IR-2026-0002');
    expect(lastQuery(sent)?.get('itemId')).toBe('1001');
    expect(lastQuery(sent)?.get('page')).toBe('2');
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
    expect(await findOpenButton('IR-2026-0001')).toBeInTheDocument();
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

  it('처음에는 목록만 선다 — 상세는 의뢰를 고른 뒤에 연다(#133)', async () => {
    renderScreen();

    await findOpenButton('IR-2026-0001');
    expect(screen.queryByText(t.detail.sectionTitle)).not.toBeInTheDocument();
  });

  it('저장 안 한 입력이 있으면 목록으로 가기 전에 한 번 묻는다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '1');
    await userEvent.click(screen.getByRole('button', { name: closeDetail }));

    expect(screen.getByText(t.detail.leaveUnsaved)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.detail.keepEditing }));
    expect(screen.getByLabelText(t.result.fields.accepted)).toHaveValue('1');
  });

  it('저장 안 한 입력이 있으면 목록에서 다른 의뢰를 눌러도 바로 옮기지 않고 묻는다(#185)', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '1');
    await userEvent.click(await findOpenButton('IR-2026-0002'));

    expect(screen.getByText(t.detail.leaveUnsaved)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.detail.keepEditing }));
    expect(screen.getByLabelText(t.result.fields.accepted)).toHaveValue('1');

    await userEvent.click(openButton('IR-2026-0002'));
    await userEvent.click(screen.getByRole('button', { name: t.detail.leaveAnyway }));
    await waitFor(() => expect(screen.queryByText(t.detail.leaveUnsaved)).not.toBeInTheDocument());
  });

  it('의뢰를 고르면 그 의뢰의 상세가 선다 — 목록과 상세가 같은 건을 가리킨다', async () => {
    renderScreen('/?ir=1002');

    expect(await screen.findByText(t.detail.fields.inspectionPlanVersionId)).toBeInTheDocument();
  });

  it('회차에 저장된 수량이 편집 칸에 되돌아온다', async () => {
    renderScreen('/?ir=1001');

    await findRound(1);

    expect(screen.getByLabelText(t.result.fields.accepted)).toHaveValue('480');
    expect(screen.getByLabelText(t.result.fields.rejected)).toHaveValue('15');
    expect(screen.getByLabelText(t.result.fields.held)).toHaveValue('5');
  });

  it('되돌아온 수량이 합계 제약을 만족하면 미입력이 0 이다', async () => {
    renderScreen('/?ir=1001');

    await waitFor(() =>
      expect(document.querySelector('.iqc-inspection-progress-status')?.textContent).toBe(
        `${t.result.remaining} 0`,
      ),
    );
  });

  /*
   * ⭐ 리뷰가 잡은 자리다. 회차 값만 의존성에 두면 «회차가 없는 의뢰끼리» 옮길 때
   * 네 값이 모두 그대로여서 되돌림이 깨어나지 않고, 앞 의뢰에 친 수량이 다음 화면에 남는다.
   * 저장이 붙는 순간 다른 LOT 에 앞 의뢰의 수량을 저장하는 길이 된다.
   */
  it('회차가 없는 의뢰끼리 옮겨도 앞 의뢰에 친 수량이 남지 않는다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '123');
    expect(screen.getByLabelText(t.result.fields.accepted)).toHaveValue('123');

    await goToRequest('IR-2026-0002');

    await waitFor(() => expect(screen.getByLabelText(t.result.fields.accepted)).toHaveValue(''));
  });

  /* omf-all-around#104 — 검사자는 계정에 연결된 작업자다. 연결이 없으면 누르기 전에 막고 이유를 말한다. */
  it('계정에 작업자가 연결되지 않았으면 저장·확정을 잠그고 사유를 낸다', async () => {
    testSession = { ...SYNTHETIC_SESSION, worker: null };
    const { writes } = renderScreen('/?ir=1001');

    expect(await screen.findByText(t.result.workerNotLinked)).toBeInTheDocument();
    /* 입력으로 풀 수 없는 막힘이라 칸도 잠근다(#135). */
    expect(screen.getByLabelText(t.result.fields.held)).toBeDisabled();
    expect(screen.getByLabelText(t.result.fields.accepted)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.result.confirm })).toBeDisabled();
    expect(writes).toHaveLength(0);
  });

  it('옛 서버처럼 세션에 연결 칸이 없으면 막지 않는다 — 모르는 것을 「없음」으로 읽지 않는다', async () => {
    testSession = SYNTHETIC_SESSION;
    renderScreen('/?ir=1001');

    await findRound(1);
    expect(screen.queryByText(t.result.workerNotLinked)).not.toBeInTheDocument();
  });

  /* omf-all-around#102 — 샘플 검사는 샘플 수량만 나눠 넣어도 저장된다. */
  it('샘플 기준이면 검사수량이 샘플 수량이고 그 수량으로 저장한다', async () => {
    samplingVersion = { samplingMethodCode: 'SAMPLE_BY_LOT', samplingRatio: 10 };
    const { writes } = renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    expect((await screen.findAllByText(/^50\b/)).length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '50');
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = await bodyOf(writes[0]!);
    expect(body.inspectedQty).toBe(50);
    expect(body.acceptedQty).toBe(50);
  });

  it('회차가 없으면 저장이 새로 만든다', async () => {
    const { writes } = renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.confirmBlockedByUnsaved);
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

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(writes[0] as Request);
    expect(body).not.toHaveProperty('inspectorId');
    expect(body).not.toHaveProperty('terminalId');
    expect(body.statusCode).toBe('DRAFT');
  });

  it('작성중 회차가 있으면 그것을 고치고 잠금 토큰을 싣는다', async () => {
    const { writes } = renderScreen('/?ir=1001');

    await findRound(1);
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = writes[0] as Request;
    expect(request.method).toBe('PUT');
    expect(request.headers.get('If-Match')).toBe('W/"7"');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('저장이 끝나면 회차를 다시 부른다 — 화면과 서버가 갈리지 않게', async () => {
    const { writes, sent } = renderScreen('/?ir=1001');

    await findRound(1);
    const before = queueCalls(sent).length;
    await editQuantity();
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

    await findRound(1);
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await screen.findByText(t.result.saved);

    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '9');

    await waitFor(() => expect(screen.queryByText(t.result.saved)).not.toBeInTheDocument());
  });

  /*
   * ⭐ 실검증에서 잡은 자리다(#133). 저장 뒤 다시 부른 회차의 수량이 저장 전과 다르면(= 거의 항상) 회차를 되돌리는
   * 자리가 「저장했습니다」까지 지워, 저장이 됐는지 화면이 말하지 않았다.
   */
  it('저장 뒤 다시 부른 회차 수량이 바뀌어도 「저장했습니다」를 남긴다', async () => {
    renderScreen('/?ir=1001', undefined, [draftRound], [], itemSpecsResponse(), [
      {
        ...draftRound,
        heldQty: draftRound.heldQty + 1,
        versionNo: (draftRound.versionNo ?? 1) + 1,
      },
    ]);

    await findRound(1);
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    await screen.findByText(t.result.saved);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByText(t.result.saved)).toBeInTheDocument();
  });

  it('저장한 뒤 판정을 바꾸면 「저장했습니다」를 지운다 — 수량 말고 다른 칸도 저장되지 않은 변경이다', async () => {
    renderScreen('/?ir=1001');

    await findRound(1);
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await screen.findByText(t.result.saved);

    await userEvent.click(screen.getByLabelText(t.result.judgment));
    const options = await screen.findAllByRole('option');
    const other = options.find((option) => option.getAttribute('aria-selected') !== 'true');
    await userEvent.click(other as HTMLElement);

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
    /* 입력하면 저장 단추가 켜진다 — 경고는 알리기만 하고 차단하지 않는다. */
    await editQuantity();
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

  /*
   * omf-all-around#101 결정 A — 검사기준이 없어도 입하 IQC 의뢰가 선다. 그 의뢰는 측정 항목 없이
   * 수량·종합 판정만으로 확정할 수 있어야 한다(항목 규격을 부르지 않는다).
   */
  it('검사기준이 없는 의뢰도 항목 없이 수량·판정으로 확정한다', async () => {
    const { sent, writes } = renderScreen('/?ir=1004');

    await findRound(1);
    await userEvent.click(await screen.findByRole('button', { name: t.result.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(new URL((writes[0] as Request).url).pathname).toContain(':confirm');
    expect(sent.some((url) => url.pathname.endsWith('/items'))).toBe(false);
  });

  it('확정하면 되돌릴 수 없는 쓰기가 잠금 토큰과 함께 나간다', async () => {
    const { writes } = renderScreen('/?ir=1001');

    await findRound(1);
    await userEvent.click(await screen.findByRole('button', { name: t.result.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = writes[0] as Request;
    expect(new URL(request.url).pathname).toContain(':confirm');
    expect(request.headers.get('If-Match')).toBe('W/"7"');
    expect(request.headers.get('Idempotency-Key')).not.toBeNull();
    expect(await bodyOf(request)).toEqual({ overallJudgmentCode: 'ACCEPTED' });
  });

  /*
   * omf-all-around#125 — 기준에 합격판정개수가 있으면 수량으로 판정을 채우고, 다르게 고르면 변경 사유를 받아야 확정된다.
   * 작성중 회차(draftRound)는 합격 480 · 불합격 15 · 보류 5 · 판정 합격이다.
   */
  it('합격판정개수 5 · 불합격 15 인데 합격이면 변경 사유 칸이 서고, 사유를 넣어야 확정되며 사유가 실린다', async () => {
    samplingVersion = {
      samplingMethodCode: 'FULL_INSPECTION',
      samplingRatio: null,
      acceptanceNumber: 5,
    };
    const { writes } = renderScreen('/?ir=1001');

    await findRound(1);
    expect(
      await screen.findByText(new RegExp(t.result.judgmentChange.basis(5))),
    ).toBeInTheDocument();
    const reason = await screen.findByLabelText(new RegExp(t.result.judgmentChange.reason));
    expect(screen.getByText(t.result.judgmentChange.required)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.result.confirm })).toBeDisabled();

    await userEvent.type(reason, '  재확인 결과 사용 가능 ');
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await bodyOf(writes[0] as Request)).toEqual({
      overallJudgmentCode: 'ACCEPTED',
      judgmentChangeReason: '재확인 결과 사용 가능',
    });
  });

  /* 사유는 임시 저장에 실리지 않는다(확정에만) — 친 사유를 두고 떠나면 사라지므로 묻는다(#133 실검증). */
  it('판정 변경 사유만 쳐도 목록으로 가기 전에 묻는다', async () => {
    samplingVersion = {
      samplingMethodCode: 'FULL_INSPECTION',
      samplingRatio: null,
      acceptanceNumber: 5,
    };
    renderScreen('/?ir=1001');

    await findRound(1);
    const reason = await screen.findByLabelText(new RegExp(t.result.judgmentChange.reason));
    await userEvent.type(reason, '재확인');
    await userEvent.click(screen.getByRole('button', { name: closeDetail }));

    expect(screen.getByText(t.detail.leaveUnsaved)).toBeInTheDocument();
  });

  /* 확정 직전에 고른 값이 「바뀐 것」으로 남아도 이미 확정에 실렸다 — 확정 뒤 목록으로 갈 때 묻지 않는다(#133 실검증). */
  it('판정 확정 뒤에는 목록으로 갈 때 묻지 않는다', async () => {
    samplingVersion = {
      samplingMethodCode: 'FULL_INSPECTION',
      samplingRatio: null,
      acceptanceNumber: 5,
    };
    const { writes } = renderScreen('/?ir=1001', undefined, [draftRound], [], itemSpecsResponse(), [
      { ...draftRound, statusCode: 'CONFIRMED', confirmedAt: '2026-10-22T04:00:00.000Z' },
    ]);

    await findRound(1);
    const reason = await screen.findByLabelText(new RegExp(t.result.judgmentChange.reason));
    await userEvent.type(reason, '재확인');
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: t.result.confirm })).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: closeDetail }));
    expect(screen.queryByText(t.detail.leaveUnsaved)).not.toBeInTheDocument();
  });

  it('수량을 고치면 판정을 자동으로 채운다 — 자동 판정과 같으면 사유 칸이 없다', async () => {
    samplingVersion = {
      samplingMethodCode: 'FULL_INSPECTION',
      samplingRatio: null,
      acceptanceNumber: 20,
    };
    const { writes } = renderScreen('/?ir=1001');

    await findRound(1);
    /* 보류 5 가 있어 자동 판정은 보류다 — 저장된 합격과 다르다. */
    expect(
      await screen.findByLabelText(new RegExp(t.result.judgmentChange.reason)),
    ).toBeInTheDocument();

    const held = screen.getByLabelText(t.result.fields.held);
    await userEvent.clear(held);
    await userEvent.type(held, '0');
    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '5');

    await waitFor(() =>
      expect(screen.queryByLabelText(new RegExp(t.result.judgmentChange.reason))).toBeNull(),
    );
    const rejected = screen.getByLabelText(t.result.fields.rejected);
    await userEvent.clear(rejected);
    await userEvent.type(rejected, '25');
    /* 불합격 25 > 20 — 자동으로 불합격이 되고 불합격 사유 칸이 선다. */
    expect(await screen.findByText(t.result.rejection.heading)).toBeInTheDocument();
    expect(screen.queryByLabelText(new RegExp(t.result.judgmentChange.reason))).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('합격판정개수가 없는 기준이면 자동 판정·사유 칸이 없다(종전 그대로)', async () => {
    samplingVersion = {
      samplingMethodCode: 'FULL_INSPECTION',
      samplingRatio: null,
      acceptanceNumber: null,
    };
    const { writes } = renderScreen('/?ir=1001');

    await findRound(1);
    await userEvent.click(await screen.findByRole('button', { name: t.result.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(
      screen.queryByText(new RegExp(t.result.judgmentChange.basis(0).replace('0', '\\d+'))),
    ).toBeNull();
    expect(await bodyOf(writes[0] as Request)).toEqual({ overallJudgmentCode: 'ACCEPTED' });
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

    await findRound(1);
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

    await findRound(1);

    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '보류' }));

    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).toMatchObject({ overallJudgmentCode: 'HELD' });
  });

  it('아직 고르지 않은 판정은 키 자체를 싣지 않는다 — 빈 문자열은 코드가 아니다', async () => {
    const { writes } = renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    await editQuantity();
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
    /* 실패해도 목록으로 접지 않고 상세 자리에 머문다 — 돌아가는 길은 「← 목록」이다. */
    expect(screen.getByRole('button', { name: closeDetail })).toBeInTheDocument();
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

    await findRound(1);
    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));
    await editQuantity();
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

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    await editQuantity();
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

    await findRound(1);
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

    await findRound(1);
    expect(await screen.findByText(t.measurements.calibrationExpired)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));

    await waitFor(() =>
      expect(screen.queryByText(t.measurements.calibrationExpired)).not.toBeInTheDocument(),
    );
  });

  /* 재검사 중에는 확정본이 「앞 회차」가 되므로 이력 쪽이 제자리다. */
  it('재검사 중에는 확정본이 이전 회차 이력으로 옮겨 간다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [confirmedRound]);

    await findRound(1);
    expect(screen.queryByText(t.history.heading)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));

    expect(screen.getAllByText(t.history.heading).length).toBeGreaterThan(0);
  });

  it('회차가 둘이면 앞 회차가 이력에 남는다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      reinspectionRound,
      confirmedRound,
    ]);

    await findRound(2);
    expect(screen.getAllByText(t.history.heading).length).toBeGreaterThan(0);
  });
});

describe('IqcInspectionScreen — 확정 결과 문면', () => {
  /* 확정을 누른 «그 순간»에만 나온다 — 그것이 결과이지 상태가 아니라는 증거다. */
  it('확정하면 됐다고 말한다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      { ...draftRound, acceptedQty: 500, rejectedQty: 0, heldQty: 0 },
    ]);

    await findRound(1);
    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));

    expect(await screen.findByText(t.result.confirmSucceeded)).toBeInTheDocument();
  });

  it('다른 의뢰로 옮기면 그 문면이 지워진다 — 그 의뢰에서 한 일이 아니다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      { ...draftRound, acceptedQty: 500, rejectedQty: 0, heldQty: 0 },
    ]);

    await findRound(1);
    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));
    await screen.findByText(t.result.confirmSucceeded);

    await goToRequest(queueItems[1]!.inspectionRequestNo);

    await waitFor(() =>
      expect(screen.queryByText(t.result.confirmSucceeded)).not.toBeInTheDocument(),
    );
  });
});

/* omf-all-around#106 · #121 — 불합격이면 불량 코드·사유를 받아 확정 요청에 함께 싣는다. */
describe('IqcInspectionScreen — 불합격 사유', () => {
  const rejectedRound = { ...draftRound, acceptedQty: 485, rejectedQty: 15, heldQty: 0 };

  const chooseRejected = async (): Promise<void> => {
    await findRound(1);
    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '불합격' }));
  };

  it('불합격을 고르면 사유 칸이 서고, 코드를 고르기 전에는 확정이 잠긴다', async () => {
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [rejectedRound]);
    await chooseRejected();

    expect(
      await screen.findByRole('group', { name: t.result.rejection.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.result.rejection.required)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.result.confirm })).toBeDisabled();
  });

  it('상세가 있는 대분류는 상세까지 골라야 하고, 사유는 확정 요청 하나에 실려 나간다', async () => {
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedRound,
    ]);
    await chooseRejected();

    await userEvent.click(await screen.findByLabelText(t.result.rejection.major));
    await userEvent.click(await screen.findByRole('option', { name: 'APP · 외관' }));
    expect(screen.getByText(t.result.rejection.minorRequired)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(t.result.rejection.minor));
    await userEvent.click(await screen.findByRole('option', { name: 'APP-SCR · 스크래치' }));
    await userEvent.type(screen.getByLabelText(t.result.rejection.description), '표면 긁힘');
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(new URL((writes[0] as Request).url).pathname).toContain(':confirm');
    expect(await bodyOf(writes[0] as Request)).toEqual({
      overallJudgmentCode: 'REJECTED',
      defects: [{ defectCodeId: 7002, defectQty: 15, defectDescription: '표면 긁힘' }],
    });
  });

  /* #121 — 확정이 실패한 뒤 사유를 고쳐 다시 누르면 «고친 값»이 나가고, 불량 기록 등록은 따로 나가지 않는다. */
  it('확정 실패 뒤 사유를 고쳐 다시 확정하면 고친 사유가 실린다', async () => {
    let shouldFail = true;
    confirmResponder = (): Response => {
      if (shouldFail) {
        shouldFail = false;
        return jsonResponse({ message: '서버 오류' }, { status: 500 });
      }
      return jsonResponse(draftRound);
    };
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedRound,
    ]);
    await chooseRejected();
    await userEvent.click(await screen.findByLabelText(t.result.rejection.major));
    await userEvent.click(await screen.findByRole('option', { name: 'APP · 외관' }));
    await userEvent.click(screen.getByLabelText(t.result.rejection.minor));
    await userEvent.click(await screen.findByRole('option', { name: 'APP-SCR · 스크래치' }));
    await userEvent.type(screen.getByLabelText(t.result.rejection.description), '처음');
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));
    await waitFor(() => expect(writes).toHaveLength(1));

    await userEvent.clear(screen.getByLabelText(t.result.rejection.description));
    await userEvent.type(screen.getByLabelText(t.result.rejection.description), '고친 사유');
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));
    await waitFor(() => expect(writes).toHaveLength(2));

    expect(writes.every((request) => new URL(request.url).pathname.endsWith(':confirm'))).toBe(
      true,
    );
    expect(await bodyOf(writes[1] as Request)).toMatchObject({
      defects: [{ defectCodeId: 7002, defectDescription: '고친 사유' }],
    });
  });

  /*
   * 3단계 검증 버그 — 사유를 넣고 [임시 저장]을 누르면 사유가 사라졌다. 사유는 저장 본문에 실리지 않고(확정 직전 불량
   * 기록으로 남는다) 저장 응답이 회차의 판정을 바꾸면서 초안 되돌림이 사유까지 비웠다. 저장 뒤에도 남아 확정에 실려야 한다.
   */
  it('임시 저장 뒤에도 불량 코드·사유가 남고, 확정하면 그 값이 확정 요청에 실린다', async () => {
    const { writes } = renderScreen(
      '/?ir=1001',
      () => jsonResponse(queueResponse()),
      [rejectedRound],
      [],
      itemSpecsResponse(),
      [
        {
          ...rejectedRound,
          overallJudgmentCode: 'REJECTED',
          versionNo: (rejectedRound.versionNo ?? 1) + 1,
        },
      ],
    );
    await chooseRejected();
    await userEvent.click(await screen.findByLabelText(t.result.rejection.major));
    await userEvent.click(await screen.findByRole('option', { name: 'APP · 외관' }));
    await userEvent.click(screen.getByLabelText(t.result.rejection.minor));
    await userEvent.click(await screen.findByRole('option', { name: 'APP-SCR · 스크래치' }));
    await userEvent.type(screen.getByLabelText(t.result.rejection.description), '표면 긁힘');

    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));
    /* 저장 응답으로 회차의 판정이 불합격으로 바뀐 «뒤»를 본다 — 확정이 풀리는 것이 그 신호다. */
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.result.confirm })).toBeEnabled(),
    );

    expect(screen.getByLabelText(t.result.rejection.major)).toHaveTextContent('APP · 외관');
    expect(screen.getByLabelText(t.result.rejection.minor)).toHaveTextContent('APP-SCR · 스크래치');
    expect(screen.getByLabelText(t.result.rejection.description)).toHaveValue('표면 긁힘');

    const savedCount = writes.length;
    await userEvent.click(screen.getByRole('button', { name: t.result.confirm }));
    await waitFor(() => expect(writes.length).toBe(savedCount + 1));
    const confirmed = writes[savedCount] as Request;
    expect(new URL(confirmed.url).pathname).toContain(':confirm');
    expect(await bodyOf(confirmed)).toMatchObject({
      defects: [{ defectCodeId: 7002, defectDescription: '표면 긁힘' }],
    });
  });
});

/* omf-all-around#122 — 임시 저장이 불합격 사유를 싣고, 다시 열면 저장된 사유가 칸에 돌아온다. */
describe('IqcInspectionScreen — 불합격 사유 임시 저장', () => {
  const rejectedDraft = {
    ...draftRound,
    acceptedQty: 485,
    rejectedQty: 15,
    heldQty: 0,
    overallJudgmentCode: 'REJECTED',
  };

  it('다시 연 작성중 회차의 사유를 대분류·상세·사유 칸에 되살린다', async () => {
    draftRecordsForTest = [
      { defectRecordId: 1, defectCodeId: 7002, defectDescription: '표면 긁힘' },
    ];
    const { sent } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedDraft,
    ]);

    await waitFor(() =>
      expect(screen.getByLabelText(t.result.rejection.description)).toHaveValue('표면 긁힘'),
    );
    expect(screen.getByLabelText(t.result.rejection.major)).toHaveTextContent('APP · 외관');
    expect(screen.getByLabelText(t.result.rejection.minor)).toHaveTextContent('APP-SCR · 스크래치');
    const lookup = sent.find((url) => url.pathname === '/quality/defect-records');
    expect(lookup?.searchParams.get('inspectionResultId')).toBe(
      String(draftRound.inspectionResultId),
    );
    /* 되살린 값은 저장된 값이다 — 바꾼 것이 없으니 [임시 저장]은 꺼져 있다. */
    expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled();
  });

  it('사유만 고쳐도 [임시 저장]이 켜지고, 저장 본문에 고친 사유가 실린다', async () => {
    draftRecordsForTest = [
      { defectRecordId: 1, defectCodeId: 7002, defectDescription: '표면 긁힘' },
    ];
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedDraft,
    ]);
    await waitFor(() =>
      expect(screen.getByLabelText(t.result.rejection.description)).toHaveValue('표면 긁힘'),
    );

    await userEvent.clear(screen.getByLabelText(t.result.rejection.description));
    await userEvent.type(screen.getByLabelText(t.result.rejection.description), '찍힘');
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect((writes[0] as Request).method).toBe('PUT');
    expect(await bodyOf(writes[0] as Request)).toMatchObject({
      overallJudgmentCode: 'REJECTED',
      defects: [{ defectCodeId: 7002, defectQty: 15, defectDescription: '찍힘' }],
    });
  });

  /* omf-all-around#130 — 추정 원인을 고르면 저장 본문에 싣고, 다시 열면 되살린다. */
  it('추정 원인을 고르면 임시 저장 본문에 원인이 실린다', async () => {
    draftRecordsForTest = [
      { defectRecordId: 1, defectCodeId: 7002, defectDescription: '표면 긁힘' },
    ];
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedDraft,
    ]);
    await waitFor(() =>
      expect(screen.getByLabelText(t.result.rejection.description)).toHaveValue('표면 긁힘'),
    );
    expect(screen.getByLabelText(t.result.rejection.cause)).toHaveTextContent(
      t.result.rejection.causeNone,
    );

    await userEvent.click(screen.getByLabelText(t.result.rejection.cause));
    await userEvent.click(
      await screen.findByRole('option', { name: 'SUP-PRC · 공급사 공정 (공급사)' }),
    );
    /* 사용 중지된 원인은 고를 수 없다. */
    expect(screen.queryByRole('option', { name: /OLD · 옛 원인/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).toMatchObject({
      defects: [{ defectCodeId: 7002, defectQty: 15, suspectedCauseCodeId: 8002 }],
    });
  });

  it('임시 저장된 원인을 되살리고, 사용 중지된 원인도 표시를 붙여 그대로 다시 보낸다', async () => {
    draftRecordsForTest = [
      {
        defectRecordId: 1,
        defectCodeId: 7002,
        defectDescription: '표면 긁힘',
        suspectedCauseCodeId: 8009,
      },
    ];
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedDraft,
    ]);
    await waitFor(() =>
      expect(screen.getByLabelText(t.result.rejection.cause)).toHaveTextContent(
        t.result.rejection.causeInactive('OLD · 옛 원인'),
      ),
    );
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).toMatchObject({
      defects: [{ defectCodeId: 7002, suspectedCauseCodeId: 8009 }],
    });
  });

  /* #122 리뷰 M2 — 서버의 사유를 모르는 채로 빈 배열을 보내면 서버가 사유를 지운다. */
  it('사유 조회가 실패하면 저장 본문에 사유 키를 싣지 않는다', async () => {
    draftRecordsFailForTest = true;
    const { writes, sent } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedDraft,
    ]);
    await waitFor(() =>
      expect(sent.some((url) => url.pathname === '/quality/defect-records')).toBe(true),
    );
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect((writes[0] as Request).method).toBe('PUT');
    expect(await bodyOf(writes[0] as Request)).not.toHaveProperty('defects');
  });

  it('코드 마스터에 없는 코드라 사유 글만 되살렸으면 코드를 고르기 전 저장은 사유 키를 싣지 않는다', async () => {
    draftRecordsForTest = [
      { defectRecordId: 1, defectCodeId: 9999, defectDescription: '옛 코드 사유' },
    ];
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedDraft,
    ]);
    await waitFor(() =>
      expect(screen.getByLabelText(t.result.rejection.description)).toHaveValue('옛 코드 사유'),
    );
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).not.toHaveProperty('defects');
  });

  /* #122 리뷰 m1 — 첫 저장(POST)이 만든 회차를 되살리면 그새 고친 사유를 덮는다. */
  it('첫 저장으로 회차가 생겨도 사유를 서버 값으로 덮지 않는다', async () => {
    draftRecordsForTest = [{ defectRecordId: 1, defectCodeId: 7001, defectDescription: '서버 값' }];
    const { writes } = renderScreen(
      '/?ir=1002',
      () => jsonResponse(queueResponse()),
      [],
      [],
      itemSpecsResponse(),
      [rejectedDraft],
    );
    await screen.findByText(t.result.confirmBlockedByUnsaved);
    await editQuantity();
    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '불합격' }));
    await userEvent.click(await screen.findByLabelText(t.result.rejection.major));
    await userEvent.click(await screen.findByRole('option', { name: 'APP · 외관' }));
    await userEvent.click(screen.getByLabelText(t.result.rejection.minor));
    await userEvent.click(await screen.findByRole('option', { name: 'APP-SCR · 스크래치' }));
    await userEvent.type(screen.getByLabelText(t.result.rejection.description), '내 사유');
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect((writes[0] as Request).method).toBe('POST');

    /* 저장 응답 뒤 회차가 생겨 고칠 회차가 바뀐 것 — 확정이 풀리는 것이 그 신호다. */
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.result.confirm })).toBeEnabled(),
    );
    expect(screen.getByLabelText(t.result.rejection.description)).toHaveValue('내 사유');
    expect(screen.getByLabelText(t.result.rejection.minor)).toHaveTextContent('APP-SCR · 스크래치');
  });

  it('합격으로 바꿨다가 다시 불합격을 고르면 사유 칸이 비어 있다', async () => {
    draftRecordsForTest = [
      { defectRecordId: 1, defectCodeId: 7002, defectDescription: '표면 긁힘' },
    ];
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [rejectedDraft]);
    await waitFor(() =>
      expect(screen.getByLabelText(t.result.rejection.description)).toHaveValue('표면 긁힘'),
    );

    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));
    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '불합격' }));

    expect(await screen.findByLabelText(t.result.rejection.description)).toHaveValue('');
    expect(screen.getByLabelText(t.result.rejection.major)).not.toHaveTextContent('APP · 외관');
    expect(screen.getByText(t.result.rejection.required)).toBeInTheDocument();
  });

  it('합격으로 바꿔 저장하면 빈 사유를 실어 앞서 저장한 사유를 지운다', async () => {
    draftRecordsForTest = [
      { defectRecordId: 1, defectCodeId: 7002, defectDescription: '표면 긁힘' },
    ];
    const { writes } = renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [
      rejectedDraft,
    ]);
    await waitFor(() =>
      expect(screen.getByLabelText(t.result.rejection.description)).toHaveValue('표면 긁힘'),
    );

    await userEvent.click(screen.getByLabelText(t.result.judgment));
    await userEvent.click(await screen.findByRole('option', { name: '합격' }));
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));

    expect(await bodyOf(writes[0] as Request)).toMatchObject({
      overallJudgmentCode: 'ACCEPTED',
      defects: [],
    });
  });
});

/* omf-all-around#106 후속 (나) — 불량 LOT 은 재검사 대신 처분·반품으로 잇는다. */
describe('IqcInspectionScreen — 불량 LOT 다음 처리', () => {
  const rejectedConfirmed = {
    ...confirmedRound,
    overallJudgmentCode: 'REJECTED',
    acceptedQty: 485,
    rejectedQty: 15,
    heldQty: 0,
  };

  it('불합격 확정 LOT 이 불량이면 재검사 단추 대신 처분 판정·공급사 반품 안내가 선다', async () => {
    lotStatusForTest = 'DEFECTIVE';
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [rejectedConfirmed]);

    expect(await screen.findByText(t.result.followUp.title)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.result.followUp.toDisposition }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.result.followUp.toSupplierReturn }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.result.reinspect })).not.toBeInTheDocument();
  });

  it('처분으로 재검 대기가 된 LOT(불량 아님)은 종전처럼 재검사 단추다', async () => {
    lotStatusForTest = 'INSPECTION_PENDING';
    renderScreen('/?ir=1001', () => jsonResponse(queueResponse()), [rejectedConfirmed]);

    expect(await screen.findByRole('button', { name: t.result.reinspect })).toBeInTheDocument();
    expect(screen.queryByText(t.result.followUp.title)).not.toBeInTheDocument();
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

    await findRound(1);
    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));
    await editQuantity();
    await userEvent.click(screen.getByRole('button', { name: t.result.save }));

    /* 저장이 끝나면 화면은 새로 생긴 2회차를 그린다 — 재검사 모드가 풀린 자리다. */
    await findRound(2);

    await editQuantity();
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

    await findRound(1);
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

    await findRound(1);
    await userEvent.click(screen.getByRole('button', { name: t.result.reinspect }));
    expect(screen.getByText(t.result.reinspectRound)).toBeInTheDocument();

    await goToRequest(queueItems[1]!.inspectionRequestNo);

    await findRound(1);
    expect(screen.queryByText(t.result.reinspectRound)).not.toBeInTheDocument();
  });
});

describe('IqcInspectionScreen — 임시 저장 단추', () => {
  it('바뀐 것이 없으면 꺼져 있다가, 입력하면 켜지고, 저장 뒤 다시 꺼진다', async () => {
    const saved = { ...draftRound, heldQty: 51, versionNo: 8 };
    const { writes } = renderScreen(
      '/?ir=1001',
      () => jsonResponse(queueResponse()),
      [draftRound],
      [],
      itemSpecsResponse(),
      [saved],
    );

    await findRound(1);
    const save = screen.getByRole('button', { name: t.result.save });
    expect(save).toBeDisabled();

    await editQuantity();
    expect(save).toBeEnabled();

    await userEvent.click(save);
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: t.result.save })).toBeDisabled());
  });

  it('회차가 없는 의뢰는 빈 칸이 기준이다 — 넣었다 지우면 다시 꺼진다', async () => {
    renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    const save = screen.getByRole('button', { name: t.result.save });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText(t.result.fields.accepted), '3');
    expect(save).toBeEnabled();

    await userEvent.clear(screen.getByLabelText(t.result.fields.accepted));
    expect(save).toBeDisabled();
  });
});

describe('IqcInspectionScreen — 수량 칸 앞자리 0', () => {
  it('치는 동안 앞자리 0 을 정리하고, 저장 값은 같은 수다', async () => {
    const { writes } = renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), []);

    await screen.findByText(t.result.confirmBlockedByUnsaved);
    const accepted = screen.getByLabelText(t.result.fields.accepted);
    await userEvent.type(accepted, '0007');
    expect(accepted).toHaveValue('7');

    const held = screen.getByLabelText(t.result.fields.held);
    await userEvent.type(held, '00.5');
    expect(held).toHaveValue('0.5');

    await userEvent.click(screen.getByRole('button', { name: t.result.save }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await bodyOf(writes[0] as Request)).toMatchObject({ acceptedQty: 7, heldQty: 0.5 });
  });
});

describe('IqcInspectionScreen — 단위 조회', () => {
  it('단위 목록을 계약 최대 크기(200)로 한 번에 부른다 — 기본 크기(50)면 뒤쪽 단위가 잘린다', async () => {
    const { sent } = renderScreen('/?ir=1001');

    await findRound(1);
    await waitFor(() => expect(sent.some((url) => url.pathname === '/mdm/uoms')).toBe(true));

    const call = sent.find((url) => url.pathname === '/mdm/uoms');
    expect(call?.searchParams.get('size')).toBe('200');
    expect(call?.searchParams.get('includeInactive')).toBe('true');
  });
});

/* 3단계 검증 — 끝난 의뢰는 입력 대신 최신 회차의 읽기 전용 요약, 다시 열린 의뢰에서만 [재검사]. */
describe('IqcInspectionScreen — 끝난 의뢰', () => {
  const firstRejected = {
    ...confirmedRound,
    overallJudgmentCode: 'REJECTED',
    acceptedQty: 485,
    rejectedQty: 15,
    heldQty: 0,
  };
  const secondAccepted = {
    ...confirmedRound,
    inspectionResultId: 9002,
    inspectionRound: 2,
    overallJudgmentCode: 'ACCEPTED',
    acceptedQty: 500,
    rejectedQty: 0,
    heldQty: 0,
    previousResultId: confirmedRound.inspectionResultId,
  };

  it('의뢰가 끝났으면 회차 단추 없이 최신 회차 요약만 보이고 판정·수량 입력과 [재검사]가 없다', async () => {
    renderScreen('/?ir=1005', () => jsonResponse(queueResponse()), [firstRejected, secondAccepted]);

    const summary = await screen.findByRole('region', { name: t.result.closed.title });
    expect(within(summary).getByText(t.result.round(2))).toBeInTheDocument();
    expect(within(summary).getByText(t.result.closed.finalJudgment)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.result.fields.accepted)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.result.judgment)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.result.reinspect })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.result.save })).not.toBeInTheDocument();
  });

  it('보류로 확정한 의뢰는 끝났어도 요약 대신 [재검사]가 선다 — LOT 이 검사 대기에 남는다', async () => {
    const held = { ...firstRejected, overallJudgmentCode: 'HELD', rejectedQty: 0, heldQty: 15 };
    renderScreen('/?ir=1005', () => jsonResponse(queueResponse()), [held]);

    expect(await screen.findByRole('button', { name: t.result.reinspect })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.result.closed.title })).not.toBeInTheDocument();
  });

  it('재작업으로 의뢰가 다시 열리면(IN_PROGRESS) 확정 회차여도 [재검사]가 선다', async () => {
    renderScreen('/?ir=1002', () => jsonResponse(queueResponse()), [firstRejected]);

    expect(await screen.findByRole('button', { name: t.result.reinspect })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.result.closed.title })).not.toBeInTheDocument();
  });
});
