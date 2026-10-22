import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SessionForceEndDialog } from './session-force-end-dialog';

const t = messages.workOrderClose.forceEnd;
const sessionText = messages.workOrderClose.status.sessions;
const PATH = '/production/work-sessions/930001:force-end';

const session = {
  workSessionId: 930001,
  terminalCode: 'POP-SYN-1',
  workerName: '합성 작업자',
  workerNo: '900028',
  startedAt: '2026-10-22T09:00:00+07:00',
  statusCode: 'STOPPED',
};

const renderDialog = (
  respond: () => Response,
  sent: { body: unknown; key: string | null; ifMatch?: string | null }[],
) => {
  const onClose = vi.fn();
  renderWithProviders(<SessionForceEndDialog session={session} onClose={onClose} />, {
    fetch: createStubFetch([
      {
        match: (request) => request.method === 'POST' && new URL(request.url).pathname === PATH,
        respond: async (request) => {
          sent.push({
            body: await request.clone().json(),
            key: request.headers.get('Idempotency-Key'),
            ifMatch: request.headers.get('If-Match'),
          });
          return respond();
        },
      },
    ]),
  });
  return { onClose, dialog: screen.getByRole('dialog', { name: t.title }) };
};

describe('SessionForceEndDialog', () => {
  it('어느 단말·작업자의 세션인지와 그 단말에 일어나는 일을 보이고, 사유를 적어야 누를 수 있다', async () => {
    const sent: { body: unknown; key: string | null; ifMatch?: string | null }[] = [];
    const user = userEvent.setup();
    const { dialog, onClose } = renderDialog(() => jsonResponse({ workSessionId: 930001 }), sent);

    const valueOf = (label: string) => within(dialog).getByText(label).nextElementSibling;
    expect(valueOf(sessionText.terminal)).toHaveTextContent('POP-SYN-1');
    expect(valueOf(sessionText.worker)).toHaveTextContent('합성 작업자(900028)');
    expect(valueOf(sessionText.startedAt)).toHaveTextContent('2026-10-22 09:00');
    expect(valueOf(sessionText.state)).toHaveTextContent(sessionText.STOPPED);
    expect(within(dialog).getByText(t.effect)).toBeVisible();
    expect(within(dialog).getByText(t.notify)).toBeVisible();

    const confirm = within(dialog).getByRole('button', { name: t.confirm });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription(t.reasonRequired);
    await user.type(within(dialog).getByLabelText(t.reason), '   ');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(t.reason), '단말 고장으로 종료 불가 ');
    await user.click(confirm);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(sent).toEqual([
      {
        body: { reason: '단말 고장으로 종료 불가' },
        key: expect.stringMatching(/.+/),
        /* 서버가 세션을 잠그고 상태로 판정한다 — 잠금 값을 싣지 않는다. */
        ifMatch: null,
      },
    ]);
    expect(await screen.findByText(t.done('POP-SYN-1'))).toBeVisible();
  });

  it('이미 끝난 세션이면 그 사실을 알리고 창을 닫는다', async () => {
    const sent: { body: unknown; key: string | null; ifMatch?: string | null }[] = [];
    const user = userEvent.setup();
    const { dialog, onClose } = renderDialog(
      () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'STATE_LOCKED',
                message: '이미 종료된 작업 세션입니다. 작업 세션 목록을 새로 고쳐 확인하세요.',
              },
            ],
          },
          { status: 400 },
        ),
      sent,
    );

    await user.type(within(dialog).getByLabelText(t.reason), '사유');
    await user.click(within(dialog).getByRole('button', { name: t.confirm }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(t.alreadyEnded('POP-SYN-1'))).toBeVisible();
  });

  it('사유 칸 오류는 칸에 붙이고 창을 닫지 않는다', async () => {
    const sent: { body: unknown; key: string | null; ifMatch?: string | null }[] = [];
    const user = userEvent.setup();
    const message = '강제 종료 사유를 입력하세요 — 누가 왜 세션을 닫았는지 기록으로 남습니다.';
    const { dialog, onClose } = renderDialog(
      () =>
        jsonResponse(
          { errors: [{ scope: 'field', field: 'reason', code: 'REQUIRED', message }] },
          { status: 400 },
        ),
      sent,
    );

    await user.type(within(dialog).getByLabelText(t.reason), '사유');
    await user.click(within(dialog).getByRole('button', { name: t.confirm }));

    expect(await within(dialog).findByText(message)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('사유가 500자를 넘으면 보내지 않고 줄이라고 말한다', async () => {
    const user = userEvent.setup();
    const { dialog } = renderDialog(() => jsonResponse({}), []);

    await user.click(within(dialog).getByLabelText(t.reason));
    await user.paste('가'.repeat(501));

    const confirm = within(dialog).getByRole('button', { name: t.confirm });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription(t.reasonTooLong(500));
  });
});
