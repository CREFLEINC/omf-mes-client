import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SORT_KEYS,
  defaultSortKey,
  nextSortKey,
  readSortKey,
  sortableKeysOf,
  toSortQuery,
  toSortState,
} from './sort';
import { VIEW_AXES } from './view-axis';

describe('CONTRACT_SORT_KEYS — 계약 열거값', () => {
  /*
   * 계약의 `sort`는 다섯 값의 열거다. 여기에 없는 열을 보내면 400이고, 여기 있는 값을
   * 빠뜨리면 쓸 수 있는 정렬이 화면에서 사라진다. 목록 자체를 값으로 고정한다.
   */
  it('다섯 값이고 순서가 고정돼 있다', () => {
    expect(CONTRACT_SORT_KEYS).toEqual([
      'itemCode',
      'lotNo',
      'locationCode',
      'onHandQty',
      'availableQty',
    ]);
  });
});

describe('sortableKeysOf — 그 보기의 표에 실제로 있는 열만', () => {
  /*
   * 이슈 #21 §6이 「임의 열 정렬을 열지 마세요」로 못 박았다. 표에 없는 열로 정렬하면
   * 계약은 받지만 정렬 표시가 **어디에도 나타나지 않는 상태**가 된다.
   */
  it('품목별에는 LOT·위치 정렬이 없다', () => {
    expect(sortableKeysOf('item')).toEqual(['itemCode', 'onHandQty', 'availableQty']);
  });

  it('LOT별에는 품목·LOT 정렬이 있고 위치 정렬이 없다', () => {
    expect(sortableKeysOf('lot')).toEqual(['itemCode', 'lotNo', 'onHandQty', 'availableQty']);
  });

  it('위치별에는 위치·품목 정렬이 있고 LOT 정렬이 없다', () => {
    expect(sortableKeysOf('location')).toEqual([
      'locationCode',
      'itemCode',
      'onHandQty',
      'availableQty',
    ]);
  });

  it('어느 보기든 계약 열거값 밖의 열을 열지 않는다', () => {
    for (const view of VIEW_AXES) {
      for (const key of sortableKeysOf(view)) {
        expect(CONTRACT_SORT_KEYS).toContain(key);
      }
    }
  });
});

describe('defaultSortKey — 보기마다의 기본 정렬', () => {
  /*
   * 그룹은 서버가 준 순서에서 처음 나온 차례로 묶인다. 정렬 축이 그룹 축과 다르면
   * 같은 그룹이 흩어져 그룹 헤더가 여러 번 나온다.
   */
  it('그룹 축과 같은 열을 기본으로 둔다', () => {
    expect(defaultSortKey('item')).toBe('itemCode');
    expect(defaultSortKey('lot')).toBe('itemCode');
    expect(defaultSortKey('location')).toBe('locationCode');
  });

  /*
   * **기본 정렬은 그 보기에서 실제로 정렬 가능한 열이어야 한다.** 아니면 사용자가 그 정렬을
   * 풀 수단이 화면에 없고, 정렬 표시도 어디에도 나타나지 않는다.
   */
  it('기본 정렬이 언제나 그 보기의 정렬 가능한 열 안에 있다', () => {
    for (const view of VIEW_AXES) {
      expect(sortableKeysOf(view)).toContain(defaultSortKey(view));
    }
  });
});

