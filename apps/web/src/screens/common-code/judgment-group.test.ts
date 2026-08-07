import { describe, expect, it } from 'vitest';

import {
  JUDGMENT_TYPE_GROUP_CODE,
  KNOWN_JUDGMENT_TYPE_CODES,
  findJudgmentTypeGroup,
  isProvisionalJudgmentTypeList,
} from './judgment-group';
import type { CodeGroup } from './types';

/**
 * 판정유형 코드 그룹을 고르는 규칙의 단위 검사(W-06-04 · omf-mes-client#16).
 *
 * **픽스처의 그룹코드를 상수에서 만든다.** 상수 값은 아직 확정되지 않아 한 줄로 바뀔 수 있는데,
 * 값을 테스트에 다시 적으면 상수만 바뀌었을 때 「부분 일치」 픽스처가 부분 일치가 아니게 되어
 * 검사가 조용히 무력해진다.
 *
 * 값은 전부 지어낸 합성값이다(`SYN-` 계열).
 */

/** 대소문자를 뒤집는다. 「대소문자만 다른 그룹코드」를 상수에서 만들어 내는 유일한 방법이다. */
const swapCase = (value: string): string =>
  [...value]
    .map((char) => (char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase()))
    .join('');

const group = (codeGroupId: number, groupCode: string, overrides: Partial<CodeGroup> = {}) =>
  ({
    codeGroupId,
    groupCode,
    groupName: `합성 코드그룹 ${String(codeGroupId)}`,
    description: null,
    isActive: true,
    ...overrides,
  }) satisfies CodeGroup;

/** 상수를 앞에 담은 것 · 뒤에 담은 것. 부분 검색(`q`)이 실제로 함께 돌려주는 모양이다. */
const PREFIXED = group(1101, `SYN-${JUDGMENT_TYPE_GROUP_CODE}`);
const SUFFIXED = group(1102, `${JUDGMENT_TYPE_GROUP_CODE}-SYN`);
const CASE_FOLDED = group(1103, swapCase(JUDGMENT_TYPE_GROUP_CODE));
const NAME_ONLY = group(1104, 'SYN-GRP-90', { groupName: JUDGMENT_TYPE_GROUP_CODE });
const EXACT = group(1105, JUDGMENT_TYPE_GROUP_CODE);

describe('findJudgmentTypeGroup', () => {
  it('그룹코드가 정확히 일치하는 그룹을 고른다', () => {
    expect(findJudgmentTypeGroup([EXACT])).toBe(EXACT);
  });

  it('상수를 앞뒤에 담기만 한 그룹코드는 다른 그룹이다', () => {
    expect(findJudgmentTypeGroup([PREFIXED, SUFFIXED])).toBeNull();
  });

  it('대소문자가 다르면 다른 그룹이다', () => {
    /* 상수가 대소문자를 갖지 않으면 이 검사가 무의미해진다 — 먼저 그 전제를 확인한다. */
    expect(CASE_FOLDED.groupCode).not.toBe(JUDGMENT_TYPE_GROUP_CODE);
    expect(findJudgmentTypeGroup([CASE_FOLDED])).toBeNull();
  });

  it('그룹명이 상수와 같아도 판정 근거가 아니다', () => {
    expect(findJudgmentTypeGroup([NAME_ONLY])).toBeNull();
  });

  it('일치 항목이 첫 번째가 아니어도 그것을 고른다', () => {
    expect(findJudgmentTypeGroup([PREFIXED, NAME_ONLY, EXACT, SUFFIXED])).toBe(EXACT);
  });

  it('일치하는 그룹이 없으면 첫 항목을 쓰지 않는다', () => {
    expect(findJudgmentTypeGroup([PREFIXED, SUFFIXED, CASE_FOLDED, NAME_ONLY])).toBeNull();
  });

  it('목록이 0건이면 아무것도 고르지 않는다', () => {
    expect(findJudgmentTypeGroup([])).toBeNull();
  });

  it('미사용 그룹도 고른다 — 사용 여부는 판정 근거가 아니다', () => {
    const inactive = group(1106, JUDGMENT_TYPE_GROUP_CODE, { isActive: false });

    expect(findJudgmentTypeGroup([inactive])).toBe(inactive);
  });
});

describe('판정유형 자리표시 상수', () => {
  it('비어 있다 — 값을 지어내지 않는다', () => {
    expect(KNOWN_JUDGMENT_TYPE_CODES).toHaveLength(0);
  });

  it('상수가 비어 있는 동안 임시 목록이다', () => {
    expect(isProvisionalJudgmentTypeList()).toBe(true);
  });
});
