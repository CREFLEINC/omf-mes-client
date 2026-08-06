import { describe, expect, it } from 'vitest';

import {
  codeGroupToFormValues,
  emptyCodeGroupFormValues,
  isSameCodeGroupValues,
  toCodeGroupCreate,
  toCodeGroupUpdate,
} from './code-group-mappers';
import { codeGroupFixtures } from './fixtures';
import type { CodeGroupFormValues } from './types';

const values = (overrides: Partial<CodeGroupFormValues> = {}): CodeGroupFormValues => ({
  groupCode: 'SYN-GRP-01',
  groupName: '합성 코드그룹 A',
  description: '합성 설명 A',
  ...overrides,
});

describe('codeGroupToFormValues', () => {
  it('계약 표현을 폼 값으로 옮긴다', () => {
    expect(codeGroupToFormValues(codeGroupFixtures[0]!)).toEqual({
      groupCode: 'SYN-GRP-01',
      groupName: '합성 코드그룹 A',
      description: '합성 설명 A',
    });
  });

  /* 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다. */
  it('설명이 널이면 빈 문자열이 된다', () => {
    expect(codeGroupToFormValues(codeGroupFixtures[1]!).description).toBe('');
  });
});

describe('emptyCodeGroupFormValues', () => {
  it('등록 폼은 전부 비어서 시작한다 — 서버가 채우는 값을 미리 지어내지 않는다', () => {
    expect(emptyCodeGroupFormValues()).toEqual({
      groupCode: '',
      groupName: '',
      description: '',
    });
  });
});

describe('toCodeGroupUpdate', () => {
  it('앞뒤 공백을 턴 값을 보낸다 — 눈으로 구분되지 않는 다른 값이 저장되면 안 된다', () => {
    expect(
      toCodeGroupUpdate(values({ groupCode: '  SYN-GRP-01 ', groupName: ' 합성 A ' })),
    ).toEqual({
      groupCode: 'SYN-GRP-01',
      groupName: '합성 A',
      description: '합성 설명 A',
    });
  });

  /*
   * 키를 빼면 서버가 이전 값을 남길 수 있다 — 설명을 지울 방법이 사라진다.
   * 널을 명시해 보낸다.
   */
  it('설명을 비우면 널을 명시해 보낸다', () => {
    const body = toCodeGroupUpdate(values({ description: '' }));

    expect(body.description).toBeNull();
    expect('description' in body).toBe(true);
  });

  /* C17 — 사용 여부는 :deactivate로만 바뀌고 번호는 경로에 있다. */
  it('본문에 isActive·codeGroupId를 싣지 않는다', () => {
    const body = toCodeGroupUpdate(values());

    expect('isActive' in body).toBe(false);
    expect('codeGroupId' in body).toBe(false);
    expect(Object.keys(body).sort()).toEqual(['description', 'groupCode', 'groupName']);
  });
});

describe('toCodeGroupCreate', () => {
  it('수정과 같은 항목을 보낸다 — 계약이 두 본문을 같게 정의했다', () => {
    expect(toCodeGroupCreate(values())).toEqual(toCodeGroupUpdate(values()));
  });

  it('등록 본문에도 isActive를 싣지 않는다 — 신규는 항상 사용 중이다', () => {
    expect('isActive' in toCodeGroupCreate(values())).toBe(false);
  });
});

describe('isSameCodeGroupValues', () => {
  it('세 값이 모두 같으면 같다고 본다', () => {
    expect(isSameCodeGroupValues(values(), values())).toBe(true);
  });

  it('한 값이라도 다르면 다르다고 본다', () => {
    expect(isSameCodeGroupValues(values(), values({ groupName: '다른 이름' }))).toBe(false);
    expect(isSameCodeGroupValues(values(), values({ description: '' }))).toBe(false);
    expect(isSameCodeGroupValues(values(), values({ groupCode: 'SYN-GRP-02' }))).toBe(false);
  });
});
