import { describe, expect, it } from 'vitest';

import { toTransitionPreview } from './transition-preview';

describe('toTransitionPreview', () => {
  it('셀 수 없으면 null 이다 — 경고가 거짓 숫자를 근거로 쓰기를 권하지 않게', () => {
    expect(
      toTransitionPreview({ accepted: 'abc', rejected: '15', held: '5' }, 'ACCEPTED', 500),
    ).toBeNull();
  });

  it('지금 친 값을 그대로 되읽고 방향을 함께 싣는다', () => {
    expect(
      toTransitionPreview({ accepted: '480', rejected: '15', held: '5' }, 'ACCEPTED', 500),
    ).toEqual({ accepted: '480', rejected: '15', held: '5', direction: 'release' });
  });

  it('빈 칸은 0으로 읽는다 — 「비었다」와 「0이다」는 계약에서 같은 값이다', () => {
    expect(toTransitionPreview({ accepted: '500', rejected: '', held: '' }, 'HELD', 500)).toEqual({
      accepted: '500',
      rejected: '0',
      held: '0',
      direction: 'pending',
    });
  });

  it('합계가 어긋나도 그린다 — 막는 것은 저장 버튼이고 이 경고는 미리 보이는 것이다', () => {
    expect(
      toTransitionPreview({ accepted: '480', rejected: '15', held: '' }, 'REJECTED', 500),
    ).not.toBeNull();
  });

  it('모르는 판정 코드에는 방향을 지어내지 않는다', () => {
    expect(
      toTransitionPreview({ accepted: '500', rejected: '0', held: '0' }, 'SOMETHING_NEW', 500)
        ?.direction,
    ).toBe('unknown');
  });
});
