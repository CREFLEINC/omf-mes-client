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
/** 사번 조회 응답의 한 줄 — `appUserId` 로 다른 계정 연결을 가린다. */
const FREE = { ...LINKED, appUserId: null };
const ELSEWHERE = { ...LINKED, appUserId: 9999 };
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
  directory: object[] = [FREE],
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

const dialog = () => screen.findByRole('dialog');

describe('WorkerLinkField', () => {
  it('미연결이면 「미연결」 배지·안내·[작업자 연결]만 보이고 입력칸은 없다', async () => {
    render(NONE);

    expect(await screen.findByText(t.unlinked)).toBeInTheDocument();
    expect(screen.getByText(t.none)).toBeInTheDocument();
    expect(screen.getByText(t.hintUnlinked)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('[작업자 연결] → 모달에서 사번 Enter → 모달이 닫히고 카드가 연결됨으로 바뀌고 알림이 뜬다', async () => {
    const { puts, user } = render(NONE);

    await user.click(await screen.findByRole('button', { name: t.connect }));
    const modal = await dialog();
    expect(within(modal).getByText(t.noteConnect)).toBeInTheDocument();
    await user.type(within(modal).getByLabelText(t.inputConnect), 'SYN-W-01{Enter}');

    await waitFor(() => {
      expect(puts).toEqual([{ workerId: 8501 }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText(t.linked)).toBeInTheDocument();
    expect(screen.getByText('합성 작업자')).toBeInTheDocument();
    expect(await screen.findByText('합성 부서')).toBeInTheDocument();
    expect(screen.getByText(t.hintLinked)).toBeInTheDocument();
    expect(await screen.findByText(t.linkedToast('SYN-W-01 · 합성 작업자'))).toBeInTheDocument();
  });

  it('빈칸이면 입력칸 아래에 이유를 내고 모달을 연 채 입력칸으로 돌아간다', async () => {
    const { puts, user } = render(NONE);

    await user.click(await screen.findByRole('button', { name: t.connect }));
    const modal = await dialog();
    await user.click(within(modal).getByRole('button', { name: t.submitConnect }));

    expect(await within(modal).findByText(t.workerNoRequired)).toBeInTheDocument();
    expect(within(modal).getByLabelText(t.inputConnect)).toHaveFocus();
    expect(puts).toEqual([]);
  });

  it('재직자 중 그 사번이 없으면 보내지 않고 입력칸 아래에 이유를 낸다', async () => {
    const { puts, user } = render(LINKED, []);

    await user.click(await screen.findByRole('button', { name: t.change }));
    const modal = await dialog();
    await user.type(within(modal).getByLabelText(t.inputChange), 'NOPE{Enter}');

    expect(await within(modal).findByText(t.notFound)).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it('조회한 사번이 다른 계정에 연결돼 있으면 보내지 않고 「이미 다른 계정에 연결된 사번」을 낸다', async () => {
    const { puts, user } = render(LINKED, [ELSEWHERE]);

    await user.click(await screen.findByRole('button', { name: t.change }));
    const modal = await dialog();
    await user.type(within(modal).getByLabelText(t.inputChange), 'SYN-W-01{Enter}');

    expect(await within(modal).findByText(t.linkedElsewhere)).toBeInTheDocument();
    expect(puts).toEqual([]);
    expect(screen.getByText(t.linked)).toBeInTheDocument();
  });

  it('경합으로 서버가 400 workerId 로 막으면 그 문구를 입력칸 아래에 내고 모달·기존 연결을 유지한다', async () => {
    const { puts, user } = render(LINKED, [FREE], { rejectPut: true });

    await user.click(await screen.findByRole('button', { name: t.change }));
    const modal = await dialog();
    expect(within(modal).getByText('합성 작업자')).toBeInTheDocument();
    await user.type(within(modal).getByLabelText(t.inputChange), 'SYN-W-01{Enter}');

    expect(
      await within(modal).findByText('이미 다른 계정에 연결된 작업자입니다.'),
    ).toBeInTheDocument();
    expect(puts).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('변경 모달을 취소하면 아무것도 보내지 않고, 다시 열면 빈 입력이다', async () => {
    const { puts, user } = render(LINKED);

    await user.click(await screen.findByRole('button', { name: t.change }));
    await user.type(within(await dialog()).getByLabelText(t.inputChange), '123');
    await user.click(within(await dialog()).getByRole('button', { name: messages.common.cancel }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: t.change }));
    expect(within(await dialog()).getByLabelText(t.inputChange)).toHaveValue('');
    expect(puts).toEqual([]);
  });

  it('연결 해제는 확인 창(작업자·질문·영향)을 거치고, 해제하면 미연결과 알림으로 바뀐다', async () => {
    const { puts, user } = render(LINKED);

    await user.click(await screen.findByRole('button', { name: t.unlink }));
    const modal = await dialog();
    expect(within(modal).getByText(t.unlinkQuestion)).toBeInTheDocument();
    expect(within(modal).getByText(t.unlinkImpact)).toBeInTheDocument();
    expect(within(modal).getByText('합성 작업자')).toBeInTheDocument();
    expect(puts).toEqual([]);
    await user.click(within(modal).getByRole('button', { name: t.unlink }));

    await waitFor(() => {
      expect(puts).toEqual([{ workerId: null }]);
    });
    expect(await screen.findByText(t.unlinkedToast)).toBeInTheDocument();
    expect(await screen.findByText(t.none)).toBeInTheDocument();
  });

  it('해제 확인 창에서 취소하면 보내지 않는다', async () => {
    const { puts, user } = render(LINKED);

    await user.click(await screen.findByRole('button', { name: t.unlink }));
    await user.click(within(await dialog()).getByRole('button', { name: messages.common.cancel }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(puts).toEqual([]);
    expect(screen.getByText(t.linked)).toBeInTheDocument();
  });
});
