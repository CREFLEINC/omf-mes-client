import { describe, expect, it } from 'vitest';

import { toDiffEntries, toValueKeys } from './diff-entries';

describe('toValueKeys — 키 합집합과 순서', () => {
  /* 받은 순서가 곧 표시 순서다. 사전순으로 정렬하면 화면이 순서를 부여하는 것이 된다. */
  it('before의 키 순서를 먼저 쓰고 after에만 있는 키를 그 뒤에 붙인다', () => {
    expect(
      toValueKeys({ zebra: 1, alpha: 2 }, { alpha: 3, mike: 4, bravo: 5 }),
    ).toEqual(['zebra', 'alpha', 'mike', 'bravo']);
  });

  it('한쪽만 있어도 그쪽 키를 그대로 낸다', () => {
    expect(toValueKeys(null, { sampleFieldA: 1 })).toEqual(['sampleFieldA']);
    expect(toValueKeys({ sampleFieldA: 1 }, null)).toEqual(['sampleFieldA']);
  });

  it('둘 다 없으면 키도 없다', () => {
    expect(toValueKeys(null, null)).toEqual([]);
    expect(toValueKeys({}, {})).toEqual([]);
    expect(toValueKeys(undefined, undefined)).toEqual([]);
  });
});

describe('toDiffEntries — 항목별 전후 비교', () => {
  it('키 합집합만큼 행을 만든다', () => {
    const entries = toDiffEntries({ sampleFieldA: 1 }, { sampleFieldB: 2 });

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.key)).toEqual(['sampleFieldA', 'sampleFieldB']);
  });

  /* 키 → 우리말 대응표를 두면 화면이 뜻을 지어낸다. 계약이 키 구조를 정하지 않았다. */
  it('키 이름을 받은 그대로 쓴다 — 화면이 모르는 키도 감추지 않는다', () => {
    expect(toDiffEntries({ someUnknownKey: 'x' }, null)[0]?.key).toBe('someUnknownKey');
  });

  it('바뀐 항목은 이전·이후 값을 함께 낸다', () => {
    expect(toDiffEntries({ sampleFieldA: '이전' }, { sampleFieldA: '이후' })[0]).toEqual({
      key: 'sampleFieldA',
      before: '이전',
      after: '이후',
      changed: true,
    });
  });

  it('값이 같으면 변경 없음으로 판정한다 — 값을 한 번만 낸다', () => {
    expect(toDiffEntries({ sampleFieldA: 3 }, { sampleFieldA: 3 })[0]?.changed).toBe(false);
  });

  it('한쪽에만 있는 키는 반대쪽이 비고 변경으로 판정된다', () => {
    expect(toDiffEntries({ sampleFieldA: 'x' }, {})[0]).toEqual({
      key: 'sampleFieldA',
      before: 'x',
      after: null,
      changed: true,
    });
    expect(toDiffEntries({}, { sampleFieldA: 'x' })[0]).toEqual({
      key: 'sampleFieldA',
      before: null,
      after: 'x',
      changed: true,
    });
  });

  /* 거짓 같은 값을 「없음」으로 뭉개면 0 → 1 같은 변경이 「값이 생겼다」로 보인다. */
  it('0과 false를 값으로 다룬다', () => {
    expect(toDiffEntries({ sampleFieldA: 0 }, { sampleFieldA: 1 })[0]).toEqual({
      key: 'sampleFieldA',
      before: '0',
      after: '1',
      changed: true,
    });
    expect(toDiffEntries({ sampleFieldA: false }, { sampleFieldA: false })[0]?.changed).toBe(false);
  });

  it('객체 값은 원문 JSON으로 낸다', () => {
    const entry = toDiffEntries({ sampleFieldA: { nested: 1 } }, { sampleFieldA: { nested: 2 } })[0];

    expect(entry?.before).toBe('{"nested":1}');
    expect(entry?.after).toBe('{"nested":2}');
    expect(entry?.before).not.toContain('[object Object]');
  });

  it('같은 내용의 객체는 변경 없음으로 판정한다', () => {
    expect(
      toDiffEntries({ sampleFieldA: { nested: 1 } }, { sampleFieldA: { nested: 1 } })[0]?.changed,
    ).toBe(false);
  });

  /*
   * 계약이 예시를 일부러 두지 않아 목 서버가 빈 객체를 내려준다.
   * `null`·`{}`·키 없음을 갈라 다르게 다루면 화면이 서버 사정을 해석하는 것이 된다.
   */
  it('null·빈 객체·키 없음을 모두 같게 다룬다', () => {
    expect(toDiffEntries(null, null)).toEqual([]);
    expect(toDiffEntries({}, {})).toEqual([]);
    expect(toDiffEntries(undefined, undefined)).toEqual([]);
    expect(toDiffEntries(null, {})).toEqual([]);
  });

  it('빈 문자열은 값이 없는 것으로 본다', () => {
    expect(toDiffEntries({ sampleFieldA: '' }, { sampleFieldA: 'x' })[0]).toEqual({
      key: 'sampleFieldA',
      before: null,
      after: 'x',
      changed: true,
    });
  });
});
