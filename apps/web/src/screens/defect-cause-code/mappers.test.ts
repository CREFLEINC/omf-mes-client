import { describe, expect, it } from 'vitest';

import { causeCodeAdapter, defectCodeAdapter } from './adapters';
import { causeCodeFixtures, defectCodeFixtures } from './fixtures';
import {
  causeToHierarchyCode,
  defectToHierarchyCode,
  emptyCodeFormValues,
  isSameCodeValues,
  toFormFieldErrors,
  toServerFieldName,
  toWritePayload,
} from './mappers';

describe('defectToHierarchyCode', () => {
  it('계약 필드 이름을 화면 표현으로 옮긴다', () => {
    expect(defectToHierarchyCode(defectCodeFixtures[1]!)).toEqual({
      id: 1002,
      code: 'DF-11',
      name: '스크래치',
      parentId: 1001,
      isActive: true,
    });
  });

  it('상위가 null이면 대분류다', () => {
    expect(defectToHierarchyCode(defectCodeFixtures[0]!).parentId).toBeNull();
  });

  it('상위 키가 아예 없어도 대분류로 다룬다', () => {
    const raw = { defectCodeId: 1, defectCode: 'A', defectName: '가', isActive: true };

    expect(defectToHierarchyCode(raw).parentId).toBeNull();
  });

  /*
   * 목 서버가 실제로 내려주는 모양이다. 부모-자식으로 세면 「하위가 있는데 열 수 없는」 행이 생긴다.
   */
  it('자기 자신을 상위로 가리키면 대분류로 접는다', () => {
    const folded = defectToHierarchyCode(defectCodeFixtures[3]!);

    expect(folded.id).toBe(1004);
    expect(folded.parentId).toBeNull();
  });

  it('상위가 목록에 없는 번호여도 그 번호를 그대로 들고 있는다 — 고아 판정은 목록이 한다', () => {
    expect(defectToHierarchyCode(defectCodeFixtures[6]!).parentId).toBe(1900);
  });

  it('미사용 여부를 그대로 옮긴다', () => {
    expect(defectToHierarchyCode(defectCodeFixtures[5]!).isActive).toBe(false);
  });
});

describe('causeToHierarchyCode', () => {
  it('원인 코드도 같은 화면 표현으로 옮긴다', () => {
    expect(causeToHierarchyCode(causeCodeFixtures[1]!)).toEqual({
      id: 2002,
      code: 'CS-11',
      name: '금형 마모',
      parentId: 2001,
      isActive: true,
    });
  });

  it('원인 코드도 자기참조를 대분류로 접는다', () => {
    const raw = {
      causeCodeId: 2009,
      causeCode: 'CS-99',
      causeName: '자기참조',
      parentCauseCodeId: 2009,
      isActive: true,
    };

    expect(causeToHierarchyCode(raw).parentId).toBeNull();
  });
});

describe('emptyCodeFormValues', () => {
  it('대분류 등록은 상위가 비어 있다', () => {
    expect(emptyCodeFormValues()).toEqual({ code: '', name: '', parentId: '' });
  });

  it('상세 등록은 고른 대분류가 상위로 채워진다', () => {
    expect(emptyCodeFormValues('1001').parentId).toBe('1001');
  });
});

describe('isSameCodeValues', () => {
  it('세 값이 모두 같아야 같다고 본다', () => {
    const values = { code: 'DF-10', name: '외관', parentId: '' };

    expect(isSameCodeValues(values, { ...values })).toBe(true);
    expect(isSameCodeValues(values, { ...values, name: '외관 불량' })).toBe(false);
    expect(isSameCodeValues(values, { ...values, parentId: '1001' })).toBe(false);
  });
});

describe('toWritePayload', () => {
  it('앞뒤 공백을 떼어 낸다 — 눈으로 구분되지 않는 다른 코드가 되면 안 된다', () => {
    const payload = toWritePayload({ code: '  DF-10 ', name: ' 외관 ', parentId: '' }, null);

    expect(payload.code).toBe('DF-10');
    expect(payload.name).toBe('외관');
  });

  it('상위가 비어 있으면 대분류다', () => {
    expect(toWritePayload({ code: 'A', name: '가', parentId: '' }, null).parentId).toBeNull();
  });

  it('상위 문자열을 숫자로 옮긴다', () => {
    expect(toWritePayload({ code: 'A', name: '가', parentId: '1001' }, null).parentId).toBe(1001);
  });

  /*
   * 화면에 입력칸이 없는 값이다. 수정은 전체 치환이라 빠뜨리면 서버에 저장돼 있던 값이
   * 조용히 지워진다 — 화면에 없는 값이 소리 없이 사라지는 것이 가장 나쁜 결과다.
   */
  it('보존해야 할 공정 번호를 그대로 들고 간다', () => {
    expect(toWritePayload({ code: 'A', name: '가', parentId: '' }, 3001).processId).toBe(3001);
    expect(toWritePayload({ code: 'A', name: '가', parentId: '' }, null).processId).toBeNull();
  });
});

describe('toFormFieldErrors · toServerFieldName', () => {
  it('서버 필드 이름을 폼 필드 이름으로 옮긴다', () => {
    const errors = toFormFieldErrors(
      {
        defectCode: '이미 사용 중인 코드입니다.',
        defectName: '명칭을 입력하세요.',
        parentDefectCodeId: '상위가 올바르지 않습니다.',
      },
      defectCodeAdapter.serverFields,
    );

    expect(errors).toEqual({
      code: '이미 사용 중인 코드입니다.',
      name: '명칭을 입력하세요.',
      parentId: '상위가 올바르지 않습니다.',
    });
  });

  it('원인 코드의 필드 이름도 같은 폼 필드로 옮긴다', () => {
    const errors = toFormFieldErrors({ causeCode: '중복' }, causeCodeAdapter.serverFields);

    expect(errors).toEqual({ code: '중복' });
  });

  /* 화면이 모르는 이름은 여기서 버리지 않는다 — useMasterWrite가 배너로 올린다. */
  it('화면이 모르는 필드 이름은 폼 필드로 옮기지 않는다', () => {
    expect(toFormFieldErrors({ 문자열: '알 수 없는 오류' }, defectCodeAdapter.serverFields)).toEqual(
      {},
    );
  });

  it('폼 필드 이름을 서버 필드 이름으로 되돌린다', () => {
    expect(toServerFieldName('code', defectCodeAdapter.serverFields)).toBe('defectCode');
    expect(toServerFieldName('name', defectCodeAdapter.serverFields)).toBe('defectName');
    expect(toServerFieldName('parentId', causeCodeAdapter.serverFields)).toBe('parentCauseCodeId');
  });
});
