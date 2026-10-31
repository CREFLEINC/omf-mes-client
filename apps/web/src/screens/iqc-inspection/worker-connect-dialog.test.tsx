import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { WorkerConnectDialog } from './worker-connect-dialog';

const t = messages.usersRoles.workerLink;
const LINK_PATH = '/app/users/8101/worker';
const LINKED = { workerId: 8501, workerNo: 'SYN-W-01', workerName: '합성 작업자' };
const FREE = { ...LINKED, appUserId: null };
const ELSEWHERE = { ...LINKED, appUserId: 9999 };

const render = (directory: object[]) => {
  const puts: unknown[] = [];
  const onClose = vi.fn();
  renderWithProviders(<WorkerConnectDialog appUserId={8101} onClose={onClose} />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === LINK_PATH && request.method === 'PUT',
        respond: async (request) => {
          puts.push(await request.clone().json());
          return jsonResponse(LINKED);
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/workers',
        respond: () =>
          jsonResponse({ items: directory, page: { page: 1, size: 2, total: directory.length } }),
      },
    ]),
  });
  return { puts, onClose, user: userEvent.setup() };
};

/** 검사 조회·판정에서 바로 잇는 작업자 연결(사용자 지시 2026-10-28 · #197). */
describe('WorkerConnectDialog', () => {
  it('사번으로 찾은 재직자를 이 계정에 잇고 창을 닫는다', async () => {
    const { puts, onClose, user } = render([FREE]);

    await user.type(screen.getByLabelText(t.inputLabel), 'SYN-W-01');
    await user.click(screen.getByRole('button', { name: t.submitConnect }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(puts).toEqual([{ workerId: 8501 }]);
  });

  it('다른 계정에 연결된 사번이면 보내지 않고 입력칸 아래에 막는다', async () => {
    const { puts, onClose, user } = render([ELSEWHERE]);

    await user.type(screen.getByLabelText(t.inputLabel), 'SYN-W-01');
    await user.click(screen.getByRole('button', { name: t.submitConnect }));

    expect(await screen.findByText(t.linkedElsewhere)).toBeInTheDocument();
    expect(puts).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('없는 사번이면 찾을 수 없다고 말한다', async () => {
    const { puts, user } = render([]);

    await user.type(screen.getByLabelText(t.inputLabel), 'NOPE');
    await user.click(screen.getByRole('button', { name: t.submitConnect }));

    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
    expect(puts).toHaveLength(0);
  });
});
