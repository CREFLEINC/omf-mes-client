import { describe, expect, it } from 'vitest';

import { codeLabel, SUBSTITUTE_LOT_REASON_GROUP, toCodeOptions } from './code-options';
import { lotReasonFixtures } from './fixtures';

/* 순서를 섞고 쓰지 않는 값을 하나 끼운다 — 거르기와 정렬을 함께 잰다. */
const mixedValues = [
  ...lotReasonFixtures.slice().reverse(),
  {
    codeValueId: 9803,
    codeGroupId: 98,
    code: 'LABEL_DAMAGED',
    codeName: '라벨 훼손',
    isActive: false,
    displayOrder: 20,
  },
];

describe('toCodeOptions — 코드 사전을 선택지로', () => {
  it('쓰는 값만 표시 순서대로, 이름으로 낸다', () => {
    expect(toCodeOptions(mixedValues)).toEqual([
      { value: 'NO_LABEL', label: '라벨 없음' },
      { value: 'OTHER', label: '기타' },
    ]);
  });

  it('아직 받지 못했으면 비어 있다', () => {
    expect(toCodeOptions(undefined)).toEqual([]);
  });
});

describe('codeLabel', () => {
  it('목록에 있으면 이름, 없으면 코드 그대로', () => {
    const options = toCodeOptions(lotReasonFixtures);

    expect(codeLabel(options, 'OTHER')).toBe('기타');
    expect(codeLabel(options, 'UNKNOWN_CODE')).toBe('UNKNOWN_CODE');
  });
});

describe('코드 그룹 — 채번 식별자가 아니라 그룹 코드로 부른다', () => {
  it('대체 LOT 사유 그룹 코드가 계약의 이름이다', () => {
    expect(SUBSTITUTE_LOT_REASON_GROUP).toBe('SUBSTITUTE_LOT_REASON');
  });
});
