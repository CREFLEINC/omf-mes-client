import { describe, expect, it } from 'vitest';

import { canChooseDisposition, settleDisposition } from './disposition';

describe('canChooseDisposition — 불합격이 있어야 고른다', () => {
  it('불합격이 있으면 고를 수 있다', () => {
    expect(canChooseDisposition(2_000_000n)).toBe(true);
  });

  it('불합격이 0이면 고를 수 없다 — 무엇에 대한 처분인지가 없다', () => {
    expect(canChooseDisposition(0n)).toBe(false);
  });

  it('셀 수 없으면 고를 수 없다 — 화면이 모르는 것이지 0인 것이 아니다', () => {
    expect(canChooseDisposition(null)).toBe(false);
  });
});

describe('settleDisposition — 고를 수 없게 되면 거둔다', () => {
  it('불합격이 0으로 바뀌면 앞서 고른 값이 남지 않는다', () => {
    expect(settleDisposition('SCRAP', 0n)).toBeNull();
  });

  it('셀 수 없게 되어도 거둔다', () => {
    expect(settleDisposition('REWORK', null)).toBeNull();
  });

  it('불합격이 그대로 있으면 고른 값을 지키지 않고 지우지도 않는다', () => {
    expect(settleDisposition('REWORK', 1_000_000n)).toBe('REWORK');
  });

  it('고르지 않은 상태는 그대로 고르지 않은 상태다', () => {
    expect(settleDisposition(null, 1_000_000n)).toBeNull();
  });
});
