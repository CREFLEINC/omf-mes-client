import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { QualityApprovalScreen } from './screen';
import type { ApprovalRequest } from './types';

const t = messages.qualityApproval;
const PATH = '/app/approval-requests';

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

const recordingFetch = (route: StubRoute): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch([route]);

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
  const [, setSearchParams] = useSearchParams();

  return (
    <>
      <output aria-label="현재 주소">{location.search}</output>
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
    expect(recorded.urls).toHaveLength(1);
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
    const { user } = renderScreen(createStubFetch([listRoute()]));

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
    const { user } = renderScreen(createStubFetch([listRoute()]));

    await user.click(
      await screen.findByRole('button', { name: t.actions.selectRow('SYNTH-REQ-031') }),
    );
    expect(screen.getByLabelText('현재 주소')).toHaveTextContent('?rq=31');

    await user.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => expect(screen.getByLabelText('현재 주소')).toHaveTextContent(''));
  });

  it('범위 전환과 쪽 이동은 첫 쪽/다음 쪽으로 옮기며 선택을 비운다', async () => {
    const { user } = renderScreen(
      createStubFetch([listRoute(() => jsonResponse(listBody(requests, 40)))]),
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
      createStubFetch([listRoute()]),
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
    renderScreen(createStubFetch([listRoute(() => jsonResponse(listBody([], 0)))]));

    expect(await screen.findByText(t.empty.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('범위 밖 주소의 첫 쪽 복구는 page와 선택을 비운다', async () => {
    const { user } = renderScreen(
      createStubFetch([listRoute(() => jsonResponse(listBody([], 1, 4)))]),
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
    renderScreen(
      createStubFetch([listRoute(() => jsonResponse({ message: '' }, { status: 403 }))]),
    );

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('기타 오류는 재시도로 복구한다', async () => {
    let attempts = 0;
    const { user } = renderScreen(
      createStubFetch([
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
