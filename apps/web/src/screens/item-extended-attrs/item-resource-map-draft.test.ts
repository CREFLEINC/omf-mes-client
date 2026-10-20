import { describe, expect, it } from 'vitest';

import { itemResourceMapFixtures } from './fixtures';
import {
  createItemResourceMapFormValues,
  isSameItemResourceMapValues,
  rowResourceMapKey,
  resourceMapKeyOf,
  toItemResourceMapCreate,
  toItemResourceMapFormValues,
  toItemResourceMapUpdate,
} from './item-resource-map-draft';

const [withAll, itemCommon] = itemResourceMapFixtures;

describe('설비·금형 매핑 창의 값', () => {
  it('새 창은 비어 있고 우선순위만 서버 기본값과 같다', () => {
    expect(createItemResourceMapFormValues()).toEqual({
      processId: '',
      equipmentId: '',
      moldId: '',
      isDefault: false,
      priorityNo: '100',
      remarks: '',
    });
  });

  it('조회한 줄을 창의 값으로 옮긴다 — 빈 공정·비고는 빈 문자열이다', () => {
    expect(toItemResourceMapFormValues(withAll!)).toEqual({
      processId: '3001',
      equipmentId: '8001',
      moldId: '8501',
      isDefault: true,
      priorityNo: '10',
      remarks: '합성 비고',
    });
    expect(toItemResourceMapFormValues(itemCommon!)).toMatchObject({
      processId: '',
      equipmentId: '',
      moldId: '8502',
      remarks: '',
    });
  });

  it('같은 값이면 고친 것이 없다', () => {
    const values = toItemResourceMapFormValues(withAll!);

    expect(isSameItemResourceMapValues(values, { ...values })).toBe(true);
    expect(isSameItemResourceMapValues(values, { ...values, priorityNo: '11' })).toBe(false);
  });
});

describe('요청 본문', () => {
  it('등록 본문은 공장·품목을 싣고 빈 칸을 널로 옮긴다', () => {
    const body = toItemResourceMapCreate(
      { ...createItemResourceMapFormValues(), moldId: '8502', remarks: '  ' },
      9001,
      1001,
    );

    expect(body).toEqual({
      plantId: 9001,
      itemId: 1001,
      processId: null,
      equipmentId: null,
      moldId: 8502,
      isDefault: false,
      priorityNo: 100,
      remarks: null,
    });
  });

  /* 계약이 「생략 = 유지」라 비운 칸을 빠뜨리면 서버가 옛 값을 남긴다. */
  it('수정 본문은 비운 칸을 생략하지 않고 널로 싣는다', () => {
    const body = toItemResourceMapUpdate({
      ...toItemResourceMapFormValues(withAll!),
      processId: '',
      equipmentId: '',
    });

    expect(body).toEqual({
      processId: null,
      equipmentId: null,
      moldId: 8501,
      isDefault: true,
      priorityNo: 10,
      remarks: '합성 비고',
    });
  });

  it('수정 본문에 공장·품목·사용 여부·식별자가 없다', () => {
    const body = toItemResourceMapUpdate(toItemResourceMapFormValues(withAll!));

    expect(Object.keys(body).sort()).toEqual(
      ['equipmentId', 'isDefault', 'moldId', 'priorityNo', 'processId', 'remarks'].sort(),
    );
  });
});

describe('유일 제약의 판정 키', () => {
  it('조회한 줄과 창의 값이 같은 조합이면 키가 같다', () => {
    expect(rowResourceMapKey(withAll!)).toBe(
      resourceMapKeyOf({ processId: '3001', equipmentId: '8001', moldId: '8501' }),
    );
  });

  /* 계약이 빈 값끼리도 같은 값으로 센다(`NULLS NOT DISTINCT`). */
  it('빈 공정·빈 설비도 키에 든다', () => {
    expect(rowResourceMapKey(itemCommon!)).toBe(
      resourceMapKeyOf({ processId: '', equipmentId: '', moldId: '8502' }),
    );
  });
});
