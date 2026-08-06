import { describe, expect, it } from 'vitest';

import {
  codeValueToFormValues,
  emptyCodeValueFormValues,
  isSameCodeValueValues,
  toCodeValueCreate,
  toCodeValueUpdate,
} from './code-value-mappers';
import type { CodeValueFormValues } from './code-value-types';
import { codeValueFixtures } from './fixtures';

const values = (overrides: Partial<CodeValueFormValues> = {}): CodeValueFormValues => ({
  code: 'SYN-CV-01',
  codeName: '합성 코드값 A',
  displayOrder: '10',
  effectiveFrom: '2026-07-01',
  effectiveTo: '2026-12-31',
  ...overrides,
});

describe('codeValueToFormValues', () => {
  it('계약 표현을 폼 값으로 옮긴다', () => {
    expect(codeValueToFormValues(codeValueFixtures[0]!)).toEqual({
      code: 'SYN-CV-01',
      codeName: '합성 코드값 A',
      displayOrder: '30',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-12-31',
    });
  });

  /* 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다. */
  it('유효기간이 널이면 빈 문자열이 된다', () => {
    const form = codeValueToFormValues(codeValueFixtures[1]!);

    expect(form.effectiveFrom).toBe('');
    expect(form.effectiveTo).toBe('');
  });

  /* 0은 「지정하지 않음」이 아니라 계약의 기본값이다 — 빈 칸으로 뭉개면 안 된다. */
  it('정렬 순서 0을 빈 값으로 뭉개지 않는다', () => {
    expect(codeValueToFormValues({ ...codeValueFixtures[0]!, displayOrder: 0 }).displayOrder).toBe(
      '0',
    );
  });
});

describe('emptyCodeValueFormValues', () => {
  /* 계약의 기본값이 0이다 — 화면이 그것을 먼저 보여야 사용자가 무엇이 저장될지 안다. */
  it('등록 폼은 정렬 순서만 계약 기본값으로 시작한다', () => {
    expect(emptyCodeValueFormValues()).toEqual({
      code: '',
      codeName: '',
      displayOrder: '0',
      effectiveFrom: '',
      effectiveTo: '',
    });
  });
});

describe('toCodeValueUpdate', () => {
  it('앞뒤 공백을 턴 값과 숫자로 옮긴 정렬 순서를 보낸다', () => {
    expect(toCodeValueUpdate(values({ code: ' SYN-CV-01 ', codeName: ' 합성 A ' }))).toEqual({
      code: 'SYN-CV-01',
      codeName: '합성 A',
      displayOrder: 10,
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-12-31',
    });
  });

  it('음수 정렬 순서도 그대로 보낸다 — 계약에 하한이 없다', () => {
    expect(toCodeValueUpdate(values({ displayOrder: '-5' })).displayOrder).toBe(-5);
  });

  /* 키를 빼면 서버가 이전 값을 남길 수 있다 — 한 번 넣은 유효기간을 지울 방법이 사라진다. */
  it('유효기간을 비우면 널을 명시해 보낸다', () => {
    const body = toCodeValueUpdate(values({ effectiveFrom: '', effectiveTo: '' }));

    expect(body.effectiveFrom).toBeNull();
    expect(body.effectiveTo).toBeNull();
  });

  /* C32 — 수정으로 그룹을 바꿀 수 없고, 사용 여부는 :deactivate로만 바뀐다. */
  it('본문에 codeGroupId·isActive·codeValueId를 싣지 않는다', () => {
    const body = toCodeValueUpdate(values());

    expect('codeGroupId' in body).toBe(false);
    expect('isActive' in body).toBe(false);
    expect('codeValueId' in body).toBe(false);
    expect(Object.keys(body).sort()).toEqual([
      'code',
      'codeName',
      'displayOrder',
      'effectiveFrom',
      'effectiveTo',
    ]);
  });
});

describe('toCodeValueCreate', () => {
  /* C37 — 좌측에서 고른 그룹으로 고정된다. 빼면 서버가 어느 그룹에 넣을지 알 수 없다. */
  it('등록 본문에는 고른 코드그룹 번호가 실린다', () => {
    expect(toCodeValueCreate(1001, values()).codeGroupId).toBe(1001);
  });

  it('등록 본문에도 isActive·codeValueId를 싣지 않는다 — 신규는 항상 사용 중이다', () => {
    const body = toCodeValueCreate(1001, values());

    expect('isActive' in body).toBe(false);
    expect('codeValueId' in body).toBe(false);
  });

  it('나머지 항목은 수정 본문과 같다', () => {
    const { codeGroupId: _codeGroupId, ...rest } = toCodeValueCreate(1001, values());

    expect(rest).toEqual(toCodeValueUpdate(values()));
  });
});

describe('isSameCodeValueValues', () => {
  it('다섯 값이 모두 같으면 같다고 본다', () => {
    expect(isSameCodeValueValues(values(), values())).toBe(true);
  });

  it('한 값이라도 다르면 다르다고 본다', () => {
    expect(isSameCodeValueValues(values(), values({ displayOrder: '20' }))).toBe(false);
    expect(isSameCodeValueValues(values(), values({ effectiveTo: '' }))).toBe(false);
    expect(isSameCodeValueValues(values(), values({ code: 'SYN-CV-02' }))).toBe(false);
  });
});
