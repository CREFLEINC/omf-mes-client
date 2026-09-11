import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { DELIVERY_LABEL } from './codes';
import { WORKER_NO, issueLog } from './fixtures';
import { useLabelIssue, type IssueCommand } from './mutations';
import type { TargetRow } from './types';

/**
 * **그림을 «어느 발행 기록으로» 받는가**(#1083).
 *
 * ⛔ 여러 건을 한 번에 발행하면 기록도 여러 건이고, 그림은 **기록마다 따로** 받아야 한다.
 * 반복문이 바깥 변수를 물면 모든 장이 **같은 한 건의 그림**으로 찍히는데, 종이에 찍힌 번호가
 * 실물과 어긋난 채 현장에 나가므로 화면에서는 성공으로만 보인다.
 *
 * ⭐ **모듈 경계에서 대역을 세운다.** 실제 호출 여부는 모드가 가르고(`pop-label-rendition`),
 * 시험 실행은 「부르지 않는」 쪽이라 네트워크로는 이 배선을 잴 수 없다 — 그 가름과 무관하게
 * 인자만 보려고 여기서만 대역을 쓴다.
 */
const received: number[] = [];

vi.mock('../../patterns/pop-label-rendition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../patterns/pop-label-rendition')>();

  return {
    ...actual,
    fetchLabelRendition: vi.fn((_client: unknown, documentIssueLogId: number) => {
      received.push(documentIssueLogId);

      return Promise.resolve(new Uint8Array([1, 2, 3]).buffer);
    }),
  };
});

const row = (targetId: number, lotId: number, displayName: string): TargetRow => ({
  targetId,
  issueTargetId: lotId,
  displayName,
  lotId,
  isIssuable: true,
  statusLabel: '합격',
});

const command: IssueCommand = {
  kind: DELIVERY_LABEL,
  rows: [row(9401, 9501, 'SYN-LOT-0001'), row(9402, 9502, 'SYN-LOT-0002')],
  printerName: null,
  reissueReasonCode: null,
};

describe('라벨 그림은 발행 기록마다 따로 받는다', () => {
  it('두 건을 발행하면 각 기록의 번호로 한 번씩 받는다', async () => {
    received.length = 0;

    const { result } = renderHookWithProviders(() => useLabelIssue({ workerNo: WORKER_NO }), {
      fetch: createStubFetch([
        {
          match: (request) =>
            request.method === 'POST' && new URL(request.url).pathname === '/app/document-issues',
          respond: () =>
            jsonResponse(
              {
                items: [
                  issueLog(9701, 9501, 'SYN-LOT-0001', 1),
                  issueLog(9702, 9502, 'SYN-LOT-0002', 1),
                ],
              },
              { status: 201 },
            ),
        },
      ]),
    });

    act(() => {
      result.current.issue(command);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('issued');
    });

    expect(received).toEqual([9701, 9702]);
  });
});
