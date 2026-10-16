import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { WorkerLinkPane } from './worker-link-pane';

const t = messages.usersRoles.workerLink;
const LINK_PATH = '/app/users/8101/worker';
const NONE = { workerId: null, workerNo: null, workerName: null };
const LINKED = { workerId: 8501, workerNo: 'SYN-W-01', workerName: '합성 작업자' };

/** omf-all-around#104 — 계정 ↔ 작업자 연결(서버 선행 P-38). */
const render = (initial: typeof NONE | typeof LINKED, directory: (typeof LINKED)[] = [LINKED]) => {
  const puts: unknown[] = [];
  renderWithProviders(<WorkerLinkPane appUserId={8101} />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === LINK_PATH && request.method === 'GET',
        respond: () => jsonResponse(initial),
      },
      {
        match: (request) => new URL(request.url).pathname === LINK_PATH && request.method === 'PUT',
        respond: async (request) => {
          const body = (await request.clone().json()) as { workerId: number | null };
          puts.push(body);
          return jsonResponse(body.workerId === null ? NONE : LINKED);
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/workers',
        respond: () =>
          jsonResponse({ items: directory, page: { page: 1, size: 2, total: directory.length } }),
      },
    ]),
  });
  return { puts, user: userEvent.setup() };
};

describe('WorkerLinkPane', () => {
  it('연결이 없으면 그렇다고 말하고, 사번으로 찾은 작업자로 연결한다', async () => {
    const { puts, user } = render(NONE);

    expect(await screen.findByText(t.none)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.workerNo), 'SYN-W-01');
    await user.click(screen.getByRole('button', { name: t.link }));

    await waitFor(() => {
      expect(puts).toEqual([{ workerId: 8501 }]);
    });
    expect(await screen.findByText('SYN-W-01 · 합성 작업자')).toBeInTheDocument();
  });

  it('재직자 중 그 사번이 없으면 보내지 않고 이유를 낸다', async () => {
    const { puts, user } = render(NONE, []);

    await screen.findByText(t.none);
    await user.type(screen.getByLabelText(t.workerNo), 'NOPE');
    await user.click(screen.getByRole('button', { name: t.link }));

    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it('연결되어 있으면 해제할 수 있다(workerId null)', async () => {
    const { puts, user } = render(LINKED);

    await user.click(await screen.findByRole('button', { name: t.unlink }));

    await waitFor(() => {
      expect(puts).toEqual([{ workerId: null }]);
    });
  });
});
