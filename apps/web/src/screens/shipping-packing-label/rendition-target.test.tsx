import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { DELIVERY_LABEL } from './codes';
import { WORKER_NO, issueLog } from './fixtures';
import { useLabelIssue, type IssueCommand } from './mutations';
import type { IssueView, TargetRow } from './types';

/**
 * **라벨을 «어느 발행 기록으로» 그리는가**(#1083).
 *
 * ⛔ 여러 건을 한 번에 발행하면 기록도 여러 건이고, 라벨은 **기록마다 따로** 그려야 한다.
 * 반복문이 바깥 변수를 물면 모든 장이 **같은 한 건의 회차**로 찍히는데, 종이에 찍힌 번호가
 * 실물과 어긋난 채 현장에 나가므로 화면에서는 성공으로만 보인다.
 *
 * ⛔ **그리고 서버 렌디션은 «한 번도» 부르지 않는다**(SHIP-UNIT-01 P5). 이 화면의 두 종류를
 * 서버는 하나도 그려 주지 않는다 — 포장 라벨은 준비 목록에 없었고(P2 에서 현장의 종이가 한 장도
 * 안 나오던 원인), 납품 라벨은 전달본 v4 에서 **422** 가 됐다. 대역을 세워 그 부름이 없음을
 * 여기서 붙든다.
 */
const drawnFor: number[] = [];
const rendered: number[] = [];

vi.mock('../../patterns/pop-label-rendition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../patterns/pop-label-rendition')>();

  return {
    ...actual,
    fetchLabelRendition: vi.fn((_client: unknown, documentIssueLogId: number) => {
      rendered.push(documentIssueLogId);

      return Promise.resolve(new Uint8Array([1, 2, 3]).buffer);
    }),
  };
});

const row = (targetId: number, displayName: string): TargetRow => ({
  targetId,
  issueTargetId: targetId,
  displayName,
  lotId: null,
  isIssuable: true,
  statusLabel: '마감',
});

const command: IssueCommand = {
  kind: DELIVERY_LABEL,
  rows: [row(7001, 'SU-20260917-0001'), row(7002, 'SU-20260917-0002')],
  printerName: null,
  reissueReasonCode: null,
};

/** 그리개 대역 — 어느 기록으로 불렸는지만 적는다. */
const drawLabel = (_kind: unknown, _row: TargetRow, issue: IssueView): Uint8Array<ArrayBuffer> => {
  drawnFor.push(issue.documentIssueLogId);

  return new Uint8Array([137, 80, 78, 71]);
};

describe('라벨은 발행 기록마다 따로 그린다', () => {
  it('두 건을 발행하면 각 기록으로 한 번씩 그리고, 서버 렌디션은 부르지 않는다', async () => {
    drawnFor.length = 0;
    rendered.length = 0;

    const { result } = renderHookWithProviders(
      () => useLabelIssue({ workerNo: WORKER_NO, drawLabel }),
      {
        fetch: createStubFetch([
          {
            match: (request) =>
              request.method === 'POST' && new URL(request.url).pathname === '/app/document-issues',
            respond: () =>
              jsonResponse(
                {
                  items: [
                    issueLog(9701, 7001, 'SU-20260917-0001', 1),
                    issueLog(9702, 7002, 'SU-20260917-0002', 1),
                  ],
                },
                { status: 201 },
              ),
          },
        ]),
      },
    );

    act(() => {
      result.current.issue(command);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('issued');
    });

    expect(drawnFor).toEqual([9701, 9702]);
    expect(rendered).toEqual([]);
  });
});
