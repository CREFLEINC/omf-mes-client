import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { dispositionEntryPath } from '../disposition-decision/filters';
import { requestedPaths, requestsSent, requestStub, type RequestStubOptions } from './fixtures';
import { DispositionRequestScreen } from './screen';

const t = messages.dispositionRequest;

const renderScreen = (
  options: RequestStubOptions & { route?: string } = {},
): { user: ReturnType<typeof userEvent.setup> } => {
  renderWithProviders(<DispositionRequestScreen />, {
    fetch: requestStub(options),
    route: options.route ?? '/shipment/disposition-requests',
  });

  return { user: userEvent.setup() };
};

const selectRow = async (
  user: ReturnType<typeof userEvent.setup>,
  lotNo = 'LOT-TEST-0311',
): Promise<void> => {
  await user.click(await screen.findByRole('button', { name: t.actions.selectRow(lotNo) }));
};

const registerPane = () => within(screen.getByRole('group', { name: t.panes.register }));
const requestPane = () => within(screen.getByRole('group', { name: t.panes.request }));
const resultPane = () => within(screen.getByRole('group', { name: t.panes.result }));

describe('DispositionRequestScreen — 진입 목록', () => {
  it('구획 넷과 소관 안내가 서고, 판정 버튼은 없다', async () => {
    renderScreen();

    expect(await screen.findByRole('heading', { name: t.panes.list })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.panes.register })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.panes.request })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.panes.result })).toBeInTheDocument();
    /* §5-1 — 이 화면이 «하지 않는 것»을 상단에 상시 적는다. */
    expect(screen.getByText(t.scopeNotice)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '판정' })).not.toBeInTheDocument();
  });

  it('판정 대상 목록을 부르고 배지를 보인다', async () => {
    renderScreen({ allCandidates: true });

    expect(
      await screen.findByRole('button', { name: t.actions.selectRow('LOT-TEST-0311') }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.values.stage.NONE)).toBeInTheDocument();
    expect(screen.getByText(t.values.stage.NOT_REQUESTED)).toBeInTheDocument();
    expect(screen.getByText(t.values.stage.DECIDED)).toBeInTheDocument();
    expect(
      requestedPaths().some((path) => path.startsWith('/quality/disposition-candidates')),
    ).toBe(true);
  });

  /* ⭐ 「부적합 없음」은 서버 축이다 — 화면이 응답을 걸러 대신하지 않는다. */
  it('상태 「부적합 없음」은 서버 축으로 실린다', async () => {
    const { user } = renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('LOT-TEST-0311') });

    await user.click(screen.getByLabelText(t.fields.stage));
    await user.click(screen.getByRole('option', { name: t.values.stage.NONE }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestedPaths().some((path) => path.includes('withoutNonconformanceOnly=true'))).toBe(
        true,
      );
    });
  });

  /* 부적합 상태 셋은 부적합 목록에서 온다(요구서 §3-7 둘째 행) — 소스가 바뀐다. */
  it('상태 「판정 대기」를 고르면 부적합 목록으로 소스가 바뀐다', async () => {
    const { user } = renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('LOT-TEST-0311') });

    await user.click(screen.getByLabelText(t.fields.stage));
    await user.click(screen.getByRole('option', { name: t.values.stage.PENDING_DECISION }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(
        requestedPaths().some((path) =>
          path.startsWith('/quality/nonconformances?statusCode=PENDING_DECISION'),
        ),
      ).toBe(true);
    });
  });

  it('목록 조회가 실패하면 다시 시도할 수 있다', async () => {
    renderScreen({ listStatus: 500 });

    expect(await screen.findByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });
});

