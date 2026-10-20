import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import {
  codeValuesResponse,
  confirmedRound,
  overallJudgmentCodeValues,
  queueItems,
  queueResponse,
  roundsResponse,
  waitingRequest,
} from '../oqc-inspection/fixtures';
import { PopOqcInspectionScreen } from './screen';

/**
 * P-04-06 — 판정 규칙(R1~R4)은 W-04-03 의 시험이 잰다. 여기서는 POP 이 «더한» 것만 잰다:
 * 대기 목록 질의 · 사번 헤더 · 판정 단추 · 사번 없을 때의 잠금.
 */

const pop = messages.popOqcInspection;

const renderScreen = (workerNo: string | null) => {
  const saves: Request[] = [];
  const queueQueries: URLSearchParams[] = [];

  const stubFetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/quality/inspection-requests') {
      queueQueries.push(url.searchParams);
      return jsonResponse(queueResponse());
    }

    if (path.startsWith('/quality/inspection-requests/')) {
      const id = Number(path.split('/').at(-1));
      return jsonResponse(queueItems.find((item) => item.inspectionRequestId === id));
    }

    if (path === '/mdm/code-values')
      return jsonResponse(codeValuesResponse(overallJudgmentCodeValues));

    if (path === '/quality/inspection-results' && request.method === 'GET') {
      return jsonResponse(roundsResponse([]));
    }

    if (path === '/quality/inspection-results' && request.method === 'POST') {
      saves.push(request.clone());
      return jsonResponse(confirmedRound, { status: 201 });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
  };

  renderWithProviders(
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, workerNo }}>
      <PopOqcInspectionScreen />
    </PopIdentityProvider>,
    { route: '/pop/oqc-inspection', fetch: stubFetch },
  );

  return { saves, queueQueries };
};

const openWaitingRequest = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await screen.findByRole('button', {
      name: pop.queue.selectRow(waitingRequest.inspectionRequestNo),
    }),
  );
  await screen.findByLabelText(pop.result.fields.accepted);
};

const fillJudgment = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(pop.result.fields.accepted), '480');
  await user.type(screen.getByLabelText(pop.result.fields.rejected), '15');
  await user.type(screen.getByLabelText(pop.result.fields.held), '5');
  await user.click(
    within(screen.getByRole('group', { name: pop.result.judgmentStep })).getByRole('button', {
      name: '합격',
    }),
  );
};

describe('PopOqcInspectionScreen (P-04-06)', () => {
  it('OQC 판정 대기만 묻는다', async () => {
    const { queueQueries } = renderScreen('900028');

    expect(await screen.findByRole('heading', { name: pop.queue.heading })).toBeInTheDocument();
    await waitFor(() => expect(queueQueries).not.toHaveLength(0));
    expect(queueQueries[0]?.get('inspectionTypeCode')).toBe('OQC');
    expect(queueQueries[0]?.get('pendingOnly')).toBe('true');
  });

  it('판정을 단추로 고르고, 저장에 사번 헤더를 싣는다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen('900028');

    await openWaitingRequest(user);
    await fillJudgment(user);
    expect(screen.getByRole('button', { name: '합격' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: pop.bar.save }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: pop.confirm.confirm }),
    );

    await waitFor(() => expect(saves).toHaveLength(1));
    const [saved] = saves;
    expect(saved?.headers.get('X-Worker-No')).toBe('900028');
    expect(saved?.headers.get('Idempotency-Key')).toBeTruthy();
    const body = (await saved?.json()) as { overallJudgmentCode?: string; statusCode: string };
    expect(body.overallJudgmentCode).toBe('ACCEPTED');
    expect(body.statusCode).toBe('CONFIRMED');
  });

  it('바닥 띠가 저장을 막는 이유를 말하고, 판정을 고르면 저장할 수 있다고 말한다', async () => {
    const user = userEvent.setup();
    renderScreen('900028');

    expect(await screen.findByText(pop.bar.blocked.noSelection)).toBeInTheDocument();
    await openWaitingRequest(user);
    expect(screen.getByText(pop.bar.blocked.totals)).toBeInTheDocument();

    await user.type(screen.getByLabelText(pop.result.fields.accepted), '480');
    await user.type(screen.getByLabelText(pop.result.fields.rejected), '15');
    await user.type(screen.getByLabelText(pop.result.fields.held), '5');
    expect(screen.getByText(pop.bar.blocked.judgment)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pop.bar.save })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '합격' }));
    expect(screen.getByText(pop.bar.ready)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pop.bar.save })).toBeEnabled();
  });

  it('판정별 LOT 상태를 서버 전이와 같은 말로 미리 말한다(합격 → 정상 · 보류 → 검사 대기 · 불합격 → 불량)', async () => {
    const user = userEvent.setup();
    renderScreen('900028');

    await openWaitingRequest(user);
    await fillJudgment(user);
    expect(screen.getByText(pop.warning.directionRelease)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '보류' }));
    expect(screen.getByText(pop.warning.directionPending)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '불합격' }));
    expect(screen.getByText(pop.warning.directionHold)).toBeInTheDocument();
  });

  it('사번이 없으면 저장이 잠기고 사유가 보인다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen(null);

    await openWaitingRequest(user);
    await fillJudgment(user);

    expect(screen.getByRole('button', { name: pop.bar.save })).toBeDisabled();
    expect(screen.getAllByText(messages.popChrome.workerMissing).length).toBeGreaterThan(0);
    expect(screen.getByText(pop.bar.blocked.worker)).toBeInTheDocument();
    expect(saves).toHaveLength(0);
  });
});
