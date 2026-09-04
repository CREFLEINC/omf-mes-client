import { describe, expect, it } from 'vitest';

import { readTargetId, TARGET_KEY } from './target';

const paramsOf = (query: string): URLSearchParams => new URLSearchParams(query);

describe('readTargetId — 진입 인자에서 대상을 읽는다', () => {
  it('식별자를 읽는다', () => {
    expect(readTargetId(paramsOf(`${TARGET_KEY}=1001`))).toBe(1001);
  });

  it('인자가 없으면 대상이 없다 — 이 화면은 대상 없이도 서고 안내를 그린다', () => {
    expect(readTargetId(paramsOf(''))).toBeNull();
  });

  it.each(['0', '-1', '1.5', 'abc', '', '1e3'])('식별자가 아닌 값(%s)은 대상이 아니다', (raw) => {
    expect(readTargetId(paramsOf(`${TARGET_KEY}=${raw}`))).toBeNull();
  });

  /*
   * ⛔ 0 을 통과시키면 「0번 의뢰」를 부르는 요청이 나간다 — 계약에 그런 자원이 없고 서버가
   * 무엇을 돌려줄지 정해져 있지 않다.
   */
  it('0 은 어떤 자원도 가리키지 않는다', () => {
    expect(readTargetId(paramsOf(`${TARGET_KEY}=0`))).toBeNull();
  });
});
