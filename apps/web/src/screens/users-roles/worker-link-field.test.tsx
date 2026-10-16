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
const DUPLICATE = {
  errors: [
    {
      scope: 'field',
      field: 'workerId',
      code: 'INVALID',
      message: '이미 다른 계정에 연결된 작업자입니다.',
    },
  ],
};

const render = (
  initial: typeof NONE | typeof LINKED,
  directory: (typeof LINKED)[] = [LINKED],
  options: { rejectPut?: boolean } = {},
) => {
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
          if (options.rejectPut === true) return jsonResponse(DUPLICATE, { status: 400 });
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
  it('미연결이면 「미연결」 배지·안내·[작업자 연결]만 보이고 입력칸은 없다', async () => {
    render(NONE);

    expect(await screen.findByText(t.unlinked)).toBeInTheDocument();
    expect(screen.getByText(t.none)).toBeInTheDocument();
    expect(screen.getByText(t.hintUnlinked)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.connect })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(t.noteConnect)).not.toBeInTheDocument();
  });

  it('[작업자 연결] → 사번 입력 → Enter 로 연결하면 이름·사번·부서 한 줄과 알림으로 바뀐다', async () => {
    const { puts, user } = render(NONE);

    await user.click(await screen.findByRole('button', { name: t.connect }));
    expect(screen.getByText(t.noteConnect)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.inputConnect), 'SYN-W-01{Enter}');

    await waitFor(() => {
      expect(puts).toEqual([{ workerId: 8501 }]);
    });
    expect(await screen.findByText(t.linked)).toBeInTheDocument();
    expect(screen.getByText('합성 작업자')).toBeInTheDocument();
    expect(screen.getByText('SYN-W-01')).toBeInTheDocument();
    expect(await screen.findByText('합성 부서')).toBeInTheDocument();
    expect(screen.getByText(t.hintLinked)).toBeInTheDocument();
    expect(await screen.findByText(t.linkedToast('SYN-W-01 · 합성 작업자'))).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('빈칸이면 입력칸 아래에 이유를 내고 입력칸으로 돌아간다', async () => {
    const { puts, user } = render(NONE);

    await user.click(await screen.findByRole('button', { name: t.connect }));
    await user.click(screen.getByRole('button', { name: t.submitConnect }));

    expect(await screen.findByText(t.workerNoRequired)).toBeInTheDocument();
    expect(screen.getByLabelText(t.inputConnect)).toHaveFocus();
    expect(puts).toEqual([]);
  });

  it('재직자 중 그 사번이 없으면 보내지 않고, 입력을 연 채 입력칸 아래에 이유를 낸다', async () => {
    const { puts, user } = render(NONE, []);

    await user.click(await screen.findByRole('button', { name: t.connect }));
    await user.type(screen.getByLabelText(t.inputConnect), 'NOPE');
    await user.click(screen.getByRole('button', { name: t.submitConnect }));

    expect(await screen.findByText(t.notFound)).toBeInTheDocument();
    expect(screen.getByLabelText(t.inputConnect)).toHaveFocus();
    expect(puts).toEqual([]);
  });

  it('이미 다른 계정에 연결된 작업자면 서버 문구를 입력칸 아래에 내고 기존 연결을 그대로 둔다', async () => {
    const { puts, user } = render(LINKED, [LINKED], { rejectPut: true });

    await user.click(await screen.findByRole('button', { name: t.change }));
    await user.type(screen.getByLabelText(t.inputChange), 'SYN-W-01');
    await user.click(screen.getByRole('button', { name: t.submitChange }));

    expect(await screen.findByText('이미 다른 계정에 연결된 작업자입니다.')).toBeInTheDocument();
    expect(puts).toHaveLength(1);
    expect(screen.getByText(t.linked)).toBeInTheDocument();
    expect(screen.getByLabelText(t.inputChange)).toBeInTheDocument();
  });

  it('연결돼 있으면 [작업자 변경]을 눌러야 입력이 열리고, 취소하면 닫히고 그대로다', async () => {
    const { puts, user } = render(LINKED);

    await screen.findByText('SYN-W-01');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.change }));
    expect(screen.getByLabelText(t.inputChange)).toBeInTheDocument();
    expect(screen.getByText(t.noteChange)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(puts).toEqual([]);
    expect(screen.getByText(t.linked)).toBeInTheDocument();
  });

  it('연결 해제는 확인 창을 거치고, 해제하면 미연결과 알림으로 바뀐다', async () => {
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
