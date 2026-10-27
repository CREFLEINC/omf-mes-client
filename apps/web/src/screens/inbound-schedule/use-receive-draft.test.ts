import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { scheduleLine } from './fixtures';
import type { InboundScheduleLine } from './types';
import { useReceiveDraft } from './use-receive-draft';

describe('useReceiveDraft — 체크는 지금 라인으로 다시 거른다', () => {
  it('체크한 줄이 다시 불러온 뒤 받을 것이 없어지면 체크로 남지 않는다', () => {
    const open = scheduleLine({ remainingQty: 30, receivedQty: 70 });
    const { result, rerender } = renderHook(
      ({ lines }: { lines: InboundScheduleLine[] }) => useReceiveDraft(lines, 7101),
      { initialProps: { lines: [open] } },
    );

    act(() => {
      result.current.toggle(7301);
    });
    expect(result.current.checked.has(7301)).toBe(true);

    /* 다른 곳에서 남은 30 을 받았다(또는 초과분을 연결했다) — 남은 수량 0. */
    rerender({ lines: [{ ...open, receivedQty: 100, remainingQty: 0 }] });

    expect(result.current.checked.size).toBe(0);
    expect(result.current.someChecked).toBe(false);
    expect(result.current.checkedPicks()).toEqual([]);
  });

  it('발주가 바뀌면 체크와 편집을 비운다', () => {
    const line = scheduleLine();
    const { result, rerender } = renderHook(
      ({ orderId }: { orderId: number }) => useReceiveDraft([line], orderId),
      { initialProps: { orderId: 7101 } },
    );

    act(() => {
      result.current.toggle(7301);
    });
    rerender({ orderId: 7102 });

    expect(result.current.checked.size).toBe(0);
  });
});
