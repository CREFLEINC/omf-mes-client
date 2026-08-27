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
import { dispositionEntryPath } from '../disposition-decision/filters';
import { QualityApprovalScreen } from './screen';
import {
  concessionDetailPath,
  customerReferencePath,
  PROCESS_REFERENCE_PATH,
  qualityApprovalKeys,
  requestDetailPath,
  UOM_REFERENCE_PATH,
  workOrderReferencePath,
} from './queries';
import type { ApprovalRequest, ApprovalRequestDetail, Concession } from './types';

const t = messages.qualityApproval;
const PATH = '/app/approval-requests';
const CONCESSIONS_PATH = '/quality/concessions';
const APPROVE_PATH = '/app/approval-requests/31:approve';
const REJECT_PATH = '/app/approval-requests/31:reject';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
const nextApprovalRequest = {
  ...requests[0]!,
  approvalRequestId: 32,
  approvalRequestNo: 'SYNTH-REQ-032',
};

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
  nonconformanceNo: 'SYNTH-NC-701',
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

const listReferenceBody = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 20, total },
});

const uomRoute = (
  respond: StubRoute['respond'] = () =>
    jsonResponse(
      listReferenceBody([
        {
          uomId: 901,
          uomCode: 'SYNTH-EA',
          uomName: '합성 낱개',
          decimalScale: 0,
          isActive: true,
        },
      ]),
    ),
): StubRoute => ({
  match: (request) => new URL(request.url).pathname === UOM_REFERENCE_PATH,
  respond,
});

const processRoute = (
  respond: StubRoute['respond'] = () =>
    jsonResponse(
      listReferenceBody([
        {
          processId: 1_301,
          processCode: 'SYNTH-OP',
          processName: '합성 공정',
          processTypeCode: 'SYNTH-TYPE',
          isActive: true,
        },
      ]),
    ),
): StubRoute => ({
  match: (request) => new URL(request.url).pathname === PROCESS_REFERENCE_PATH,
  respond,
});

