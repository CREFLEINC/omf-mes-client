import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { DELIVERY_LABEL } from './codes';
import { WORKER_NO, issueLog } from './fixtures';
import { useLabelIssue, type IssueCommand } from './mutations';
import type { TargetRow } from './types';

/**
 * 훅을 «직접» 부른다 — 화면을 거치면 이 자리를 잴 수 없다.
 *
 * ⛔ **연타 방어는 화면 시험으로 검사되지 않는다.** 화면에는 단추 `disabled` 와
 * 「현재 발행 결과를 확인하세요」 차단이 앞에 서 있어, 훅 안의 방어를 지워도 화면 시험은
 * 전부 통과한다(실측 2026-09-03 — 결함을 주입했더니 걸린 시험이 0건이었다). 그런데 그
 * 방어야말로 **같은 렌더에서 두 번 들어오는 손가락**을 막는 유일한 자리다.
 */

const row: TargetRow = {
  targetId: 9401,
  issueTargetId: 9501,
  displayName: 'SYN-LOT-0001',
  lotId: 9501,
  isIssuable: true,
  statusLabel: '합격',
};

const command: IssueCommand = {
  kind: DELIVERY_LABEL,
  rows: [row],
  printerName: null,
  reissueReasonCode: null,
};

const renderIssue = () => {
  const posts: Request[] = [];

  const result = renderHookWithProviders(() => useLabelIssue({ workerNo: WORKER_NO }), {
    fetch: createStubFetch([
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === '/app/document-issues',
        respond: (request) => {
          posts.push(request);

          return jsonResponse(
            { items: [issueLog(9701, 9501, 'SYN-LOT-0001', 1)] },
            { status: 201 },
          );
        },
      },
      {
        match: (request) => /\/rendition$/u.test(new URL(request.url).pathname),
        respond: () =>
          new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }),
      },
    ]),
  });

  return { ...result, posts };
};

describe('useLabelIssue — 되돌릴 수 없는 쓰기의 방어선', () => {
  it('같은 렌더에서 두 번 불러도 발행은 한 번만 나간다', async () => {
    const { result, posts } = renderIssue();

    /*
     * 장갑 낀 손의 연타가 만드는 상황이다 — 단추의 `disabled` 는 다음 렌더에서야 반영되므로
     * 상태를 보고 막을 수 없다. 두 번째 호출이 나가면 회차가 하나 더 오르고 지울 방법이 없다.
     */
    act(() => {
      result.current.issue(command);
      result.current.issue(command);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('issued');
    });

    expect(posts).toHaveLength(1);
  });

  it('사번을 모르면 아무것도 부르지 않는다 — 단추 밖의 경로로도 빈 사번이 새지 않는다', async () => {
    const posts: Request[] = [];
    const { result } = renderHookWithProviders(() => useLabelIssue({ workerNo: null }), {
      fetch: createStubFetch([
        {
          match: (request) => request.method === 'POST',
          respond: (request) => {
            posts.push(request);

            return jsonResponse({ items: [] }, { status: 201 });
          },
        },
      ]),
    });

    act(() => {
      result.current.issue(command);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('idle');
    });

    expect(posts).toHaveLength(0);
  });
});
