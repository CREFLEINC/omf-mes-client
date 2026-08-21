import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  GROUP_TYPE_OPTIONS,
  PENDING_CODE_VALUE,
  ensureOption,
  groupTypeLabel,
  lookupLabel,
  selectableOptions,
} from './code-options';
import type { LookupEntry } from './types';

const entries: LookupEntry[] = [
  { value: '11', label: '제1공장', isActive: true },
  { value: '12', label: '제2공장', isActive: false },
];

describe('자리표시 선택지', () => {
  /*
   * 값 목록이 확정되지 않은 코드는 값을 지어내지 않는다. 물리 모델에 값이 있어도
   * 고객사가 자기 분류 체계를 정해야 하는 값이라 그것을 선택지로 내면 안 된다.
   */
  it('그룹유형은 자리표시 하나만 낸다', () => {
    expect(GROUP_TYPE_OPTIONS).toHaveLength(1);
    expect(GROUP_TYPE_OPTIONS[0]?.value).toBe(PENDING_CODE_VALUE);
    expect(GROUP_TYPE_OPTIONS[0]?.label).toBe(messages.pendingCode.placeholder);
  });
});

describe('groupTypeLabel', () => {
  /*
   * 값 목록이 확정되지 않아 서버가 준 코드는 어느 것도 선택지에 없다.
   * 그때 「알 수 없음」으로 그리면 모르는 값과 없는 값이 같은 모양이 된다(G-9).
   */
  it('선택지에 없는 코드는 코드를 그대로 보인다', () => {
    expect(groupTypeLabel('LINE')).toBe('LINE');
    expect(groupTypeLabel('WORK_AREA')).toBe('WORK_AREA');
  });

  it('자리표시 값은 자리표시 문구로 보인다', () => {
    expect(groupTypeLabel(PENDING_CODE_VALUE)).toBe(messages.pendingCode.placeholder);
  });
});

describe('ensureOption', () => {
  it('목록에 없는 현재 값은 코드 그대로 덧붙인다', () => {
    const result = ensureOption([{ value: 'A', label: '가' }], 'B');

    expect(result).toEqual([
      { value: 'A', label: '가' },
      { value: 'B', label: 'B' },
    ]);
  });

  it('고르지 않음(빈 문자열)에는 아무것도 덧붙이지 않는다', () => {
    const options = [{ value: 'A', label: '가' }];

    expect(ensureOption(options, '')).toBe(options);
  });

  it('이미 있는 값에는 덧붙이지 않는다', () => {
    const options = [{ value: 'A', label: '가' }];

    expect(ensureOption(options, 'A')).toBe(options);
  });
});

describe('selectableOptions', () => {
  it('기본은 사용 중인 것만 낸다', () => {
    expect(selectableOptions(entries, '')).toEqual([{ value: '11', label: '제1공장' }]);
  });

  /*
   * 미사용 값을 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
   * 남기되 미사용이라는 사실을 라벨에 밝힌다.
   */
  it('지금 고른 값이 미사용이면 남기고 라벨에 표식을 붙인다', () => {
    expect(selectableOptions(entries, '12')).toEqual([
      { value: '11', label: '제1공장' },
      { value: '12', label: `제2공장${messages.equipmentMaster.values.inactiveSuffix}` },
    ]);
  });

  it('목록에 아예 없는 값도 코드 그대로 남긴다', () => {
    expect(selectableOptions(entries, '99')).toEqual([
      { value: '11', label: '제1공장' },
      { value: '99', label: '99' },
    ]);
  });
});

describe('lookupLabel', () => {
  it('선택 목록에서 이름을 푼다', () => {
    expect(lookupLabel(entries, '11')).toBe('제1공장');
  });

  /* 못 찾은 값을 「알 수 없음」으로 그리면 없는 값과 구분되지 않는다(G-9). */
  it('못 찾으면 코드를 그대로 보인다', () => {
    expect(lookupLabel(entries, '77')).toBe('77');
  });

  /* 좁혀 받은 선택지가 아니라 전체에서 찾아야 미사용 공장의 이름도 나온다. */
  it('미사용 항목의 이름도 푼다', () => {
    expect(lookupLabel(entries, '12')).toBe('제2공장');
  });
});
