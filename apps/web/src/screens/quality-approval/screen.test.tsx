import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { QualityApprovalScreen } from './screen';
import {
  concessionDetailPath,
  customerReferencePath,
  requestDetailPath,
  workOrderReferencePath,
} from './queries';
import type { ApprovalRequest, ApprovalRequestDetail, Concession } from './types';

const t = messages.qualityApproval;
const PATH = '/app/approval-requests';
const CONCESSIONS_PATH = '/quality/concessions';

const requests: ApprovalRequest[] = [
  {
    approvalRequestId: 31,
    approvalRequestNo: 'SYNTH-REQ-031',
    approvalTypeCode: 'SYNTH-CONCESSION',
    requestedBy: 7,
    requestedByName: '합성 사용자',
    requestedAt: '2026-08-22T09:30:00+09:00',
    statusCode: 'SYNTH-PENDING',
    reason: '합성 승인 근거',
    target: {
      targetTypeCode: 'SYNTH-DOCUMENT',
      targetId: 91,
      displayName: '합성 대상',
      openable: false,
    },
    currentStepNo: 1,
    totalStepNo: 2,
    isMyTurn: true,
  },
];

const listBody = (items: ApprovalRequest[] = requests, total = items.length, page = 1) => ({
  items,
  page: { page, size: 20, total },
});

const listRoute = (respond: () => Response = () => jsonResponse(listBody())): StubRoute => ({
  match: (request) => new URL(request.url).pathname === PATH,
  respond,
});

const detailBody = (
  request: ApprovalRequest = {
    ...requests[0]!,
    requestedBy: 700_007,
    reason: '\n  첫 근거  \n둘째 근거',
    target: { ...requests[0]!.target, targetId: 910_009 },
  },
): ApprovalRequestDetail => ({
  request,
  steps: [
    {
      stepNo: 4,
      approverId: 800_004,
      approverName: '합성 결재자',
      isMine: true,
      isCurrent: true,
    },
  ],
});

const detailRoute = (
  approvalRequestId = 31,
  respond: StubRoute['respond'] = () => jsonResponse(detailBody()),
): StubRoute => ({
  match: (request) => new URL(request.url).pathname === requestDetailPath(approvalRequestId),
  respond,
});

const concession: Concession = {
  concessionId: 501,
  concessionNo: 'SYNTH-CN-501',
  nonconformanceId: 701,
  lotId: 801,
  approvedQty: 10,
  consumedQty: 2,
  uomId: 901,
  validFrom: '2026-08-22',
  validTo: '2026-09-30',
  allowedWorkOrderId: 1_201,
  allowedProcessId: 1_301,
  allowedCustomerId: 1_401,
  unrestrictedAxes: ['SYNTH-UNDEFINED-AXIS'],
  approvalRequestId: 31,
  statusCode: 'SYNTH-ACTIVE',
  usable: false,
  remarks: '합성 조건 비고',
};

const candidateBody = (items: Concession[] = [], total = items.length) => ({
  items,
  page: { page: 1, size: 2, total },
});

const candidateRoute = (
  respond: StubRoute['respond'] = () => jsonResponse(candidateBody()),
): StubRoute => ({
  match: (request) => new URL(request.url).pathname === CONCESSIONS_PATH,
  respond,
});

const concessionRoute = (
  respond: StubRoute['respond'] = () => jsonResponse(concession),
): StubRoute => ({
  match: (request) => new URL(request.url).pathname === concessionDetailPath(501),
  respond,
});

const workOrderRoute = (
  respond: StubRoute['respond'] = () =>
    jsonResponse({ workOrderId: 1_201, workOrderNo: 'SYNTH-WO-1201' }),
): StubRoute => ({
  match: (request) => new URL(request.url).pathname === workOrderReferencePath(1_201),
  respond,
});

const customerRoute = (
  respond: StubRoute['respond'] = () =>
    jsonResponse({
      partnerId: 1_401,
      partnerCode: 'SYNTH-CUSTOMER-CODE',
      partnerName: '합성 고객',
      erpPartnerCode: 'SYNTH-ERP-CUSTOMER',
    }),
): StubRoute => ({
  match: (request) => new URL(request.url).pathname === customerReferencePath(1_401),
  respond,
});

const approvalFetch = (routes: StubRoute[]): StubFetch =>
  createStubFetch([...routes, detailRoute(), candidateRoute(), workOrderRoute(), customerRoute()]);

