import { describe, expect, it } from 'vitest';

import { createEtagStore } from './etag-store';

describe('EtagStore', () => {
  it('캡처한 ETag를 같은 경로의 If-Match 값으로 돌려준다', () => {
    const store = createEtagStore();
    store.capture('/mdm/warehouses/3', '"7"');
    expect(store.ifMatch('/mdm/warehouses/3')).toBe('"7"');
  });

  it('캡처된 적 없는 경로는 undefined — If-Match 없이 저장하면 서버가 거부하게 둔다', () => {
    const store = createEtagStore();
    expect(store.ifMatch('/mdm/warehouses/999')).toBeUndefined();
  });

  it('저장 응답의 새 ETag로 갱신한다 — 연속 수정 시 재조회가 필요 없다', () => {
    const store = createEtagStore();
    store.capture('/mdm/warehouses/3', '"7"');
    store.capture('/mdm/warehouses/3', '"8"');
    expect(store.ifMatch('/mdm/warehouses/3')).toBe('"8"');
  });

  it('경로별로 독립이다', () => {
    const store = createEtagStore();
    store.capture('/mdm/warehouses/3', '"7"');
    store.capture('/mdm/locations/5', '"2"');
    expect(store.ifMatch('/mdm/warehouses/3')).toBe('"7"');
    expect(store.ifMatch('/mdm/locations/5')).toBe('"2"');
  });

  it('clear로 특정 경로를 비운다 — 화면 이탈 시 낡은 판 번호로 저장하는 것을 막는다', () => {
    const store = createEtagStore();
    store.capture('/mdm/warehouses/3', '"7"');
    store.clear('/mdm/warehouses/3');
    expect(store.ifMatch('/mdm/warehouses/3')).toBeUndefined();
  });
});
