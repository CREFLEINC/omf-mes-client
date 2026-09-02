import { describe, expect, it } from 'vitest';

import { canSubmit, looksUnusual } from './worker-no';

describe('canSubmit — 길이가 1 이상이면 누른다', () => {
  it('한 글자만 있어도 누를 수 있다', () => {
    expect(canSubmit('9')).toBe(true);
  });

  it('비어 있으면 누를 수 없다', () => {
    expect(canSubmit('')).toBe(false);
    expect(canSubmit('   ')).toBe(false);
  });

  /*
   * ⛔ 자릿수를 여기서 보면 «강제»가 된다 — 5자리 사번이 하나라도 있으면 그 사람이 단말을
   * 못 쓴다. 확인된 표본이 매우 적어 그렇게 두지 않는다.
   */
  it('자릿수가 달라도 누를 수 있다', () => {
    expect(canSubmit('90028')).toBe(true);
    expect(canSubmit('9000281')).toBe(true);
  });
});

describe('looksUnusual — 경고를 띄울지만 정한다', () => {
  it('6자리 숫자는 평범하다', () => {
    expect(looksUnusual('900028')).toBe(false);
  });

  it('자릿수가 다르면 경고한다', () => {
    expect(looksUnusual('90028')).toBe(true);
    expect(looksUnusual('9000281')).toBe(true);
  });

  it('숫자가 아닌 값이 섞이면 경고한다', () => {
    expect(looksUnusual('90002A')).toBe(true);
  });

  /* 치기 시작하자마자 틀렸다고 하면 맞게 치는 사람에게 틀렸다고 하는 셈이다. */
  it('비어 있으면 경고하지 않는다', () => {
    expect(looksUnusual('')).toBe(false);
  });
});
