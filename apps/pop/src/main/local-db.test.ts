import initSqlJs from 'sql.js';
import { beforeEach, describe, expect, it } from 'vitest';

import { LocalDb, type SqlDatabase } from './local-db';

// 대역이 아니라 실물 sql.js로 잰다 — 「로컬 SQLite에 쓰고 읽는 것이 확인된다」(C5)를
// 증명하려면 SQL이 실제로 돌아야 한다.
const SQL = await initSqlJs();

function freshDb(): LocalDb {
  return new LocalDb(new SQL.Database() as unknown as SqlDatabase);
}

describe('선배포 캐시', () => {
  let db: LocalDb;
  beforeEach(() => {
    db = freshDb();
  });

  it('없는 키는 undefined다', () => {
    expect(db.getCache('missing')).toBeUndefined();
  });

  it('쓴 값을 그대로 읽는다', () => {
    db.putCache('items', '[{"id":1}]', '2026-08-26T00:00:00Z');
    expect(db.getCache('items')).toBe('[{"id":1}]');
  });

  it('같은 키를 다시 쓰면 덮어쓴다 — 행이 늘지 않는다', () => {
    db.putCache('k', 'old', '2026-08-26T00:00:00Z');
    db.putCache('k', 'new', '2026-08-26T01:00:00Z');
    expect(db.getCache('k')).toBe('new');
  });
});

describe('전송 대기열', () => {
  let db: LocalDb;
  beforeEach(() => {
    db = freshDb();
  });

  it('빈 대기열은 크기 0이고 목록이 비어 있다', () => {
    expect(db.queueSize()).toBe(0);
    expect(db.peekQueue()).toEqual([]);
  });

  it('넣은 순서대로 나온다 — 현장 실적은 발생 순서가 의미다', () => {
    db.enqueue('/a', '1', '2026-08-26T00:00:00Z');
    db.enqueue('/b', '2', '2026-08-26T00:00:01Z');
    db.enqueue('/c', '3', '2026-08-26T00:00:02Z');
    expect(db.peekQueue().map((r) => r.endpoint)).toEqual(['/a', '/b', '/c']);
  });

  it('dequeue는 지정한 것만 지운다', () => {
    db.enqueue('/a', '1', '2026-08-26T00:00:00Z');
    db.enqueue('/b', '2', '2026-08-26T00:00:01Z');
    const first = db.peekQueue()[0]!;
    db.dequeue(first.id);
    expect(db.queueSize()).toBe(1);
    expect(db.peekQueue()[0]!.endpoint).toBe('/b');
  });

  it('limit 위로는 주지 않는다', () => {
    for (let i = 0; i < 5; i += 1) db.enqueue(`/e${i}`, `${i}`, '2026-08-26T00:00:00Z');
    expect(db.peekQueue(2)).toHaveLength(2);
  });

  it('페이로드와 생성 시각이 실려 돌아온다', () => {
    db.enqueue('/work-results', '{"qty":3}', '2026-08-26T09:30:00Z');
    const row = db.peekQueue()[0]!;
    expect(row.payload).toBe('{"qty":3}');
    expect(row.createdAt).toBe('2026-08-26T09:30:00Z');
  });
});

describe('디스크 내리기', () => {
  it('export한 바이트로 다시 열면 내용이 남아 있다', () => {
    const db = freshDb();
    db.putCache('survives', 'yes', '2026-08-26T00:00:00Z');
    db.enqueue('/pending', '{}', '2026-08-26T00:00:00Z');
    const bytes = db.export();
    db.close();

    const reopened = new LocalDb(new SQL.Database(bytes) as unknown as SqlDatabase);
    expect(reopened.getCache('survives')).toBe('yes');
    expect(reopened.queueSize()).toBe(1);
  });
});
