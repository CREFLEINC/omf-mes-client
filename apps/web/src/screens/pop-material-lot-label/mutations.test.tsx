import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useBatchIssue, type IssueCommand } from './mutations';
import { labelLot } from './test-lots';

/** 합성값이다 — 계약의 예시값도 실 운영 값도 쓰지 않는다(공개 저장소 경계). */
const command: IssueCommand = {
  lot: labelLot(9001),
  printerName: null,
  reissueReasonCode: null,
  lotStatusCode: null,
};

describe('useBatchIssue — 사번을 모를 때', () => {
  /**
   * 지금은 단추도 함께 막혀 있어 화면으로는 여기 닿지 않는다. 그런데 이 훅을 부르는 경로가
   * 하나 더 생기면 그때 새고, 그 실수는 **서버 거절로만** 드러난다 — 나가는 자리에서 막는다.
   */
  it('⛔ 요청을 한 건도 내보내지 않는다 — 빈 사번을 대신 싣지 않는다', () => {
    let calls = 0;

    const { result } = renderHookWithProviders(() => useBatchIssue({ workerNo: null }), {
      fetch: async () => {
        calls += 1;

        throw new Error('사번을 모르는데 요청이 나갔습니다.');
      },
    });

    act(() => {
      result.current.run([command]);
    });

    expect(calls).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });
});

describe('useBatchIssue — 두 번 눌렸을 때', () => {
  /**
   * 장갑 낀 손은 한 번 누를 것을 두 번 누른다. **단추의 비활성만으로는 못 막는다** —
   * 그 값은 다음 렌더에서야 반영되므로, 두 번째 누름이 «같은 렌더에서» 들어온다.
   *
   * ⛔ 발행 기록이 두 번 나가면 같은 LOT 의 라벨이 두 장 돈다(2회차는 사유 없는 재발행이 된다).
   */
  it('⛔ 같은 렌더에서 두 번 들어와도 발행 기록은 한 번만 나간다', async () => {
    const posts: string[] = [];

    const { result } = renderHookWithProviders(() => useBatchIssue({ workerNo: '900028' }), {
      fetch: async (request: Request) => {
        const { pathname } = new URL(request.url);

        if (request.method === 'POST') posts.push(pathname);

        // 발행 뒤는 무엇이 오든 상관없다 — 여기서 보는 것은 「몇 번 나갔는가」뿐이다.
        return jsonResponse({ items: [] }, { status: 201 });
      },
    });

    // 렌더 사이를 두지 않고 잇달아 부른다 — 두 번 누름과 같은 모양이다.
    act(() => {
      result.current.run([command]);
      result.current.run([command]);
    });

    await waitFor(() => {
      expect(result.current.isRunning).toBe(false);
    });

    expect(posts.filter((path) => path === '/app/document-issues')).toHaveLength(1);
  });
});
