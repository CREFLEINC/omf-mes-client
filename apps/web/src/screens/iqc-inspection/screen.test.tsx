import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { pageOf, queueItems, queueResponse } from './fixtures';
import { IqcInspectionScreen } from './screen';

const t = messages.iqcInspection;

/** 요청이 실제로 무엇을 실어 갔는지 본다 — 주소가 조건을 몰았음을 그것으로 증명한다. */
const renderScreen = (
  route = '/',
  respond: (request: Request) => Response = () => jsonResponse(queueResponse()),
) => {
  const sent: URL[] = [];

  const view = renderWithProviders(<IqcInspectionScreen />, {
    route,
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/quality/inspection-requests',
        respond: (request) => {
          sent.push(new URL(request.url));
          return respond(request);
        },
      },
    ]),
  });

  return { sent, view };
};

const lastQuery = (sent: URL[]) => sent[sent.length - 1]?.searchParams;
const openButton = (no: string) => screen.getByRole('button', { name: t.queue.openRow(no) });

describe('IqcInspectionScreen', () => {
  it('검사 대기 큐를 그린다', async () => {
    renderScreen();

    expect(await screen.findByText('IR-2026-0001')).toBeInTheDocument();
  });

  it('고정 축을 늘 실어 보낸다 — 사용자가 끌 수 없는 이 화면의 정의다', async () => {
    const { sent } = renderScreen();

    await waitFor(() => expect(sent).toHaveLength(1));

    expect(lastQuery(sent)?.get('inspectionTypeCode')).toBe('IQC');
    expect(lastQuery(sent)?.get('pendingOnly')).toBe('true');
  });

  it('주소가 담은 조건을 그대로 실어 보낸다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { sent } = renderScreen('/?it=1001&sp=2002&q=IR&page=2');

    await waitFor(() => expect(sent).toHaveLength(1));

    expect(lastQuery(sent)?.get('itemId')).toBe('1001');
    expect(lastQuery(sent)?.get('supplierId')).toBe('2002');
    expect(lastQuery(sent)?.get('q')).toBe('IR');
    expect(lastQuery(sent)?.get('page')).toBe('2');
  });

  it('조건을 바꾸면 첫 쪽부터 다시 부른다 — 좁힌 결과가 3쪽에 못 미칠 수 있다', async () => {
    const { sent } = renderScreen('/?page=3');

    await waitFor(() => expect(sent).toHaveLength(1));

    await userEvent.type(screen.getByLabelText(t.filters.item), '1001');
    await userEvent.click(screen.getByRole('button', { name: t.filters.apply }));

    await waitFor(() => expect(sent.length).toBeGreaterThan(1));
    expect(lastQuery(sent)?.get('page')).toBe('1');
    expect(lastQuery(sent)?.get('itemId')).toBe('1001');
  });

  it('의뢰를 고르면 그 줄이 현재가 된다', async () => {
    renderScreen();

    await screen.findByText('IR-2026-0002');
    await userEvent.click(openButton('IR-2026-0002'));

    await waitFor(() => expect(openButton('IR-2026-0002')).toHaveAttribute('aria-current', 'true'));
  });

  it('쪽을 옮겨도 조건과 고른 의뢰는 그대로다', async () => {
    const { sent } = renderScreen('/?it=1001&ir=1002', () =>
      jsonResponse(queueResponse(queueItems, pageOf(120, 1, 50))),
    );

    await screen.findByText('IR-2026-0001');
    await userEvent.click(screen.getByRole('button', { name: t.pageNav.next }));

    await waitFor(() => expect(lastQuery(sent)?.get('page')).toBe('2'));
    expect(lastQuery(sent)?.get('itemId')).toBe('1001');
    expect(openButton('IR-2026-0002')).toHaveAttribute('aria-current', 'true');
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

    await waitFor(() => expect(sent.length).toBeGreaterThan(1));
    expect(await screen.findByText('IR-2026-0001')).toBeInTheDocument();
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
