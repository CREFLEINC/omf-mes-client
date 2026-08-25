import { describe, expect, it } from 'vitest';

import { CONTRACT_SORT_KEYS, nextSortKey, readSortKey, toSortQuery, toSortState } from './sort';

describe('CONTRACT_SORT_KEYS — 공유계약 L-4', () => {
  it('세 값이고 순서가 고정돼 있다', () => {
    expect(CONTRACT_SORT_KEYS).toEqual(['requestedShipDate', 'customerId', 'shipmentRequestNo']);
  });
});

describe('readSortKey — 주소가 담은 정렬 열', () => {
  it('계약 열거값을 그대로 읽는다', () => {
    expect(readSortKey('requestedShipDate')).toBe('requestedShipDate');
    expect(readSortKey('customerId')).toBe('customerId');
    expect(readSortKey('shipmentRequestNo')).toBe('shipmentRequestNo');
  });

  it('키가 없으면 정렬하지 않는다', () => {
    expect(readSortKey(null)).toBeNull();
    expect(readSortKey('')).toBeNull();
  });

  /* 계약 열거값 밖은 400이 된다 — 주소는 손으로 고쳐지는 자리다. */
  it('계약 열거값 밖은 버린다', () => {
    expect(readSortKey('nope')).toBeNull();
    expect(readSortKey('progress')).toBeNull();
  });
});

describe('nextSortKey — 머리글을 눌렀을 때', () => {
  it('정렬이 없을 때 누르면 그 열로 정렬한다', () => {
    expect(nextSortKey(null, { key: 'requestedShipDate', direction: 'ascending' })).toBe(
      'requestedShipDate',
    );
  });

  it('다른 열을 누르면 그 열로 옮긴다', () => {
    expect(nextSortKey('requestedShipDate', { key: 'customerId', direction: 'ascending' })).toBe(
      'customerId',
    );
  });

  /* 내림차순 상태로 들어가지 않는다 — 계약이 방향을 받지 않는다. */
  it('같은 열을 다시 누르면 방향이 무엇이든 해제한다', () => {
    expect(nextSortKey('customerId', { key: 'customerId', direction: 'descending' })).toBeNull();
    expect(nextSortKey('customerId', { key: 'customerId', direction: 'ascending' })).toBeNull();
  });

  it('디자인 시스템이 해제를 알려도 해제한다', () => {
    expect(nextSortKey('customerId', null)).toBeNull();
  });

  it('계약 열거값 밖으로 새어 들어와도 정렬을 만들지 않는다', () => {
    expect(nextSortKey(null, { key: 'progress', direction: 'ascending' })).toBeNull();
  });
});

describe('toSortState — 표에 넘기는 제어 정렬 상태', () => {
  it('정렬 열이 있으면 오름차순으로 표기한다', () => {
    expect(toSortState('shipmentRequestNo')).toEqual({
      key: 'shipmentRequestNo',
      direction: 'ascending',
    });
  });

  it('정렬 열이 없으면 표기하지 않는다', () => {
    expect(toSortState(null)).toBeNull();
  });
});

describe('toSortQuery — 계약으로 보내는 값', () => {
  it('열만 싣고 방향을 뜻하는 키를 만들지 않는다', () => {
    const query = toSortQuery('requestedShipDate');

    expect(query).toEqual({ sort: 'requestedShipDate' });
    expect(Object.keys(query)).toEqual(['sort']);
  });

  it('정렬이 없으면 키 자체를 만들지 않는다', () => {
    expect(toSortQuery(null)).toEqual({});
    expect(Object.hasOwn(toSortQuery(null), 'sort')).toBe(false);
  });
});