const approvalFetch = (routes: StubRoute[]): StubFetch =>
  createStubFetch([
    ...routes,
    detailRoute(),
    candidateRoute(),
    workOrderRoute(),
    customerRoute(),
    uomRoute(),
    processRoute(),
  ]);

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
  route = '/quality/approvals',
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
      '/quality/approvals?ty=UNCONFIRMED&st=UNKNOWN&q=SYNTH&page=2&approvalRequestId=31&view=compact',
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
    renderScreen(recorded.fetch, '/quality/approvals?ty=SYNTH-CONCESSION', ['SYNTH-CONCESSION']);

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

  it('적용은 page와 approvalRequestId를 비우고 무관 URL을 보존한 뒤 새 조건으로 조회한다', async () => {
    const recorded = recordingFetch(listRoute());
    const { user } = renderScreen(
      recorded.fetch,
      '/quality/approvals?page=3&approvalRequestId=31&view=compact',
    );

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

  it('행 선택은 approvalRequestId만 바꾸며 뒤로가기는 deep-link 선택을 복원한다', async () => {
    const { user } = renderScreen(approvalFetch([listRoute()]));

    await user.click(
      await screen.findByRole('button', { name: t.actions.selectRow('SYNTH-REQ-031') }),
    );
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?approvalRequestId=31');

    await user.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => expect(screen.getByLabelText('현재 주소')).toHaveTextContent(''));
  });

  it('범위 전환과 쪽 이동은 첫 쪽/다음 쪽으로 옮기며 선택을 비운다', async () => {
    const { user } = renderScreen(
      approvalFetch([listRoute(() => jsonResponse(listBody(requests, 40)))]),
      '/quality/approvals?page=2&approvalRequestId=31',
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
    const { user } = renderScreen(fetch, '/quality/approvals?approvalRequestId=31');

    await findRequest();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.selectRow('SYNTH-REQ-031') })).toBeNull();
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?page=2');
  });

  it('초기화는 소유한 조건·범위·쪽·선택만 기본으로 돌린다', async () => {
    const { user } = renderScreen(
      approvalFetch([listRoute()]),
      '/quality/approvals?q=SYNTH&page=3&approvalRequestId=31&pd=0&view=compact',
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
      '/quality/approvals?page=4&approvalRequestId=31',
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
    const { apiClient } = renderScreen(recorded.fetch, '/quality/approvals?approvalRequestId=31');
    const pane = screen.getByRole('region', { name: '요청 상세' });

    const reason = await within(pane).findByRole('group', { name: '사유 전문' });
    expect(reason).toHaveTextContent('둘째 근거');
    expect(reason.querySelectorAll('br')).toHaveLength(2);
    expect(within(pane).getByText('합성 대상')).toBeInTheDocument();
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
    const { user } = renderScreen(fetch, '/quality/approvals?approvalRequestId=31');
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
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?approvalRequestId=32');
  });

  it('상세 403은 선택을 유지하고 재시도를 주지 않는다', async () => {
    const recorded = recordingFetch(
      listRoute(),
      detailRoute(31, () => jsonResponse({ message: '' }, { status: 403 })),
    );
    renderScreen(recorded.fetch, '/quality/approvals?approvalRequestId=31');
    const pane = screen.getByRole('region', { name: '요청 상세' });

    expect(await within(pane).findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(within(pane).queryByRole('button', { name: messages.common.retry })).toBeNull();
    expect(screen.getByRole('region', { name: t.panes.progress })).toHaveTextContent(
      t.progress.unavailable,
    );
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?approvalRequestId=31');
    expect(recorded.urls.some((url) => url.pathname === CONCESSIONS_PATH)).toBe(false);
  });

  it('상세 404는 approvalRequestId만 replace로 지우고 live 안내를 유지한다', async () => {
    renderScreen(
      approvalFetch([
        listRoute(),
        detailRoute(31, () => jsonResponse({ message: '' }, { status: 404 })),
      ]),
      '/quality/approvals?approvalRequestId=31&view=compact',
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
      '/quality/approvals?approvalRequestId=31',
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
      '/quality/approvals?approvalRequestId=31',
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
    renderScreen(fetch, '/quality/approvals?approvalRequestId=31');

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
    renderScreen(recorded.fetch, '/quality/approvals?approvalRequestId=31');
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
    expect(within(pane).getByText('SYNTH-EA · 합성 낱개')).toBeInTheDocument();
    expect(within(pane).getByText('합성 공정')).toBeInTheDocument();
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
    expect(recorded.urls.filter((url) => url.pathname === UOM_REFERENCE_PATH)).toHaveLength(1);
    expect(recorded.urls.filter((url) => url.pathname === PROCESS_REFERENCE_PATH)).toHaveLength(1);
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
    expect(
      recorded.urls.findIndex((url) => url.pathname === concessionDetailPath(501)),
    ).toBeLessThan(recorded.urls.findIndex((url) => url.pathname === UOM_REFERENCE_PATH));
    expect(
      recorded.urls.findIndex((url) => url.pathname === concessionDetailPath(501)),
    ).toBeLessThan(recorded.urls.findIndex((url) => url.pathname === PROCESS_REFERENCE_PATH));
  });

  it('네 참조 이름 조회 중에는 각 축을 loading으로 표시한다', async () => {
    const pending = new Promise<Response>(() => undefined);
    const base = approvalFetch([
      listRoute(),
      candidateRoute(() => jsonResponse(candidateBody([concession]))),
      concessionRoute(),
    ]);
    const fetch: StubFetch = async (request) =>
      [
        workOrderReferencePath(1_201),
        customerReferencePath(1_401),
        UOM_REFERENCE_PATH,
        PROCESS_REFERENCE_PATH,
      ].includes(new URL(request.url).pathname)
        ? pending
        : base(request);
    renderScreen(fetch, '/quality/approvals?approvalRequestId=31');

    const group = await screen.findByRole('group', { name: t.condition.title });
    expect(within(group).getAllByText(t.condition.reference.loading)).toHaveLength(4);
    expect(within(group).queryByText('SYNTH-WO-1201')).toBeNull();
  });

  it('⭐ 특채면 「부적합 열기」가 처분 판정 화면의 진입 주소를 가리킨다', async () => {
    renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession]))),
        concessionRoute(),
      ]),
      '/quality/approvals?approvalRequestId=31',
    );

    const group = await screen.findByRole('group', { name: t.condition.title });
    const link = within(group).getByRole('link', { name: t.condition.openNonconformance });

    /* 주소는 가는 쪽 화면이 만든다 — 여기서 키 이름을 손으로 적지 않는다. */
    expect(link).toHaveAttribute('href', dispositionEntryPath(concession.nonconformanceId));
    expect(link).toHaveAttribute('href', expect.stringContaining('nonconformanceId=701'));
    /* ⭐ 어느 부적합인지 옆에 적는다 — 번호 없이 링크만 세우면 무엇을 여는지 모른다. */
    expect(within(group).getByText(t.condition.nonconformance)).toBeInTheDocument();
    expect(within(group).getByText('SYNTH-NC-701')).toBeInTheDocument();
  });

  it('부적합번호가 없으면 그 사실을 적고 이동은 그대로 연다 — 식별자는 따로 있다', async () => {
    renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession]))),
        concessionRoute(() => jsonResponse({ ...concession, nonconformanceNo: '  ' })),
      ]),
      '/quality/approvals?approvalRequestId=31',
    );

    const group = await screen.findByRole('group', { name: t.condition.title });

    expect(within(group).getByText(t.condition.nonconformanceNoUnknown)).toBeInTheDocument();
    expect(
      within(group).getByRole('link', { name: t.condition.openNonconformance }),
    ).toHaveAttribute('href', dispositionEntryPath(concession.nonconformanceId));
  });

  it('⛔ 연결 조건이 없으면 「부적합 열기」를 두지 않는다 — 갈 곳 없는 길을 만들지 않는다', async () => {
    renderScreen(
      approvalFetch([listRoute(), candidateRoute(() => jsonResponse(candidateBody([])))]),
      '/quality/approvals?approvalRequestId=31',
    );

    await screen.findByText(t.condition.none);
    expect(screen.queryByRole('link', { name: t.condition.openNonconformance })).toBeNull();
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
      '/quality/approvals?approvalRequestId=31',
    );

    await waitFor(() => expect(screen.getAllByText(t.condition.reference.failed)).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    expect(await screen.findByText('SYNTH-WO-1201')).toBeInTheDocument();
    expect(screen.getByText('합성 고객')).toBeInTheDocument();
    expect([workOrderAttempts, customerAttempts]).toEqual([2, 2]);
  });

  it('실패한 목록 lookup만 재시도하고 성공한 목록은 다시 부르지 않는다', async () => {
    let uomAttempts = 0;
    let processAttempts = 0;
    const { user } = renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession]))),
        concessionRoute(),
        uomRoute(() => {
          uomAttempts += 1;
          return jsonResponse(listReferenceBody([]));
        }),
        processRoute(() => {
          processAttempts += 1;
          return processAttempts === 1
            ? jsonResponse({}, { status: 500 })
            : jsonResponse(
                listReferenceBody([
                  { processId: 1_301, processCode: 'SYNTH-OP', processName: '합성 공정' },
                ]),
              );
        }),
      ]),
      '/quality/approvals?approvalRequestId=31',
    );

    await waitFor(() => expect(screen.getAllByText(t.condition.reference.failed)).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    expect(await screen.findByText('합성 공정')).toBeInTheDocument();
    expect([uomAttempts, processAttempts]).toEqual([1, 2]);
  });

  it('공정 조회 실패 뒤 제한 없는 조건으로 바꾸면 이전 오류와 재시도를 숨긴다', async () => {
    const nextRequest: ApprovalRequest = {
      ...requests[0]!,
      approvalRequestId: 32,
      approvalRequestNo: 'SYNTH-REQ-032',
    };
    const nextConcession: Concession = {
      ...concession,
      concessionId: 502,
      approvalRequestId: 32,
      allowedProcessId: undefined,
    };
    let candidateAttempts = 0;
    let processAttempts = 0;
    const recorded = recordingFetch(
      listRoute(() => jsonResponse(listBody([...requests, nextRequest]))),
      detailRoute(32, () => jsonResponse(detailBody(nextRequest))),
      candidateRoute(() => {
        candidateAttempts += 1;
        return jsonResponse(
          candidateBody(candidateAttempts === 1 ? [concession] : [nextConcession]),
        );
      }),
      concessionRoute(),
      {
        match: (request) => new URL(request.url).pathname === concessionDetailPath(502),
        respond: () => jsonResponse(nextConcession),
      },
      processRoute(() => {
        processAttempts += 1;
        return jsonResponse({}, { status: 500 });
      }),
    );
    const { user } = renderScreen(recorded.fetch, '/quality/approvals?approvalRequestId=31');

    await waitFor(() => expect(candidateAttempts).toBe(1));
    await waitFor(() => expect(processAttempts).toBe(1));
    const firstGroup = await screen.findByRole('group', { name: t.condition.title });
    await waitFor(() =>
      expect(within(firstGroup).getAllByText(t.condition.reference.failed)).toHaveLength(2),
    );
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-032') }));

    const group = await screen.findByRole('group', { name: t.condition.title });
    await waitFor(() => expect(within(group).getByText(t.condition.unrestricted)).toBeVisible());
    expect(within(group).queryByText(t.condition.reference.failed)).toBeNull();
    expect(within(group).queryByRole('button', { name: messages.common.retry })).toBeNull();
    expect(processAttempts).toBe(1);
    expect(recorded.urls.filter((url) => url.pathname === PROCESS_REFERENCE_PATH)).toHaveLength(1);
  });

  it('exact 200의 공백 이름은 코드나 ID 대신 unknown으로 표시한다', async () => {
    renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession]))),
        concessionRoute(),
        workOrderRoute(() => jsonResponse({ workOrderId: 1_201, workOrderNo: '  ' })),
        customerRoute(() => jsonResponse({ partnerId: 1_401, partnerName: '' })),
        uomRoute(() =>
          jsonResponse(listReferenceBody([{ uomId: 901, uomCode: ' ', uomName: '' }])),
        ),
        processRoute(() =>
          jsonResponse(listReferenceBody([{ processId: 1_301, processName: '  ' }])),
        ),
      ]),
      '/quality/approvals?approvalRequestId=31',
    );

    const group = await screen.findByRole('group', { name: t.condition.title });
    await waitFor(() =>
      expect(within(group).getAllByText(t.condition.reference.unknown)).toHaveLength(4),
    );
    expect(within(group).queryByText('1201')).toBeNull();
    expect(within(group).queryByText('1401')).toBeNull();
  });

  it('잘린 목록은 대상 발견 여부에 따라 named와 truncated로 나눈다', async () => {
    renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession]))),
        concessionRoute(),
        uomRoute(() => jsonResponse(listReferenceBody([], 2))),
        processRoute(() =>
          jsonResponse(
            listReferenceBody([{ processId: 1_301, processName: '합성 공정 발견값' }], 2),
          ),
        ),
      ]),
      '/quality/approvals?approvalRequestId=31',
    );

    const group = await screen.findByRole('group', { name: t.condition.title });
    expect(await within(group).findByText('합성 공정 발견값')).toBeInTheDocument();
    expect(within(group).getByText(t.condition.reference.truncated)).toBeInTheDocument();
    expect(within(group).queryByText('901')).toBeNull();
  });

  it('0건은 live 정상 상태이고 개수 모순은 진행·상세와 독립된 오류다', async () => {
    const none = renderScreen(
      approvalFetch([listRoute()]),
      '/quality/approvals?approvalRequestId=31',
    );
    const noneText = await screen.findByText(t.condition.none);
    expect(noneText.closest('[role="status"]')).not.toBeNull();
    none.unmount();

    renderScreen(
      approvalFetch([
        listRoute(),
        candidateRoute(() => jsonResponse(candidateBody([concession], 2))),
      ]),
      '/quality/approvals?approvalRequestId=31',
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
      '/quality/approvals?approvalRequestId=31',
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
    const { user } = renderScreen(fetch, '/quality/approvals?approvalRequestId=31');

    await user.click(await screen.findByRole('button', { name: messages.common.retry }));
    expect(await screen.findByText('SYNTH-CN-501')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-032') }));
    expect(screen.getByRole('status', { name: t.detail.loading })).toBeInTheDocument();
    expect(screen.queryByText('SYNTH-CN-501')).toBeNull();
  });
});