const recordingFetch = (...routes: StubRoute[]): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = approvalFetch(routes);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));
      return stub(request);
    },
  };
};

const Controls = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [, setSearchParams] = useSearchParams();

  return (
    <>
      <output aria-label="현재 주소">{location.search}</output>
      <output aria-label="주소 변경 방식">{navigationType}</output>
      <button
        type="button"
        onClick={() => {
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('view', 'changed');
            return next;
          });
        }}
      >
        무관 주소 변경
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        뒤로
      </button>
    </>
  );
};

const renderScreen = (
  fetch: StubFetch,
  route = '/quality-approval',
  approvalTypeCodes?: readonly string[],
) => {
  const result = renderWithProviders(
    <>
      <Controls />
      <QualityApprovalScreen approvalTypeCodes={approvalTypeCodes} />
    </>,
    { fetch, route },
  );

  return { ...result, user: userEvent.setup() };
};

const findRequest = () =>
  screen.findByRole('button', { name: t.actions.selectRow('SYNTH-REQ-031') });

describe('QualityApprovalScreen query and disclosure', () => {
  it('assignedToMe와 적용된 URL만 보내고 미확정 코드·선택·무관 키는 보내지 않는다', async () => {
    const recorded = recordingFetch(listRoute());
    renderScreen(
      recorded.fetch,
      '/quality-approval?ty=UNCONFIRMED&st=UNKNOWN&q=SYNTH&page=2&rq=31&view=compact',
    );

    expect(await findRequest()).toBeInTheDocument();
    expect(screen.getByText(t.scopeWarning)).toBeInTheDocument();
    expect(recorded.urls.filter((url) => url.pathname === PATH)).toHaveLength(1);
    expect(Object.fromEntries(recorded.urls[0]?.searchParams ?? [])).toEqual({
      assignedToMe: 'true',
      pendingOnly: 'true',
      q: 'SYNTH',
      page: '2',
    });
  });

  it('승인 유형 기준값이 준비되면 넓은 조회 경고를 거두고 해당 유형을 보낸다', async () => {
    const recorded = recordingFetch(listRoute());
    renderScreen(recorded.fetch, '/quality-approval?ty=SYNTH-CONCESSION', ['SYNTH-CONCESSION']);

    expect(await findRequest()).toBeInTheDocument();
    expect(screen.queryByText(t.scopeWarning)).not.toBeInTheDocument();
    expect(screen.getByText(t.codePending)).toBeInTheDocument();
    expect(Object.fromEntries(recorded.urls[0]?.searchParams ?? [])).toEqual({
      assignedToMe: 'true',
      pendingOnly: 'true',
      approvalTypeCode: 'SYNTH-CONCESSION',
    });
  });

  it('무관 주소 변경과 조회 응답이 편집 중인 초안을 지우지 않는다', async () => {
    const { user } = renderScreen(approvalFetch([listRoute()]));

    await findRequest();
    await user.type(screen.getByLabelText(t.fields.q), '작성 중');
    await user.click(screen.getByRole('button', { name: '무관 주소 변경' }));

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('작성 중');
  });

  it('적용은 page와 rq를 비우고 무관 URL을 보존한 뒤 새 조건으로 조회한다', async () => {
    const recorded = recordingFetch(listRoute());
    const { user } = renderScreen(recorded.fetch, '/quality-approval?page=3&rq=31&view=compact');

    await findRequest();
    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH-NEW');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?view=compact&q=SYNTH-NEW');
    });
    expect(Object.fromEntries(recorded.urls.at(-1)?.searchParams ?? [])).toEqual({
      assignedToMe: 'true',
      pendingOnly: 'true',
      q: 'SYNTH-NEW',
    });
  });

  it('행 선택은 rq만 바꾸며 뒤로가기는 deep-link 선택을 복원한다', async () => {
    const { user } = renderScreen(approvalFetch([listRoute()]));

    await user.click(
      await screen.findByRole('button', { name: t.actions.selectRow('SYNTH-REQ-031') }),
    );
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?rq=31');

    await user.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => expect(screen.getByLabelText('현재 주소')).toHaveTextContent(''));
  });

  it('범위 전환과 쪽 이동은 첫 쪽/다음 쪽으로 옮기며 선택을 비운다', async () => {
    const { user } = renderScreen(
      approvalFetch([listRoute(() => jsonResponse(listBody(requests, 40)))]),
      '/quality-approval?page=2&rq=31',
    );

    await findRequest();
    await user.click(screen.getByRole('checkbox', { name: t.fields.pendingOnly }));
    await waitFor(() => expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?pd=0'));

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-031') }));
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    await waitFor(() =>
      expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?pd=0&page=2'),
    );
  });

  it('쪽 변경 응답을 기다릴 때 이전 승인 행과 선택 진입점을 숨긴다', async () => {
    let calls = 0;
    const pending = new Promise<Response>(() => undefined);
    const fetch: StubFetch = async () => {
      calls += 1;
      return calls === 1 ? jsonResponse(listBody(requests, 40)) : pending;
    };
    const { user } = renderScreen(fetch, '/quality-approval?rq=31');

    await findRequest();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.selectRow('SYNTH-REQ-031') })).toBeNull();
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?page=2');
  });

  it('초기화는 소유한 조건·범위·쪽·선택만 기본으로 돌린다', async () => {
    const { user } = renderScreen(
      approvalFetch([listRoute()]),
      '/quality-approval?q=SYNTH&page=3&rq=31&pd=0&view=compact',
    );

    await findRequest();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() =>
      expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?view=compact'),
    );
  });
});

