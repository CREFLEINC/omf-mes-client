/**
 * 로컬 저장소 — 선배포 캐시와 전송 대기열의 **그릇**만 만든다.
 * 오프라인 동기화 정책(충돌 해소 규칙 등)은 #441 범위 밖이다.
 *
 * WASM 계열 SQLite로 시작한다(#441 결정) — 네이티브 바인딩은 Electron ABI 재빌드가 걸려
 * 신규 셋업에서 가장 잘 막히는 지점이다. 성능이 실측으로 문제가 되면 그때 네이티브로 옮긴다.
 */

/** sql.js `Database`에서 우리가 쓰는 부분만. 대역을 끼울 수 있게 좁게 잡는다. */
export interface SqlDatabase {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }>;
  export(): Uint8Array;
  close(): void;
}

export interface QueuedRequest {
  id: number;
  endpoint: string;
  payload: string;
  createdAt: string;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS cache (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint   TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export class LocalDb {
  constructor(private readonly db: SqlDatabase) {
    this.db.run(SCHEMA);
  }

  // --- 선배포 캐시 ---

  putCache(key: string, value: string, fetchedAt: string): void {
    this.db.run(
      'INSERT INTO cache (key, value, fetched_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at',
      [key, value, fetchedAt],
    );
  }

  getCache(key: string): string | undefined {
    const rows = this.db.exec('SELECT value FROM cache WHERE key = ?', [key]);
    return firstCell(rows) as string | undefined;
  }

  // --- 전송 대기열 ---

  /** 대기열은 FIFO다 — 현장 실적은 발생 순서가 곧 의미다. */
  enqueue(endpoint: string, payload: string, createdAt: string): void {
    this.db.run('INSERT INTO outbox (endpoint, payload, created_at) VALUES (?, ?, ?)', [
      endpoint,
      payload,
      createdAt,
    ]);
  }

  peekQueue(limit = 10): QueuedRequest[] {
    const rows = this.db.exec(
      'SELECT id, endpoint, payload, created_at FROM outbox ORDER BY id ASC LIMIT ?',
      [limit],
    );
    const table = rows[0];
    if (table === undefined) return [];
    return table.values.map((row) => ({
      id: Number(row[0]),
      endpoint: String(row[1]),
      payload: String(row[2]),
      createdAt: String(row[3]),
    }));
  }

  /** 전송이 확정된 뒤에만 지운다 — 보내기 전에 지우면 실적이 사라진다. */
  dequeue(id: number): void {
    this.db.run('DELETE FROM outbox WHERE id = ?', [id]);
  }

  queueSize(): number {
    const rows = this.db.exec('SELECT COUNT(*) FROM outbox');
    return Number(firstCell(rows) ?? 0);
  }

  /** 디스크에 내릴 바이트. 호출부가 파일로 쓴다. */
  export(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}

function firstCell(rows: Array<{ values: unknown[][] }>): unknown {
  return rows[0]?.values[0]?.[0];
}
