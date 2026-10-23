import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { runBackStep } from './back-step';
import { StepSection, useStepFlow } from './step-flow';

const STEPS = ['scan', 'line', 'qty'] as const;

describe('단계 흐름', () => {
  it('첫 단계에서 시작하고 몇 번째인지 센다', () => {
    const { result } = renderHook(() => useStepFlow(STEPS, 'scan'));

    expect(result.current.step).toBe('scan');
    expect(result.current.index).toBe(1);
    expect(result.current.total).toBe(3);
  });

  /* 라우터 이력에는 화면 하나뿐이다. 이것이 없으면 뒤로가기 한 번에 작업 목록까지 나간다. */
  it('단말의 뒤로가기가 화면을 나가기 전에 앞 단계로 돌아간다', () => {
    const { result } = renderHook(() => useStepFlow(STEPS, 'scan'));

    act(() => {
      result.current.go('line');
    });
    act(() => {
      result.current.go('qty');
    });

    act(() => {
      expect(runBackStep()).toBe(true);
    });
    expect(result.current.step).toBe('line');

    act(() => {
      expect(runBackStep()).toBe(true);
    });
    expect(result.current.step).toBe('scan');

    /* 첫 단계에서는 받지 않는다 - 셸이 이력으로 넘긴다. */
    expect(runBackStep()).toBe(false);
  });

  /* 고를 것이 하나뿐이라 건너뛴 단계로 돌아가면 그 단계가 다시 건너뛰며 제자리를 돈다. */
  it('건너뛴 단계가 아니라 지나온 단계로 돌아간다', () => {
    const { result } = renderHook(() => useStepFlow(STEPS, 'scan'));

    act(() => {
      result.current.go('qty');
    });
    act(() => {
      result.current.back();
    });

    expect(result.current.step).toBe('scan');
  });

  it('처음으로 돌리면 지나온 길도 지운다', () => {
    const { result } = renderHook(() => useStepFlow(STEPS, 'scan'));

    act(() => {
      result.current.go('line');
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe('scan');
    expect(runBackStep()).toBe(false);
  });

  it('단계 구획은 지시를 제목으로, 몇 번째인지 함께 보인다', () => {
    render(<StepSection title="자재 LOT 라벨을 스캔하세요" index={1} total={3} />);

    expect(screen.getByRole('region', { name: '자재 LOT 라벨을 스캔하세요' })).toHaveTextContent(
      '단계 1/3',
    );
  });
});
