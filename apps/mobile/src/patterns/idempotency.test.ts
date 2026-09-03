import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useIdempotencyKey } from './idempotency';

const mount = (target?: string | number | null) =>
  renderHook(({ value }: { value?: string | number | null }) => useIdempotencyKey(value), {
    initialProps: { value: target },
  });

describe('한 번의 확정에 붙는 멱등키', () => {
  /*
   * 보낼 때마다 새로 만들면 멱등키가 아무것도 막지 못한다 - 서버가 기록한 뒤 응답이 유실되면
   * 화면은 실패로 보이고, 다시 보내면 새 키라 서버가 같은 일을 한 번 더 한다.
   */
  it('같은 대상이면 같은 키를 준다', () => {
    const { result } = mount('7:120');

    expect(result.current.current()).toBe(result.current.current());
  });

  /*
   * 다른 것을 적기 시작했는데 앞 키를 그대로 들고 가면 서버가 그것을 앞 시도로 보고 흡수한다 -
   * 화면은 기록했다고 말하는데 아무것도 기록되지 않는다.
   */
  it('대상이 바뀌면 새 키로 간다', () => {
    const { result, rerender } = mount('7:120');
    const first = result.current.current();

    rerender({ value: '8:120' });

    expect(result.current.current()).not.toBe(first);
  });

  /*
   * 견주는 시점은 직전 렌더가 아니라 키를 만든 때다. 직전 렌더와 견주면 값이 잠깐 달라졌다
   * 돌아왔을 때 키가 이미 버려져 있어, 같은 것을 다시 보내는데 새 키로 간다 - 막으려던
   * 중복이 그대로 난다.
   */
  it('대상이 잠깐 달라졌다 돌아오면 같은 키를 준다', () => {
    const { result, rerender } = mount('7:120');
    const first = result.current.current();

    rerender({ value: '8:120' });
    rerender({ value: '7:120' });

    expect(result.current.current()).toBe(first);
  });

  it('비우면 다음 시도는 새 키로 간다', () => {
    const { result } = mount('7:120');
    const first = result.current.current();

    result.current.reset();

    expect(result.current.current()).not.toBe(first);
  });

  /*
   * 대상을 넘기지 않는 화면에서는 비우기가 유일한 방어선이다. 성공 뒤에 비우지 않으면 다음
   * 기록이 앞 시도로 흡수돼 아무것도 남지 않는다.
   */
  it('대상을 넘기지 않으면 비우기로만 갈린다', () => {
    const { result, rerender } = mount();
    const first = result.current.current();

    rerender({ value: undefined });
    expect(result.current.current()).toBe(first);

    result.current.reset();
    expect(result.current.current()).not.toBe(first);
  });

  /* 대상이 null 인 자리와 아직 고르지 않은 자리는 다르다. 뭉치면 고르기 전 키가 흘러간다. */
  it('null 과 넘기지 않은 것을 같은 대상으로 보지 않는다', () => {
    const { result, rerender } = mount(null);
    const first = result.current.current();

    rerender({ value: undefined });

    expect(result.current.current()).not.toBe(first);
  });
});
