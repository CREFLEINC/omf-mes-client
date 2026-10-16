import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { WorkerLinkField } from './worker-link-field';

const t = messages.usersRoles.workerLink;
const LINK_PATH = '/app/users/8101/worker';
const NONE = { workerId: null, workerNo: null, workerName: null };
const LINKED = { workerId: 8501, workerNo: 'SYN-W-01', workerName: '합성 작업자' };
const WORKER_DETAIL = {
  worker: {
    ...LINKED,
    businessUnitId: 1,
    plantId: 1,
    departmentId: 7701,
    statusCode: 'EMPLOYED',
    isActive: true,
  },
  editability: {},
};
const departmentLabel = (id: number) => (id === 7701 ? '합성 부서' : '');

/** omf-all-around#104 — 계정 ↔ 작업자 연결(서버 선행 P-38). */
const render = (initial: typeof NONE | typeof LINKED, directory: (typeof LINKED)[] = [LINKED]) => {
  const puts: unknown[] = [];
  renderWithProviders(<WorkerLinkField appUserId={8101} departmentLabel={departmentLabel} />, {
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
        match: (request) => new URL(request.url).pathname === '/mdm/workers/8501',
        respond: () => jsonResponse(WORKER_DETAIL),
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

describe('WorkerLinkField', () => {
  it('미지정이면 배지와 지정 안내를 내고, 사번으로 찾은 작업자를 지정하면 배지·사번·이름·소속과 알림이 뜬다', async () => {
    const { puts, user } = render(NONE);

    expect(await screen.findByText(t.unlinked)).toBeInTheDocument();
    expect(screen.getByText(t.unlinkedGuide)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.workerNo), 'SYN-W-01');
    await user.click(screen.getByRole('button', { name: t.link }));

    await waitFor(() => {
      expect(puts).toEqual([{ workerId: 8501 }]);
    });
    expect(await screen.findByText(t.linked)).toBeInTheDocument();
    expect(
      await screen.findByText(t.summary('SYN-W-01', '합성 작업자', '합성 부서')),
    ).toBeInTheDocument();
    expect(await screen.findByText(t.linkedToast('SYN-W-01 · 합성 작업자'))).toBeInTheDocument();
    expect(screen.queryByText(t.unlinkedGuide)).not.toBeInTheDocument();
  });

  it('재직자 중 그 사번이 없으면 보내지 않고 이유를 낸다', async () => {
    const { puts, user } = render(NONE, []);

    await screen.findByText(t.unlinked);
    await user.type(screen.getByLabelText(t.workerNo), 'NOPE');
    await user.click(screen.getByRole('button', { name: t.link }));

    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it('지정되어 있으면 「변경」·「지정 해제」를 내고, 해제하면 미지정과 알림으로 바뀐다', async () => {
    const { puts, user } = render(LINKED);

    expect(
      await screen.findByText(t.summary('SYN-W-01', '합성 작업자', '합성 부서')),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.change })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.unlink }));

    /* 확인 창이 영향을 밝히고, 확인 전에는 보내지 않는다. */
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(t.unlinkConfirmBody('SYN-W-01 · 합성 작업자')),
    ).toBeInTheDocument();
    expect(puts).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: t.unlink }));

    await waitFor(() => {
      expect(puts).toEqual([{ workerId: null }]);
    });
    expect(await screen.findByText(t.unlinkedToast)).toBeInTheDocument();
    expect(await screen.findByText(t.unlinked)).toBeInTheDocument();
  });

  it('해제 확인 창에서 취소하면 보내지 않는다', async () => {
    const { puts, user } = render(LINKED);

    await user.click(await screen.findByRole('button', { name: t.unlink }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: messages.common.cancel }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(puts).toEqual([]);
    expect(screen.getByText(t.linked)).toBeInTheDocument();
  });
});