describe('QualityApprovalScreen result states', () => {
  it('응답을 기다리는 동안 로딩을 빈 상태와 구분한다', () => {
    const pending: StubFetch = async () => new Promise<Response>(() => undefined);

    renderScreen(pending);

    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });

  it('0건을 오류와 구분해 안내한다', async () => {
    renderScreen(approvalFetch([listRoute(() => jsonResponse(listBody([], 0)))]));

    expect(await screen.findByText(t.empty.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('범위 밖 주소의 첫 쪽 복구는 page와 선택을 비운다', async () => {
    const { user } = renderScreen(
      approvalFetch([listRoute(() => jsonResponse(listBody([], 1, 4)))]),
      '/quality-approval?page=4&rq=31',
    );

    await screen.findByText(t.empty.beyondTitle);
    expect(screen.getByText(t.empty.beyondTitle).closest('[role="status"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));
    await waitFor(() => expect(screen.getByLabelText('현재 주소')).toHaveTextContent(''));
  });

  it('네트워크 오류는 일반 서버 오류가 아니라 오프라인 상태를 알린다', async () => {
    const offlineFetch: StubFetch = async () => {
      throw new TypeError('synthetic offline');
    };

    renderScreen(offlineFetch);

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
  });

  it('403은 권한 안내만 내고 재시도를 주지 않는다', async () => {
    renderScreen(approvalFetch([listRoute(() => jsonResponse({ message: '' }, { status: 403 }))]));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('기타 오류는 재시도로 복구한다', async () => {
    let attempts = 0;
    const { user } = renderScreen(
      approvalFetch([
        listRoute(() => {
          attempts += 1;
          return attempts === 1
            ? jsonResponse({ message: '' }, { status: 500 })
            : jsonResponse(listBody());
        }),
      ]),
    );

    await user.click(await screen.findByRole('button', { name: messages.common.retry }));

    expect(await findRequest()).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});

describe('QualityApprovalScreen detail', () => {
  it('선택 전에는 3구획을 세우되 상세나 /0 요청을 보내지 않는다', async () => {
    const recorded = recordingFetch(listRoute());
    renderScreen(recorded.fetch);

    await findRequest();

    expect(screen.getByRole('region', { name: t.panes.list })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '요청 상세' })).toHaveTextContent(
      '승인 요청을 선택하세요',
    );
    expect(screen.getByRole('region', { name: '결재 진행' })).toHaveTextContent(
      '요청을 선택하면 결재 진행이 표시됩니다',
    );
    expect(recorded.urls.map((url) => url.pathname)).toEqual([PATH]);
  });

  it('상세 정확 경로의 ETag를 잡고 사유 전문·대상만 표시한다', async () => {
    const recorded = recordingFetch(
      listRoute(),
      detailRoute(31, () => jsonResponse(detailBody(), { headers: { ETag: '"9"' } })),
    );
    const { apiClient } = renderScreen(recorded.fetch, '/quality-approval?rq=31');
    const pane = screen.getByRole('region', { name: '요청 상세' });

    const reason = await within(pane).findByRole('group', { name: '사유 전문' });
    expect(reason).toHaveTextContent('둘째 근거');
    expect(reason.querySelectorAll('br')).toHaveLength(2);
    expect(within(pane).getByText('합성 대상')).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: '대상 열기' })).toBeDisabled();
    expect(within(pane).getByText('대상 화면 연결 준비 중')).toBeInTheDocument();
    expect(pane.textContent).not.toContain('700007');
    expect(pane.textContent).not.toContain('910009');
    expect(recorded.urls.map((url) => url.pathname)).toContain(requestDetailPath(31));
    expect(apiClient.etags.ifMatch(requestDetailPath(31))).toBe('"9"');
    expect(await screen.findByText('합성 결재자')).toBeInTheDocument();
    expect(recorded.urls.filter((url) => url.pathname === requestDetailPath(31))).toHaveLength(1);
  });

  it('선택을 바꾸면 다음 상세 대기 중 이전 상세를 숨긴다', async () => {
    const next = { ...requests[0]!, approvalRequestId: 32, approvalRequestNo: 'SYNTH-REQ-032' };
    const pending = new Promise<Response>(() => undefined);
    const base = approvalFetch([listRoute(() => jsonResponse(listBody([requests[0]!, next])))]);
    const fetch: StubFetch = async (request) =>
      new URL(request.url).pathname === requestDetailPath(32) ? pending : base(request);
    const { user } = renderScreen(fetch, '/quality-approval?rq=31');
    const pane = screen.getByRole('region', { name: '요청 상세' });

    expect(await within(pane).findByRole('group', { name: '사유 전문' })).toHaveTextContent(
      '둘째 근거',
    );
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-032') }));

    expect(
      within(pane).getByRole('status', { name: '승인 요청 상세 불러오는 중' }),
    ).toBeInTheDocument();
    expect(within(pane).queryByText('둘째 근거')).toBeNull();
    expect(
      within(screen.getByRole('region', { name: t.panes.progress })).getByRole('status', {
        name: t.progress.loading,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?rq=32');
  });

  it('상세 403은 선택을 유지하고 재시도를 주지 않는다', async () => {
    const recorded = recordingFetch(
      listRoute(),
      detailRoute(31, () => jsonResponse({ message: '' }, { status: 403 })),
    );
    renderScreen(recorded.fetch, '/quality-approval?rq=31');
    const pane = screen.getByRole('region', { name: '요청 상세' });

    expect(await within(pane).findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(within(pane).queryByRole('button', { name: messages.common.retry })).toBeNull();
    expect(screen.getByRole('region', { name: t.panes.progress })).toHaveTextContent(
      t.progress.unavailable,
    );
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?rq=31');
    expect(recorded.urls.some((url) => url.pathname === CONCESSIONS_PATH)).toBe(false);
  });

  it('상세 404는 rq만 replace로 지우고 live 안내를 유지한다', async () => {
    renderScreen(
      approvalFetch([
        listRoute(),
        detailRoute(31, () => jsonResponse({ message: '' }, { status: 404 })),
      ]),
      '/quality-approval?rq=31&view=compact',
    );
    const missing = await screen.findByText('요청을 찾을 수 없습니다');

    await waitFor(() =>
      expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?view=compact'),
    );
    expect(screen.getByLabelText('주소 변경 방식')).toHaveTextContent('REPLACE');
    expect(missing.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('region', { name: t.panes.progress })).toHaveTextContent(
      t.detail.progressPending,
    );
  });

  it('상세 네트워크 오류는 오프라인 안내 후 재시도로 복구한다', async () => {
    let attempts = 0;
    const { user } = renderScreen(
      approvalFetch([
        listRoute(),
        detailRoute(31, () => {
          attempts += 1;
          if (attempts === 1) throw new TypeError('synthetic offline');
          return jsonResponse(detailBody());
        }),
      ]),
      '/quality-approval?rq=31',
    );
    const pane = screen.getByRole('region', { name: '요청 상세' });

    expect(await within(pane).findByText(messages.httpError.offline)).toBeInTheDocument();
    await user.click(await within(pane).findByRole('button', { name: messages.common.retry }));

    expect(await within(pane).findByRole('group', { name: '사유 전문' })).toHaveTextContent(
      '둘째 근거',
    );
    expect(attempts).toBe(2);
  });

  it('목록 실패와 독립적으로 deep-link 상세을 표시한다', async () => {
    renderScreen(
      approvalFetch([
        listRoute(() => jsonResponse({ message: '' }, { status: 500 })),
        detailRoute(),
      ]),
      '/quality-approval?rq=31',
    );

    expect(
      await within(screen.getByRole('region', { name: '요청 상세' })).findByRole('group', {
        name: '사유 전문',
      }),
    ).toHaveTextContent('둘째 근거');
    expect(
      within(screen.getByRole('region', { name: t.panes.list })).getByText(
        messages.httpError.loadTitle,
      ),
    ).toBeInTheDocument();
  });
});

describe('QualityApprovalScreen conditions', () => {
  it('후보 응답 대기 중 조건 로딩을 상세·진행과 독립된 status로 표시한다', async () => {
    const pending = new Promise<Response>(() => undefined);
    const base = approvalFetch([listRoute()]);
    const fetch: StubFetch = async (request) =>
      new URL(request.url).pathname === CONCESSIONS_PATH ? pending : base(request);
    renderScreen(fetch, '/quality-approval?rq=31');

    expect(await screen.findByRole('status', { name: t.condition.loading })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: t.panes.reason })).toBeInTheDocument();
    expect(screen.getByText('합성 결재자')).toBeInTheDocument();
  });

  it('승인 상세 200 뒤 후보를 정확히 조회하고 한 건일 때만 상세을 연다', async () => {
    const recorded = recordingFetch(
      listRoute(),
      candidateRoute(() => jsonResponse(candidateBody([concession]))),
      concessionRoute(),
    );
    renderScreen(recorded.fetch, '/quality-approval?rq=31');
    const pane = screen.getByRole('region', { name: t.panes.detail });

    expect(await within(pane).findByText('SYNTH-CN-501')).toBeInTheDocument();
    expect(within(pane).getByText('SYNTH-ACTIVE')).toBeInTheDocument();
    expect(within(pane).getByText(t.condition.unusable)).toBeInTheDocument();
    expect(within(pane).getByText('10')).toBeInTheDocument();
    expect(within(pane).getByText('2')).toBeInTheDocument();
    expect(within(pane).getByText('2026-08-22 – 2026-09-30')).toBeInTheDocument();
    expect(within(pane).getByText('합성 조건 비고')).toBeInTheDocument();
    expect(await within(pane).findByText('SYNTH-WO-1201')).toBeInTheDocument();
    expect(within(pane).getByText('합성 고객')).toBeInTheDocument();
    expect(within(pane).getAllByText(t.condition.reference.unknown)).toHaveLength(2);
    for (const internalId of ['901', '1201', '1301', '1401']) {
      expect(within(pane).queryByText(internalId)).toBeNull();
    }
    for (const hiddenCode of ['SYNTH-CUSTOMER-CODE', 'SYNTH-ERP-CUSTOMER']) {
      expect(within(pane).queryByText(hiddenCode)).toBeNull();
    }
    const candidateUrl = recorded.urls.find((url) => url.pathname === CONCESSIONS_PATH);
    expect(Object.fromEntries(candidateUrl?.searchParams ?? [])).toEqual({
      approvalRequestId: '31',
      page: '1',
      size: '2',
    });
    expect(recorded.urls.filter((url) => url.pathname === CONCESSIONS_PATH)).toHaveLength(1);
    expect(recorded.urls.filter((url) => url.pathname === concessionDetailPath(501))).toHaveLength(
      1,
    );
    expect(
      recorded.urls.filter((url) => url.pathname === workOrderReferencePath(1_201)),
    ).toHaveLength(1);
    expect(
      recorded.urls.filter((url) => url.pathname === customerReferencePath(1_401)),
    ).toHaveLength(1);
    expect(recorded.urls.findIndex((url) => url.pathname === requestDetailPath(31))).toBeLessThan(
      recorded.urls.findIndex((url) => url.pathname === CONCESSIONS_PATH),
    );
    expect(
      recorded.urls.findIndex((url) => url.pathname === concessionDetailPath(501)),
    ).toBeLessThan(
      recorded.urls.findIndex((url) => url.pathname === workOrderReferencePath(1_201)),
    );
    expect(
      recorded.urls.findIndex((url) => url.pathname === concessionDetailPath(501)),
    ).toBeLessThan(recorded.urls.findIndex((url) => url.pathname === customerReferencePath(1_401)));
  });

  it('exact 이름 조회 중에는 두 축을 loading으로 표시한다', async () => {
    const pending = new Promise<Response>(() => undefined);
    const base = approvalFetch([
      listRoute(),
      candidateRoute(() => jsonResponse(candidateBody([concession]))),
      concessionRoute(),
    ]);
    const fetch: StubFetch = async (request) =>
      [workOrderReferencePath(1_201), customerReferencePath(1_401)].includes(
        new URL(request.url).pathname,
      )
        ? pending
        : base(request);
    renderScreen(fetch, '/quality-approval?rq=31');

    const group = await screen.findByRole('group', { name: t.condition.title });
    expect(within(group).getAllByText(t.condition.reference.loading)).toHaveLength(2);
    expect(within(group).queryByText('SYNTH-WO-1201')).toBeNull();
  });

  it('exact 404·network 실패를 표시하고 한 번의 재시도로 둘 다 복구한다', async () => {
    let workOrderAttempts = 0;
    let customerAttempts = 0;
    const { user } = renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession]))),
        concessionRoute(),
        workOrderRoute(() => {
          workOrderAttempts += 1;
          return workOrderAttempts === 1
            ? jsonResponse({}, { status: 404 })
            : jsonResponse({ workOrderId: 1_201, workOrderNo: 'SYNTH-WO-1201' });
        }),
        customerRoute(() => {
          customerAttempts += 1;
          if (customerAttempts === 1) throw new TypeError('synthetic offline');
          return jsonResponse({ partnerId: 1_401, partnerName: '합성 고객' });
        }),
      ]),
      '/quality-approval?rq=31',
    );

    await waitFor(() => expect(screen.getAllByText(t.condition.reference.failed)).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    expect(await screen.findByText('SYNTH-WO-1201')).toBeInTheDocument();
    expect(screen.getByText('합성 고객')).toBeInTheDocument();
    expect([workOrderAttempts, customerAttempts]).toEqual([2, 2]);
  });

  it('exact 200의 공백 이름은 코드나 ID 대신 unknown으로 표시한다', async () => {
    renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession]))),
        concessionRoute(),
        workOrderRoute(() => jsonResponse({ workOrderId: 1_201, workOrderNo: '  ' })),
        customerRoute(() => jsonResponse({ partnerId: 1_401, partnerName: '' })),
      ]),
      '/quality-approval?rq=31',
    );

    const group = await screen.findByRole('group', { name: t.condition.title });
    await waitFor(() =>
      expect(within(group).getAllByText(t.condition.reference.unknown)).toHaveLength(4),
    );
    expect(within(group).queryByText('1201')).toBeNull();
    expect(within(group).queryByText('1401')).toBeNull();
  });

  it('0건은 live 정상 상태이고 개수 모순은 진행·상세와 독립된 오류다', async () => {
    const none = renderScreen(approvalFetch([listRoute()]), '/quality-approval?rq=31');
    const noneText = await screen.findByText(t.condition.none);
    expect(noneText.closest('[role="status"]')).not.toBeNull();
    none.unmount();

    renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession], 2))),
      ]),
      '/quality-approval?rq=31',
    );
    expect(await screen.findByText(t.condition.unsafe)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: t.panes.reason })).toBeInTheDocument();
    expect(screen.getByText('합성 결재자')).toBeInTheDocument();
  });

  it('후보 네트워크 오류는 오프라인 안내 뒤 재시도로 정상 빈 상태가 된다', async () => {
    let attempts = 0;
    const { user } = renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => {
          attempts += 1;
          if (attempts === 1) throw new TypeError('synthetic offline');
          return jsonResponse(candidateBody());
        }),
      ]),
      '/quality-approval?rq=31',
    );

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    expect(await screen.findByText(t.condition.none)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('조건 상세 404는 재시도할 수 있고 이전 선택의 조건을 다음 대기 중 숨긴다', async () => {
    let attempts = 0;
    const pending = new Promise<Response>(() => undefined);
    const next = { ...requests[0]!, approvalRequestId: 32, approvalRequestNo: 'SYNTH-REQ-032' };
    const base = approvalFetch([
      listRoute(() => jsonResponse(listBody([requests[0]!, next]))),
      candidateRoute(() => jsonResponse(candidateBody([concession]))),
      concessionRoute(() => {
        attempts += 1;
        return attempts === 1
          ? jsonResponse({ message: '' }, { status: 404 })
          : jsonResponse(concession);
      }),
    ]);
    const fetch: StubFetch = async (request) =>
      new URL(request.url).pathname === requestDetailPath(32) ? pending : base(request);
    const { user } = renderScreen(fetch, '/quality-approval?rq=31');

    await user.click(await screen.findByRole('button', { name: messages.common.retry }));
    expect(await screen.findByText('SYNTH-CN-501')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-032') }));
    expect(screen.getByRole('status', { name: t.detail.loading })).toBeInTheDocument();
    expect(screen.queryByText('SYNTH-CN-501')).toBeNull();
  });
});
