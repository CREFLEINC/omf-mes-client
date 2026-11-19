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

const fillQuantities = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(pop.result.fields.accepted), '480');
  await user.type(screen.getByLabelText(pop.result.fields.rejected), '15');
  await user.type(screen.getByLabelText(pop.result.fields.held), '5');
};

/* 1 수량 입력 → [저장](2단계로) → 2 최종 판정에서 종합 판정을 고른다(#295 두 단계). */
const fillJudgment = async (user: ReturnType<typeof userEvent.setup>) => {
  await fillQuantities(user);
  await user.click(screen.getByRole('button', { name: pop.bar.next }));
  await user.click(
    within(screen.getByRole('radiogroup', { name: pop.result.judgmentStep })).getByRole('radio', {
      name: '합격',
    }),
  );
};

describe('PopOqcInspectionScreen (P-04-06)', () => {
  /* 판정 대기·판정 완료 두 목록의 건수를 함께 보인다(사용자 지시 2026-11-17 · #291). */
  it('OQC 판정 대기와 판정 완료를 함께 묻는다', async () => {
    const { queueQueries } = renderScreen('900028');

    expect(
      await screen.findByRole('tab', { name: new RegExp(pop.queue.heading, 'u') }),
    ).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(queueQueries).toHaveLength(2));
    for (const query of queueQueries) expect(query.get('inspectionTypeCode')).toBe('OQC');
    expect(queueQueries.map((query) => query.get('pendingOnly')).sort()).toEqual(['false', 'true']);
    expect(
      queueQueries.find((query) => query.get('pendingOnly') === 'false')?.get('statusCode'),
    ).toBe('COMPLETED');
  });

  it('판정을 단추로 고르고, 저장에 사번 헤더를 싣는다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen('900028');

    await openWaitingRequest(user);
    await fillJudgment(user);
    expect(screen.getByRole('radio', { name: '합격' })).toHaveAttribute('aria-checked', 'true');

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

  it('꺼진 단추에 손을 올리면 막는 이유가 보이고, 판정을 고르면 저장할 수 있다', async () => {
    const user = userEvent.setup();
    renderScreen('900028');

    expect(await screen.findByRole('button', { name: pop.bar.next })).toHaveAttribute(
      'title',
      pop.bar.blocked.noSelection,
    );
    await openWaitingRequest(user);
    expect(screen.getByRole('button', { name: pop.bar.next })).toBeDisabled();
    expect(screen.getByRole('button', { name: pop.bar.next })).toHaveAttribute(
      'title',
      pop.bar.blocked.totals,
    );

    await fillQuantities(user);
    await user.click(screen.getByRole('button', { name: pop.bar.next }));
    const save = screen.getByRole('button', { name: pop.bar.save });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute('title', pop.bar.blocked.judgment);

    await user.click(screen.getByRole('radio', { name: '합격' }));
    expect(screen.getByRole('button', { name: pop.bar.save })).toBeEnabled();

    /* [이전]으로 돌아가도 넣은 값은 그대로다. */
    await user.click(screen.getByRole('button', { name: pop.bar.prev }));
    expect(screen.getByLabelText(pop.result.fields.accepted)).toHaveValue('480');
  });

  it('합격 수량 = 검사 수량이면 2단계에서 종합 판정이 「합격」으로 골라져 있고, 수량을 바꾸면 지워진다', async () => {
    const user = userEvent.setup();
    renderScreen('900028');

    await openWaitingRequest(user);
    await user.type(screen.getByLabelText(pop.result.fields.accepted), '500');
    await user.type(screen.getByLabelText(pop.result.fields.rejected), '0');
    await user.type(screen.getByLabelText(pop.result.fields.held), '0');
    await user.click(screen.getByRole('button', { name: pop.bar.next }));
    expect(screen.getByRole('radio', { name: '합격' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: pop.bar.prev }));
    await user.clear(screen.getByLabelText(pop.result.fields.accepted));
    await user.type(screen.getByLabelText(pop.result.fields.accepted), '490');
    await user.clear(screen.getByLabelText(pop.result.fields.rejected));
    await user.type(screen.getByLabelText(pop.result.fields.rejected), '10');
    await user.click(screen.getByRole('button', { name: pop.bar.next }));
    expect(screen.getByRole('radio', { name: '합격' })).toHaveAttribute('aria-checked', 'false');
  });

  it('판정별 LOT 상태를 서버 전이와 같은 말로 미리 말한다(합격 → 정상 · 보류 → 검사 대기 · 불합격 → 불량)', async () => {
    const user = userEvent.setup();
    renderScreen('900028');

    await openWaitingRequest(user);
    await fillJudgment(user);
    expect(screen.getByText(pop.warning.directionRelease)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '보류' }));
    expect(screen.getByText(pop.warning.directionPending)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '불합격' }));
    expect(screen.getByText(pop.warning.directionHold)).toBeInTheDocument();
  });

  it('사번이 없으면 저장이 잠기고 사유가 보인다', async () => {
    const user = userEvent.setup();
    const { saves } = renderScreen(null);

    await openWaitingRequest(user);
    await fillJudgment(user);

    expect(screen.getByRole('button', { name: pop.bar.save })).toBeDisabled();
    expect(screen.getAllByText(messages.popChrome.workerMissing).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: pop.bar.save })).toHaveAttribute(
      'title',
      pop.bar.blocked.worker,
    );
    expect(saves).toHaveLength(0);
  });
});
