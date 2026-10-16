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
  it('미지정이면 안내와 「작업자 지정」만 보이고(입력칸·배지 없음), 지정하면 사번·이름·부서를 칸마다 보이고 알림이 뜬다', async () => {
    const { puts, user } = render(NONE);

    expect(await screen.findByText(t.none)).toBeInTheDocument();
    expect(screen.queryByText(t.linked)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(t.immediateNote)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.assign }));
    expect(screen.getByText(t.immediateNote)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.inputAssign), 'SYN-W-01');
    await user.click(screen.getByRole('button', { name: t.confirmAssign }));

    await waitFor(() => {
      expect(puts).toEqual([{ workerId: 8501 }]);
    });
    expect(await screen.findByText(t.linked)).toBeInTheDocument();
    expect(screen.getByText('SYN-W-01')).toBeInTheDocument();
    expect(screen.getByText('합성 작업자')).toBeInTheDocument();
    expect(await screen.findByText('합성 부서')).toBeInTheDocument();
    expect(await screen.findByText(t.linkedToast('SYN-W-01 · 합성 작업자'))).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('재직자 중 그 사번이 없으면 보내지 않고, 입력을 연 채로 이유를 낸다', async () => {
    const { puts, user } = render(NONE, []);

    await user.click(await screen.findByRole('button', { name: t.assign }));
    await user.type(screen.getByLabelText(t.inputAssign), 'NOPE');
    await user.click(screen.getByRole('button', { name: t.confirmAssign }));

    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
    expect(screen.getByLabelText(t.inputAssign)).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it('지정되어 있으면 「작업자 변경」을 눌러야 입력이 열리고, 취소하면 닫히고 그대로다', async () => {
    const { puts, user } = render(LINKED);

    await screen.findByText('SYN-W-01');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.change }));
    expect(screen.getByLabelText(t.inputChange)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(puts).toEqual([]);
    expect(screen.getByText(t.linked)).toBeInTheDocument();
  });

  it('지정 해제는 확인 창을 거치고, 해제하면 「지정된 작업자가 없습니다.」와 알림으로 바뀐다', async () => {
    const { puts, user } = render(LINKED);

    await user.click(await screen.findByRole('button', { name: t.unlink }));
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
    expect(await screen.findByText(t.none)).toBeInTheDocument();
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
