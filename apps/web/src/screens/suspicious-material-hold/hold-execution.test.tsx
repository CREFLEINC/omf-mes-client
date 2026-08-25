import type { components } from '@omf-mes/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import type { SelectedLotSnapshot } from './candidate-model';
import { SuspiciousMaterialHoldExecution } from './hold-execution';

type Body = components['schemas']['LotHoldCreate'];
const body: Body = {
  lots: [
    { lotId: 701, versionNo: 11 },
    { lotId: 702, versionNo: 12 },
  ],
  reasonCode: 'DAMAGE',
  releaseCondition: '재검 완료',
  targetLotStatusCode: 'HOLD',
};
const selected = body.lots.map(({ lotId, versionNo }): SelectedLotSnapshot => ({
  lotId,
  versionNo,
  lotNo: `SYN-LOT-${String(lotId)}`,
  itemId: 801001,
  lotStatusCode: 'NORMAL',
}));
type Reply = (request: Request, call: number) => Response;
const renderExecution = (reply: Reply, value: Body | null = body) => {
  const requests: Request[] = [];
  let calls = 0;
  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/quality/lot-holds',
      respond: (request) => {
        requests.push(request.clone());
        return reply(request, ++calls);
      },
    },
  ]);
  const callbacks = {
    onApplied: vi.fn(),
    onConfirmationChange: vi.fn(),
    onReload: vi.fn(),
  };
  const view = renderWithProviders(
    <SuspiciousMaterialHoldExecution body={value} selected={selected} {...callbacks} />,
    { fetch },
  );
  return { ...view, callbacks, requests, user: userEvent.setup() };
};

describe('의심자재 보류 실행', () => {
  it('유효 body만 확인하고 exact POST와 Idempotency-Key만 보낸다', async () => {
    const blocked = renderExecution(() => jsonResponse([]), null);
    expect(screen.getByRole('button', { name: '등록 확인' })).toBeDisabled();
    blocked.unmount?.();
    const { requests, user } = renderExecution(() => jsonResponse([], { status: 201 }));
    await user.click(screen.getByRole('button', { name: '등록 확인' }));
    expect(screen.getByRole('dialog', { name: '의심자재 보류 등록 확인' })).toBeVisible();
    expect(screen.getByText(/2개 LOT의 출고·출하·피킹을 막습니다/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '보류 등록' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(await requests[0]?.json()).toEqual(body);
    expect(requests[0]?.headers.get('Idempotency-Key')).toBeTruthy();
    expect(requests[0]?.headers.has('If-Match')).toBe(false);
  });

  it('network 재시도는 같은 body/key를 쓰고 성공 callback과 안내를 보존한다', async () => {
    const { callbacks, requests, user } = renderExecution((_, call) => {
      if (call === 1) throw new TypeError('offline');
      return jsonResponse([], { status: 201 });
    });
    await user.click(screen.getByRole('button', { name: '등록 확인' }));
    await user.click(screen.getByRole('button', { name: '보류 등록' }));
    expect(await screen.findByText(/네트워크 연결/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: '보류 등록' }));
    await waitFor(() => expect(callbacks.onApplied).toHaveBeenCalledOnce());
    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      requests[1]?.headers.get('Idempotency-Key'),
    );
    expect(await requests[1]?.json()).toEqual(body);
    expect(screen.getByText(/Lot Status 판정·전이 처리에서 후속 처리/)).toBeVisible();
    expect(callbacks.onConfirmationChange).toHaveBeenLastCalledWith(false);
  });

  it('409는 raw ID 없이 dialog에 남고 최신 불러오기만 명시적으로 해제한다', async () => {
    const { callbacks, requests, user } = renderExecution(() =>
      jsonResponse(
        {
          code: 'VERSION_CONFLICT',
          conflictCause: 'user',
          conflictingLotId: 701,
          message: '최신 LOT 상태가 필요합니다.',
        },
        { status: 409 },
      ),
    );
    await user.click(screen.getByRole('button', { name: '등록 확인' }));
    await user.click(screen.getByRole('button', { name: '보류 등록' }));
    expect(await screen.findByText(/최신 LOT 상태가 필요합니다/)).toBeVisible();
    expect(screen.queryByText('701')).toBeNull();
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(callbacks.onReload).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(1);
  });
});