describe('DispositionRequestScreen — 선택한 대상', () => {
  it('행을 고르면 머리에 LOT·원천·입고 정보가 서고 원천은 묻지 않는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);

    const target = within(screen.getByRole('region', { name: t.panes.target }));
    expect(target.getByText('LOT-TEST-0311')).toBeInTheDocument();
    expect(target.getByText(/RT-TEST-0044/)).toBeInTheDocument();
    expect(target.getByText(/합성 거래처/)).toBeInTheDocument();
    expect(target.getByText(t.register.sourceDerived)).toBeInTheDocument();
    /* 원천 입력 위젯을 그리지 않는다(§5-1-1 ⓓ). */
    expect(target.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('⭐ 주소로 LOT 을 지목하면 그 대상이 자동으로 골라진다', async () => {
    renderScreen({ route: '/shipment/disposition-requests?lot=8201' });

    const target = within(await screen.findByRole('region', { name: t.panes.target }));
    expect(await target.findByText('LOT-TEST-0311')).toBeInTheDocument();
  });
});

describe('DispositionRequestScreen — ① 부적합 등록', () => {
  it('대상을 고르기 전에는 사유와 함께 잠긴다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('LOT-TEST-0311') });

    const button = registerPane().getByRole('button', { name: t.actions.register });
    expect(button).toBeDisabled();
    expect(registerPane().getByText(t.register.lock.noTarget)).toBeInTheDocument();
  });

  /* G-2 — 심각도 선택지가 비면 지어내지 않고 저장도 같은 사유로 잠근다. */
  it('심각도 기준값이 비면 등록을 잠근다', async () => {
    const { user } = renderScreen({ emptySeverity: true });
    await selectRow(user);

    await waitFor(() => {
      expect(registerPane().getByText(t.register.lock.severityPending)).toBeInTheDocument();
    });
    expect(registerPane().getByRole('button', { name: t.actions.register })).toBeDisabled();
  });

  it('이미 부적합이 있는 대상은 번호를 들어 잠근다', async () => {
    const { user } = renderScreen({ allCandidates: true });
    await selectRow(user, 'LOT-TEST-0305');

    expect(
      await registerPane().findByText(t.register.lock.alreadyRegistered('NC-TEST-0001')),
    ).toBeInTheDocument();
  });

  it('내용이 비면 필수 오류를 내고 보내지 않는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await waitFor(() => {
      expect(registerPane().getByRole('button', { name: t.actions.register })).toBeEnabled();
    });

    await user.click(registerPane().getByRole('button', { name: t.actions.register }));

    expect(registerPane().getByText(t.register.descriptionRequired)).toBeInTheDocument();
    expect(
      requestsSent().some(
        (request) =>
          request.method === 'POST' && new URL(request.url).pathname === '/quality/nonconformances',
      ),
    ).toBe(false);
  });

  it('⭐ 등록은 멱등 키와 함께 LOT 전량을 싣고, 성공하면 의뢰가 열린다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await waitFor(() => {
      expect(registerPane().getByRole('button', { name: t.actions.register })).toBeEnabled();
    });

    await user.click(registerPane().getByLabelText(t.register.severityLabel));
    await user.click(screen.getByRole('option', { name: '중' }));
    await user.type(
      registerPane().getByLabelText(new RegExp(t.register.descriptionLabel)),
      '외관 스크래치 · 상단 모서리 · 200개 중 40개 육안 확인',
    );
    await user.click(registerPane().getByRole('button', { name: t.actions.register }));

    expect(await screen.findByText(t.register.success)).toBeInTheDocument();

    const post = requestsSent().find(
      (request) =>
        request.method === 'POST' && new URL(request.url).pathname === '/quality/nonconformances',
    );
    expect(post).toBeDefined();
    expect(post?.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    /* 원천은 싣지 않는다 — 서버가 입고 유형으로 정한다. */
    await expect(post?.json()).resolves.toEqual({
      itemId: 2003,
      severityCode: 'MAJOR',
      description: '외관 스크래치 · 상단 모서리 · 200개 중 40개 육안 확인',
      lots: [{ lotId: 8201, affectedQty: 200, uomId: 7001 }],
    });

    /* 등록 뒤 상세(잠금 토큰)가 서고 ②가 열린다 — 의뢰 수량은 전량이 기본이다. */
    await waitFor(() => {
      expect(requestPane().getByRole('button', { name: t.actions.request })).toBeEnabled();
    });
    expect(requestPane().getByLabelText(new RegExp(t.request.qtyLabel))).toHaveValue('200');
  });

  /* 짧은 내용은 막지 않고 경고한다(A-12). */
  it('짧은 내용에는 경고를 붙인다 — 등록은 막지 않는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await user.type(registerPane().getByLabelText(new RegExp(t.register.descriptionLabel)), '불량');

    expect(registerPane().getByText(t.register.descriptionShort)).toBeInTheDocument();
  });
});

