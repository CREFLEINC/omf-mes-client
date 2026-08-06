import { describe, expect, it } from 'vitest';

import { CODE_GROUP_FORM_FIELDS, validateCodeGroupForm } from './code-group-validation';
import type { CodeGroupFormValues } from './types';

const values = (overrides: Partial<CodeGroupFormValues> = {}): CodeGroupFormValues => ({
  groupCode: 'SYN-GRP-01',
  groupName: '합성 코드그룹 A',
  description: '',
  ...overrides,
});

describe('CODE_GROUP_FORM_FIELDS', () => {
  it('폼이 소유한 입력칸 이름을 계약 이름 그대로 담는다', () => {
    expect(CODE_GROUP_FORM_FIELDS).toEqual(['groupCode', 'groupName', 'description']);
  });
});

describe('validateCodeGroupForm', () => {
  it('제대로 채우면 오류가 없다', () => {
    expect(validateCodeGroupForm(values())).toEqual({});
  });

  it('필수 항목이 비면 막는다', () => {
    const errors = validateCodeGroupForm(values({ groupCode: '', groupName: '' }));

    expect(errors.groupCode).toBe('필수 입력 항목입니다.');
    expect(errors.groupName).toBe('필수 입력 항목입니다.');
  });

  /* 눈으로 구분되지 않는 다른 값이 저장되면 중복 판정이 어긋난다. */
  it('공백만 넣은 필수 항목도 막는다', () => {
    const errors = validateCodeGroupForm(values({ groupCode: '   ', groupName: '\t ' }));

    expect(errors.groupCode).toBe('그룹코드는 공백만으로 지정할 수 없습니다.');
    expect(errors.groupName).toBe('그룹명은 공백만으로 지정할 수 없습니다.');
  });

  it('그룹코드가 50자를 넘으면 막는다', () => {
    expect(validateCodeGroupForm(values({ groupCode: 'A'.repeat(51) })).groupCode).toBe(
      '그룹코드는 50자를 넘을 수 없습니다.',
    );
  });

  it('그룹코드가 50자면 막지 않는다 — 상한은 허용값이다', () => {
    expect(validateCodeGroupForm(values({ groupCode: 'A'.repeat(50) })).groupCode).toBeUndefined();
  });

  it('그룹명이 200자를 넘으면 막는다', () => {
    expect(validateCodeGroupForm(values({ groupName: '가'.repeat(201) })).groupName).toBe(
      '그룹명은 200자를 넘을 수 없습니다.',
    );
  });

  it('그룹명이 200자면 막지 않는다', () => {
    expect(
      validateCodeGroupForm(values({ groupName: '가'.repeat(200) })).groupName,
    ).toBeUndefined();
  });

  /* 저장되는 값은 앞뒤 공백을 턴 값이다 — 길이도 그 값으로 센다. */
  it('길이는 앞뒤 공백을 턴 값으로 센다', () => {
    expect(
      validateCodeGroupForm(values({ groupCode: `  ${'A'.repeat(50)}  ` })).groupCode,
    ).toBeUndefined();
  });

  /* 계약이 널을 허용한다 — 비우는 것이 정상 값이다. */
  it('설명은 비어도 막지 않는다', () => {
    expect(validateCodeGroupForm(values({ description: '' })).description).toBeUndefined();
  });

  /*
   * 코드 중복은 검사하지 않는다 — 계약이 그 판정을 서버 몫으로 두었고(전역 유일 제약),
   * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
   */
  it('코드 중복을 화면이 판정하지 않는다', () => {
    expect(validateCodeGroupForm(values({ groupCode: 'SYN-GRP-01' }))).toEqual({});
  });
});