describe('QualityApprovalScreen decision action', () => {
  const actionDetail = (request: ApprovalRequest = requests[0]!): ApprovalRequestDetail =>
    detailBody(request);
  const safeConditionRoutes = (shouldFail: () => boolean = () => false): StubRoute[] => [
    candidateRoute(() =>
      shouldFail() ? jsonResponse({}, { status: 500 }) : jsonResponse(candidateBody([concession])),
    ),
    concessionRoute(),
  ];

  const openConfirm = async (
    user: ReturnType<typeof userEvent.setup>,
    comment: string,
    action: '승인' | '반려' = '승인',
  ) => {
    const input = await screen.findByRole('textbox', { name: '결재 사유' });
    await user.type(input, comment);
    await user.click(screen.getByRole('button', { name: action }));
    return screen.findByRole('dialog', { name: `${action} 확인` });
  };
  const confirmDecision = async (
    user: ReturnType<typeof userEvent.setup>,
    comment: string,
    action: '승인' | '반려' = '승인',
  ) => {
    const dialog = await openConfirm(user, comment, action);
    await user.click(within(dialog).getByRole('button', { name: action }));
  };
  const confirmApproval = (user: ReturnType<typeof userEvent.setup>, comment: string) =>
    confirmDecision(user, comment);
  const requestButton = (requestNo: string) =>
    screen.getByRole('button', { name: t.actions.selectRow(requestNo) });
  const reloadTargetButton = () => screen.findByRole('button', { name: t.approval.reloadTarget });

  it('선택 없음·내 차례 아님·안전한 연결 조건 없음·공백 사유에서는 보내지 않는다', async () => {
    const noSelection = renderScreen(approvalFetch([listRoute()]));
    await findRequest();
    expect(screen.queryByRole('textbox', { name: '결재 사유' })).toBeNull();
    noSelection.unmount();

    const noTurnRequest = { ...requests[0]!, isMyTurn: false };
    const recorded = recordingFetch(
      listRoute(),
      detailRoute(31, () =>
        jsonResponse(actionDetail(noTurnRequest), { headers: { ETag: '"9"' } }),
      ),
    );
    const locked = renderScreen(recorded.fetch, '/quality/approvals?approvalRequestId=31');
    const input = await screen.findByRole('textbox', { name: '결재 사유' });
    expect(input).toHaveAccessibleDescription(/승인 또는 반려 판단 근거를 입력하세요/);
    expect(input).toBeDisabled();
    expect(input).toHaveAccessibleDescription(/지금은 내 결재 차례가 아닙니다/);
    expect(screen.getByRole('button', { name: '승인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '반려' })).toBeDisabled();
    expect(recorded.urls.some((url) => url.pathname.endsWith(':approve'))).toBe(false);
    locked.unmount();

    const unsafe = renderScreen(
      approvalFetch([listRoute(), detailRoute()]),
      '/quality/approvals?approvalRequestId=31',
    );
    expect(await screen.findByRole('textbox', { name: '결재 사유' })).toHaveAccessibleDescription(
      /안전하게 확인된 연결 조건 1건이 필요합니다/,
    );
    expect(screen.getByRole('button', { name: '승인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '반려' })).toBeDisabled();
    unsafe.unmount();

    const blank = recordingFetch(
      listRoute(),
      detailRoute(31, () => jsonResponse(actionDetail(), { headers: { ETag: '"9"' } })),
      ...safeConditionRoutes(),
    );
    const blankScreen = renderScreen(blank.fetch, '/quality/approvals?approvalRequestId=31');
    await blankScreen.user.type(await screen.findByRole('textbox', { name: '결재 사유' }), '   ');
    await blankScreen.user.click(screen.getByRole('button', { name: '승인' }));
    expect(screen.getByText('승인 사유를 입력하세요')).toBeInTheDocument();
    await blankScreen.user.click(screen.getByRole('button', { name: '반려' }));
    expect(screen.getByText('반려 사유를 입력하세요')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(blank.urls.some((url) => url.pathname.endsWith(':approve'))).toBe(false);
  });

  it('반려 확인 뒤 trim 본문·UUID·상세 ETag로 한 번 보내고 응답을 반영한다', async () => {
    let serverDetail = actionDetail();
    let releaseReject: ((response: Response) => void) | undefined;
    const pendingReject = new Promise<Response>((resolve) => {
      releaseReject = resolve;
    });
    const sent: Request[] = [];
    const base = approvalFetch([
      listRoute(),
      detailRoute(31, () => jsonResponse(serverDetail, { headers: { ETag: '"9"' } })),
      ...safeConditionRoutes(),
    ]);
    const fetch: StubFetch = async (request) => {
      if (new URL(request.url).pathname !== REJECT_PATH) return base(request);
      sent.push(request.clone());
      return pendingReject;
    };
    const { queryClient, user } = renderScreen(fetch, '/quality/approvals?approvalRequestId=31');

    const dialog = await openConfirm(user, '  합성 반려 사유  ', '반려');
    expect(within(dialog).getByText('요청번호: SYNTH-REQ-031')).toBeInTheDocument();
    expect(within(dialog).getByText('승인 유형: SYNTH-CONCESSION')).toBeInTheDocument();
    expect(within(dialog).getByText('대상: 합성 대상')).toBeInTheDocument();
    expect(within(dialog).getByText('합성 반려 사유')).toBeInTheDocument();
    expect(within(dialog).getByText('반려는 상태만 변경합니다')).toBeInTheDocument();
    expect(within(dialog).getByText('반려는 되돌릴 수 없습니다')).toBeInTheDocument();
    expect(dialog.textContent).not.toContain('910009');
    expect(sent).toHaveLength(0);
    expect(within(dialog).queryByRole('button', { name: '닫기' })).toBeNull();
    await user.click(dialog);
    expect(screen.getByRole('dialog', { name: '반려 확인' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '반려' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(within(dialog).getByRole('button', { name: '반려' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: messages.common.cancel })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: '반려' }));
    expect(sent).toHaveLength(1);
    expect(await sent[0]!.clone().json()).toEqual({ comment: '합성 반려 사유' });
    expect(sent[0]!.headers.get('If-Match')).toBe('"9"');
    expect(sent[0]!.headers.get('Idempotency-Key')).toMatch(UUID_V4);

    serverDetail = actionDetail({ ...requests[0]!, isMyTurn: false, statusCode: 'REJECTED' });
    releaseReject?.(jsonResponse(serverDetail));
    expect(await screen.findByText('반려가 완료되었습니다')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      queryClient.getQueryData<ApprovalRequestDetail>(qualityApprovalKeys.detail(31))?.request
        .statusCode,
    ).toBe('REJECTED');
  });

  it('확인 전에는 보내지 않고 trim 본문·UUID·상세 ETag로 한 번 승인한 뒤 응답을 반영한다', async () => {
    let detailCalls = 0;
    let listCalls = 0;
    let failConditions = false;
    let releaseApprove: ((response: Response) => void) | undefined;
    const pendingApprove = new Promise<Response>((resolve) => {
      releaseApprove = resolve;
    });
    const pendingDetail = new Promise<Response>(() => undefined);
    const sent: Request[] = [];
    const base = approvalFetch([
      listRoute(() => {
        listCalls += 1;
        return jsonResponse(listBody([requests[0]!, nextApprovalRequest]));
      }),
      detailRoute(31, () => {
        detailCalls += 1;
        return jsonResponse(actionDetail(), { headers: { ETag: '"9"' } });
      }),
      detailRoute(32, () =>
        jsonResponse(actionDetail(nextApprovalRequest), { headers: { ETag: '"10"' } }),
      ),
      ...safeConditionRoutes(() => failConditions),
    ]);
    const fetch: StubFetch = async (request) => {
      const path = new URL(request.url).pathname;
      if (path === APPROVE_PATH) {
        sent.push(request.clone());
        return pendingApprove;
      }
      if (path === requestDetailPath(31) && detailCalls > 0) return pendingDetail;
      return base(request);
    };
    const { queryClient, user } = renderScreen(fetch, '/quality/approvals?approvalRequestId=31');

    const dialog = await openConfirm(user, '  합성 승인 사유  ');
    expect(within(dialog).getByText('요청번호: SYNTH-REQ-031')).toBeInTheDocument();
    expect(within(dialog).getByText('승인 유형: SYNTH-CONCESSION')).toBeInTheDocument();
    expect(within(dialog).getByText('대상: 합성 대상')).toBeInTheDocument();
    expect(within(dialog).getByText('합성 승인 사유')).toBeInTheDocument();
    expect(within(dialog).getByText('승인은 되돌릴 수 없습니다')).toBeInTheDocument();
    expect(within(dialog).getByText('승인은 상태만 해제합니다')).toBeInTheDocument();
    expect(sent).toHaveLength(0);
    expect(within(dialog).queryByRole('button', { name: '닫기' })).toBeNull();
    await user.click(dialog);
    expect(screen.getByRole('dialog', { name: '승인 확인' })).toBeInTheDocument();

    failConditions = true;
    await queryClient.invalidateQueries({ queryKey: qualityApprovalKeys.candidates(31) });
    await waitFor(() => expect(screen.getByRole('textbox', { name: '결재 사유' })).toBeDisabled());
    await user.click(within(dialog).getByRole('button', { name: '승인' }));
    expect(sent).toHaveLength(0);
    failConditions = false;
    await queryClient.invalidateQueries({ queryKey: qualityApprovalKeys.candidates(31) });
    await waitFor(() => expect(screen.getByRole('textbox', { name: '결재 사유' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '승인' }));
    const retryDialog = await screen.findByRole('dialog', { name: '승인 확인' });
    await user.click(within(retryDialog).getByRole('button', { name: '승인' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(within(retryDialog).getByRole('button', { name: '승인' })).toBeDisabled();
    expect(
      within(retryDialog).getByRole('button', { name: messages.common.cancel }),
    ).toBeDisabled();
    expect(await sent[0]!.clone().json()).toEqual({ comment: '합성 승인 사유' });
    expect(sent[0]!.headers.get('If-Match')).toBe('"9"');
    expect(sent[0]!.headers.get('Idempotency-Key')).toMatch(UUID_V4);
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-032') }));
    expect(await screen.findByText('SYNTH-REQ-032')).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: '결재 사유' })).toHaveAccessibleDescription(
      /결재 요청을 처리하는 중입니다/,
    );

    releaseApprove?.(
      jsonResponse(
        actionDetail({ ...requests[0]!, isMyTurn: false, statusCode: 'SYNTH-APPROVED' }),
      ),
    );
    expect(await screen.findByText('승인이 완료되었습니다')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: '결재 사유' })).toHaveValue('');
    expect(screen.queryByText('SYNTH-APPROVED')).toBeNull();
    expect(
      queryClient.getQueryData<ApprovalRequestDetail>(qualityApprovalKeys.detail(31))?.request
        .statusCode,
    ).toBe('SYNTH-APPROVED');
    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
  });

  it('상세 ETag가 없으면 POST 없이 최신 정보 오류를 표시한다', async () => {
    const recorded = recordingFetch(listRoute(), detailRoute(), ...safeConditionRoutes());
    const first = renderScreen(recorded.fetch, '/quality/approvals?approvalRequestId=31');
    await confirmApproval(first.user, '합성 승인 사유');
    expect(await screen.findByText(messages.save.staleToken)).toBeInTheDocument();
    expect(recorded.urls.some((url) => url.pathname.endsWith(':approve'))).toBe(false);
    first.unmount();

    const rejected = recordingFetch(listRoute(), detailRoute(), ...safeConditionRoutes());
    const second = renderScreen(rejected.fetch, '/quality/approvals?approvalRequestId=31');
    await confirmDecision(second.user, '합성 반려 사유', '반려');
    expect(await screen.findByText(messages.save.staleToken)).toBeInTheDocument();
    expect(rejected.urls.some((url) => url.pathname.endsWith(':reject'))).toBe(false);
  });

  it('409는 최신 상세 재조회로 복구하고 400·403·network 오류를 각각 표시한다', async () => {
    let detailCalls = 0;
    const conflict = recordingFetch(
      listRoute(),
      detailRoute(31, () => {
        detailCalls += 1;
        return jsonResponse(actionDetail(), { headers: { ETag: `"${String(detailCalls)}"` } });
      }),
      ...safeConditionRoutes(),
      {
        match: (request) => new URL(request.url).pathname === REJECT_PATH,
        respond: () => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
      },
    );
    const first = renderScreen(conflict.fetch, '/quality/approvals?approvalRequestId=31');
    await confirmDecision(first.user, '합성 반려 사유', '반려');
    await first.user.click(
      await screen.findByRole('button', { name: messages.conflict.reloadAction }),
    );
    await waitFor(() => expect(detailCalls).toBe(2));
    first.unmount();

    for (const failure of [
      {
        response: jsonResponse(
          {
            errors: [
              { scope: 'field', field: 'comment', code: 'INVALID', message: '합성 사유 오류' },
            ],
          },
          { status: 400 },
        ),
        message: '합성 사유 오류',
        action: '반려' as const,
        path: REJECT_PATH,
      },
      {
        response: jsonResponse({}, { status: 403 }),
        message: messages.httpError.forbidden,
        action: '승인' as const,
        path: APPROVE_PATH,
      },
      {
        response: jsonResponse({}, { status: 404 }),
        message: messages.httpError.description,
        action: '반려' as const,
        path: REJECT_PATH,
      },
    ]) {
      const recorded = recordingFetch(
        listRoute(),
        detailRoute(31, () => jsonResponse(actionDetail(), { headers: { ETag: '"9"' } })),
        ...safeConditionRoutes(),
        {
          match: (request) => new URL(request.url).pathname === failure.path,
          respond: () => failure.response,
        },
      );
      const rendered = renderScreen(recorded.fetch, '/quality/approvals?approvalRequestId=31');
      await confirmDecision(rendered.user, '합성 결재 사유', failure.action);
      expect(await screen.findByText(failure.message)).toBeInTheDocument();
      rendered.unmount();
    }

    let approvalAttempts = 0;
    let failDetailReload = false;
    let failOtherDetail = true;
    const sent: Request[] = [];
    const base = approvalFetch([
      listRoute(() => jsonResponse(listBody([requests[0]!, nextApprovalRequest]))),
      detailRoute(31, () => {
        detailCalls += 1;
        return failDetailReload
          ? jsonResponse({}, { status: 500 })
          : jsonResponse(actionDetail(), { headers: { ETag: '"9"' } });
      }),
      detailRoute(32, () =>
        failOtherDetail
          ? jsonResponse({}, { status: 500 })
          : jsonResponse(actionDetail(nextApprovalRequest), { headers: { ETag: '"10"' } }),
      ),
      candidateRoute((request) => {
        const approvalRequestId = Number(
          new URL(request.url).searchParams.get('approvalRequestId'),
        );
        return jsonResponse(candidateBody([{ ...concession, approvalRequestId }]));
      }),
      concessionRoute(),
    ]);
    const offline: StubFetch = async (request) => {
      if (new URL(request.url).pathname === APPROVE_PATH) {
        approvalAttempts += 1;
        sent.push(request.clone());
        if (approvalAttempts === 1) throw new TypeError('synthetic offline');
        return jsonResponse(actionDetail({ ...requests[0]!, isMyTurn: false }));
      }
      return base(request);
    };
    const rendered = renderScreen(offline, '/quality/approvals?approvalRequestId=31');
    await confirmApproval(rendered.user, '합성 승인 사유');
    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByText('서버 적용 여부를 확인할 수 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '반려' })).toBeDisabled();
    let beforeReload = detailCalls;
    failDetailReload = true;
    await rendered.user.click(await reloadTargetButton());
    await waitFor(() => expect(detailCalls).toBeGreaterThan(beforeReload));
    failDetailReload = false;
    await rendered.user.click(requestButton('SYNTH-REQ-032'));
    expect(await screen.findByText(messages.httpError.description)).toBeInTheDocument();
    failOtherDetail = false;
    await rendered.user.click(screen.getByRole('button', { name: messages.common.retry }));
    expect(await screen.findByRole('textbox', { name: '결재 사유' })).toHaveAccessibleDescription(
      /앞서 보낸 승인 요청의 상태를 먼저 확인해야 합니다/,
    );
    const blockedApprove = screen.getByRole('button', { name: '승인' });
    const blockedReject = screen.getByRole('button', { name: '반려' });
    expect(blockedApprove).toBeDisabled();
    expect(blockedReject).toBeDisabled();
    await rendered.user.click(blockedApprove);
    await rendered.user.click(blockedReject);
    expect(sent).toHaveLength(1);
    await rendered.user.click(await requestButton('SYNTH-REQ-031'));
    beforeReload = detailCalls;
    await rendered.user.click(await reloadTargetButton());
    await waitFor(() => expect(detailCalls).toBeGreaterThan(beforeReload));
    await confirmApproval(rendered.user, '합성 승인 사유');
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.headers.get('Idempotency-Key')).toBe(sent[0]!.headers.get('Idempotency-Key'));
  });

  it('반려 적용불명은 원 대상도 잠그고 재조회 성공 뒤 같은 반려만 같은 UUID로 재시도한다', async () => {
    let rejectAttempts = 0;
    let detailFails = false;
    const sent: Request[] = [];
    const base = approvalFetch([
      listRoute(),
      detailRoute(31, () =>
        detailFails
          ? jsonResponse({}, { status: 500 })
          : jsonResponse(actionDetail(), { headers: { ETag: '"9"' } }),
      ),
      ...safeConditionRoutes(),
    ]);
    const fetch: StubFetch = async (request) => {
      if (new URL(request.url).pathname !== REJECT_PATH) return base(request);
      rejectAttempts += 1;
      sent.push(request.clone());
      if (rejectAttempts === 1) throw new TypeError('synthetic offline');
      return jsonResponse(actionDetail({ ...requests[0]!, isMyTurn: false }));
    };
    const { user } = renderScreen(fetch, '/quality/approvals?approvalRequestId=31');

    await confirmDecision(user, '합성 반려 사유', '반려');
    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '승인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '반려' })).toBeDisabled();
    detailFails = true;
    await user.click(await reloadTargetButton());
    expect(await screen.findByText(messages.httpError.description)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '승인' })).toBeNull();
    expect(screen.queryByRole('button', { name: '반려' })).toBeNull();
    expect(sent).toHaveLength(1);
    detailFails = false;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));
    await waitFor(() => expect(screen.getByRole('button', { name: '반려' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '반려' }));
    const dialog = await screen.findByRole('dialog', { name: '반려 확인' });
    await user.click(within(dialog).getByRole('button', { name: '반려' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.headers.get('Idempotency-Key')).toBe(sent[0]!.headers.get('Idempotency-Key'));
  });

  it('알려진 실패 뒤 같은 대상·사유라도 승인과 반려는 다른 UUID를 사용한다', async () => {
    const sent: Request[] = [];
    const base = approvalFetch([
      listRoute(),
      detailRoute(31, () => jsonResponse(actionDetail(), { headers: { ETag: '"9"' } })),
      ...safeConditionRoutes(),
    ]);
    const fetch: StubFetch = async (request) => {
      const path = new URL(request.url).pathname;
      if (path !== APPROVE_PATH && path !== REJECT_PATH) return base(request);
      sent.push(request.clone());
      return path === APPROVE_PATH
        ? jsonResponse({}, { status: 403 })
        : jsonResponse(actionDetail({ ...requests[0]!, isMyTurn: false }));
    };
    const { user } = renderScreen(fetch, '/quality/approvals?approvalRequestId=31');

    await confirmApproval(user, '합성 공통 사유');
    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '반려' }));
    const dialog = await screen.findByRole('dialog', { name: '반려 확인' });
    await user.click(within(dialog).getByRole('button', { name: '반려' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.headers.get('Idempotency-Key')).not.toBe(
      sent[0]!.headers.get('Idempotency-Key'),
    );
  });
});