describe('readSortKey — 주소가 담은 정렬 열', () => {
  it('그 보기에서 정렬할 수 있는 열을 그대로 읽는다', () => {
    expect(readSortKey('onHandQty', 'item')).toBe('onHandQty');
    expect(readSortKey('lotNo', 'lot')).toBe('lotNo');
    expect(readSortKey('locationCode', 'location')).toBe('locationCode');
  });

  /*
   * **없으면 정렬하지 않는다.** 「없음 → 이 열로 정렬 → 해제」 세 걸음의 첫 자리이며,
   * 없는 것을 기본값으로 읽으면 해제한 상태를 주소로 나타낼 방법이 사라진다.
   */
  it('키가 없으면 정렬하지 않는다', () => {
    expect(readSortKey(null, 'item')).toBeNull();
    expect(readSortKey('', 'item')).toBeNull();
  });

  /* 계약 열거값 밖은 400이 된다. 주소는 손으로 고쳐지는 자리다. */
  it('계약 열거값 밖은 버린다', () => {
    expect(readSortKey('nope', 'item')).toBeNull();
    expect(readSortKey('ITEMCODE', 'item')).toBeNull();
  });

  /* 계약은 받지만 그 보기의 표에 열이 없어 정렬 표시가 나타나지 않는다. */
  it('계약 열거값이어도 그 보기의 열이 아니면 버린다', () => {
    expect(readSortKey('lotNo', 'item')).toBeNull();
    expect(readSortKey('locationCode', 'lot')).toBeNull();
    expect(readSortKey('lotNo', 'location')).toBeNull();
  });
});

describe('nextSortKey — 머리글을 눌렀을 때', () => {
  /* 없음 → 이 열로 정렬 */
  it('정렬이 없을 때 누르면 그 열로 정렬한다', () => {
    expect(nextSortKey(null, { key: 'onHandQty', direction: 'ascending' }, 'item')).toBe(
      'onHandQty',
    );
  });

  /* 다른 열로 옮긴다 */
  it('다른 열을 누르면 그 열로 옮긴다', () => {
    expect(nextSortKey('itemCode', { key: 'availableQty', direction: 'ascending' }, 'item')).toBe(
      'availableQty',
    );
  });

  /*
   * **내림차순 상태로 들어가지 않는다.** 계약이 방향을 받지 않아 내림차순을 표기해도
   * 서버가 그렇게 정렬해 주지 않는다 — 표기와 실제가 어긋나느니 두 상태만 돈다.
   */
  it('같은 열을 다시 누르면 방향이 무엇이든 해제한다', () => {
    expect(
      nextSortKey('onHandQty', { key: 'onHandQty', direction: 'descending' }, 'item'),
    ).toBeNull();
    expect(
      nextSortKey('onHandQty', { key: 'onHandQty', direction: 'ascending' }, 'item'),
    ).toBeNull();
  });

  it('디자인 시스템이 해제를 알려도 해제한다', () => {
    expect(nextSortKey('onHandQty', null, 'item')).toBeNull();
  });

  /* 표에 없는 열은 애초에 머리글이 없지만, 새어 들어와도 계약 밖 값을 만들지 않는다. */
  it('그 보기의 열이 아니면 정렬을 만들지 않는다', () => {
    expect(nextSortKey(null, { key: 'lotNo', direction: 'ascending' }, 'item')).toBeNull();
  });
});

describe('toSortState — 표에 넘기는 제어 정렬 상태', () => {
  /*
   * `aria-sort`는 `ascending`·`descending`·`none` 중 하나여야 해서 「모름」을 표기할 수단이 없다.
   * 계약이 방향을 받지 않으므로 **오름차순으로 표기하고 그 사실을 안내로 밝힌다**.
   */
  it('정렬 열이 있으면 오름차순으로 표기한다', () => {
    expect(toSortState('itemCode')).toEqual({ key: 'itemCode', direction: 'ascending' });
  });

  it('정렬 열이 없으면 표기하지 않는다', () => {
    expect(toSortState(null)).toBeNull();
  });
});

describe('toSortQuery — 계약으로 보내는 값', () => {
  it('열만 싣고 방향을 뜻하는 키를 만들지 않는다', () => {
    const query = toSortQuery('onHandQty');

    expect(query).toEqual({ sort: 'onHandQty' });
    expect(Object.keys(query)).toEqual(['sort']);
  });

  it('정렬이 없으면 키 자체를 만들지 않는다', () => {
    expect(toSortQuery(null)).toEqual({});
    expect(Object.hasOwn(toSortQuery(null), 'sort')).toBe(false);
  });
});