describe('DispositionRequestScreen — ② 판정 의뢰', () => {
  it('부적합이 없는 대상은 먼저 등록하라고 잠근다', async () => {
    const { user } = renderScreen();
    await selectRow(user);

    expect(requestPane().getByRole('button', { name: t.actions.request })).toBeDisabled();
    expect(requestPane().getByText(t.request.lock.noNonconformance)).toBeInTheDocument();
  });

  it('⭐ 의뢰는 상세의 ETag 를 If-Match 로 싣고 수량·단위를 보낸다', async () => {
    const { user } = renderScreen({ allCandidates: true });
    await selectRow(user, 'LOT-TEST-0305');
    await waitFor(() => {
      expect(requestPane().getByRole('button', { name: t.actions.request })).toBeEnabled();
    });

    const qty = requestPane().getByLabelText(new RegExp(t.request.qtyLabel));
    expect(qty).toHaveValue('300');
    await user.clear(qty);
    await user.type(qty, '120');
    await user.click(requestPane().getByRole('button', { name: t.actions.request }));

    expect(await screen.findByText(t.request.success)).toBeInTheDocument();

    const post = requestsSent().find((request) =>
      new URL(request.url).pathname.endsWith(':request-disposition'),
    );
    expect(post?.headers.get('If-Match')).toBe('W/"3"');
    expect(post?.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
    await expect(post?.json()).resolves.toEqual({ requestedQty: 120, uomId: 7001 });

    /* 의뢰 뒤 다시 읽은 상태가 판정 대기라 두 번 의뢰하지 않는다. */
    await waitFor(() => {
      expect(requestPane().getByText(t.request.lock.alreadyRequested)).toBeInTheDocument();
    });
  });

  /* 다른 화면이 `?lot=`만 들고 들어와도 그 LOT의 부적합을 따라 잠금 토큰이 선다. */
  it('⭐ 주소에 LOT만 있어도 그 LOT의 부적합을 따라 상세가 서고 의뢰가 열린다', async () => {
    const { user } = renderScreen({
      allCandidates: true,
      route: '/shipment/disposition-requests?lot=8202',
    });
    await waitFor(() => {
      expect(requestPane().getByRole('button', { name: t.actions.request })).toBeEnabled();
    });

    await user.click(requestPane().getByRole('button', { name: t.actions.request }));

    expect(await screen.findByText(t.request.success)).toBeInTheDocument();
    const post = requestsSent().find((request) =>
      new URL(request.url).pathname.endsWith(':request-disposition'),
    );
    expect(post?.headers.get('If-Match')).toBe('W/"3"');
  });

  it('대상 수량을 넘는 의뢰 수량은 보내기 전에 막는다', async () => {
    const { user } = renderScreen({ allCandidates: true });
    await selectRow(user, 'LOT-TEST-0305');
    await waitFor(() => {
      expect(requestPane().getByRole('button', { name: t.actions.request })).toBeEnabled();
    });

    const qty = requestPane().getByLabelText(new RegExp(t.request.qtyLabel));
    await user.clear(qty);
    await user.type(qty, '301');
    await user.click(requestPane().getByRole('button', { name: t.actions.request }));

    expect(requestPane().getByText(t.request.qtyExceeds('300'))).toBeInTheDocument();
    expect(
      requestsSent().some((request) =>
        new URL(request.url).pathname.endsWith(':request-disposition'),
      ),
    ).toBe(false);
  });

  /* 서버 409 는 구조화 코드로 되말한다 — `message` 원문을 그대로 옮기지 않는다. */
  it('상태가 바뀌어 거절되면 화면의 말로 되말한다', async () => {
    const { user } = renderScreen({
      allCandidates: true,
      requestResponse: () =>
        new Response(JSON.stringify({ code: 'INVALID_STATE', message: '합성 서버 문구' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    await selectRow(user, 'LOT-TEST-0305');
    await waitFor(() => {
      expect(requestPane().getByRole('button', { name: t.actions.request })).toBeEnabled();
    });

    await user.click(requestPane().getByRole('button', { name: t.actions.request }));

    expect(await screen.findByText(t.request.conflict.invalidState)).toBeInTheDocument();
    expect(screen.queryByText('합성 서버 문구')).not.toBeInTheDocument();
  });
});

describe('DispositionRequestScreen — ③ 결과 수신 후', () => {
  it('판정 완료 대상은 처분 목록을 보이고 후속 버튼은 처분별 사유를 단다', async () => {
    const { user } = renderScreen({ allCandidates: true });
    await selectRow(user, 'LOT-TEST-0299');

    expect(await resultPane().findByText(t.values.dispositionType.REWORK)).toBeInTheDocument();
    expect(resultPane().getByText(t.values.dispositionType.SCRAP)).toBeInTheDocument();
    expect(resultPane().getByText(t.result.partialNote)).toBeInTheDocument();

    /* 조건은 맞지만 열 화면이 없다 — 그 사실을 사유로 말한다(규범 4). */
    const rework = resultPane().getByRole('button', { name: t.actions.reworkResult });
    expect(rework).toBeDisabled();
    expect(resultPane().getByText(t.result.followUp.reworkUnavailable)).toBeInTheDocument();
    expect(resultPane().getByText(t.result.followUp.disposalUnavailable)).toBeInTheDocument();
    expect(resultPane().getByText(t.result.followUp.reinstateNotDecided)).toBeInTheDocument();

    /* 판정 결과는 품질 화면(W-03-10)의 진입 주소로 연다 — 주소를 손으로 적지 않는다. */
    expect(resultPane().getByRole('link', { name: t.actions.openDecision })).toHaveAttribute(
      'href',
      dispositionEntryPath(7002),
    );
    /* 판정이 끝난 부적합은 다시 의뢰하지 않는다. */
    expect(requestPane().getByText(t.request.lock.decided)).toBeInTheDocument();
  });

  it('부적합이 없는 대상에서는 판정 결과 보기가 사유와 함께 잠긴다', async () => {
    const { user } = renderScreen();
    await selectRow(user);

    expect(resultPane().getByRole('button', { name: t.actions.openDecision })).toBeDisabled();
    expect(resultPane().getByText(t.result.followUp.openDecisionUnavailable)).toBeInTheDocument();
    expect(resultPane().getByText(t.result.notRequested)).toBeInTheDocument();
  });
});
