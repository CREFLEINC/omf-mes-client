import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '@omf-mes/api-client';

import { createStubFetch, jsonResponse, type StubRoute } from '../../test/api-harness';
import { fetchWorkerDirectory, loadWorkerDirectory, saveWorkerDirectory } from './directory';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const worker = (index: number) => ({
  workerId: index,
  workerNo: `SYN-W-${String(index).padStart(4, '0')}`,
  workerName: `작업자 ${String(index)}`,
  plantId: 7,
  isActive: true,
});

const pagedRoute = (pages: ReturnType<typeof worker>[][], seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === '/mdm/workers',
  respond: (request) => {
    const url = new URL(request.url);
    seen.push(url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const total = pages.reduce((count, items) => count + items.length, 0);

    return jsonResponse({ items: pages[page - 1] ?? [], page: { page, size: 100, total } });
  },
});

const clientWith = (routes: StubRoute[]) =>
  createApiClient({ baseUrl: 'http://api.test', fetch: createStubFetch(routes) }).client;

describe('작업자 목록 수신', () => {
  it('해당 공장의 재직자만 청한다', async () => {
    const seen: URL[] = [];

    await fetchWorkerDirectory(clientWith([pagedRoute([[worker(1)]], seen)]), 7);

    expect(seen[0]?.searchParams.get('plantId')).toBe('7');
    expect(seen[0]?.searchParams.get('includeInactive')).toBe('false');
  });

  /* 한 페이지만 받으면 뒤쪽 사번이 오프라인에서 없는 사번이 된다. */
  it('여러 페이지를 끝까지 받는다', async () => {
    const seen: URL[] = [];
    const first = Array.from({ length: 100 }, (_, index) => worker(index + 1));
    const second = [worker(101), worker(102)];

    const entries = await fetchWorkerDirectory(clientWith([pagedRoute([first, second], seen)]), 7);

    expect(entries).toHaveLength(102);
    expect(seen.map((url) => url.searchParams.get('page'))).toEqual(['1', '2']);
    expect(entries.at(-1)?.workerNo).toBe('SYN-W-0102');
  });

  it('458명을 5페이지로 받을 때 중복 없이 마지막 58명까지 받는다', async () => {
    const seen: URL[] = [];
    const pages = Array.from({ length: 5 }, (_, pageIndex) =>
      Array.from({ length: pageIndex === 4 ? 58 : 100 }, (_, itemIndex) =>
        worker(pageIndex * 100 + itemIndex + 1),
      ),
    );

    const entries = await fetchWorkerDirectory(clientWith([pagedRoute(pages, seen)]), 7);

    expect(entries).toHaveLength(458);
    expect(new Set(entries.map((entry) => entry.workerNo))).toHaveLength(458);
    expect(seen.map((url) => url.searchParams.get('page'))).toEqual(['1', '2', '3', '4', '5']);
    expect(entries.at(-1)?.workerNo).toBe('SYN-W-0458');
  });

  /* total 이 실제보다 크면 빈 페이지를 영원히 청하게 된다. */
  it('빈 페이지가 오면 거기서 멈춘다', async () => {
    const seen: URL[] = [];
    const route: StubRoute = {
      match: (request) => new URL(request.url).pathname === '/mdm/workers',
      respond: (request) => {
        const url = new URL(request.url);
        seen.push(url);
        const page = Number(url.searchParams.get('page') ?? '1');

        return jsonResponse({
          items: page === 1 ? [worker(1)] : [],
          page: { page, size: 100, total: 9999 },
        });
      },
    };

    const entries = await fetchWorkerDirectory(clientWith([route]), 7);

    expect(entries).toHaveLength(1);
    expect(seen).toHaveLength(2);
  });
});

describe('받아 둔 목록', () => {
  it('저장한 것을 그대로 돌려준다', async () => {
    await saveWorkerDirectory([{ workerNo: 'SYN-W-0001', workerName: '작업자 1' }]);

    expect(await loadWorkerDirectory()).toEqual([
      { workerNo: 'SYN-W-0001', workerName: '작업자 1' },
    ]);
  });

  it('받아 둔 적이 없으면 null이다', async () => {
    store.clear();

    expect(await loadWorkerDirectory()).toBeNull();
  });

  /* 재직자 0명과 받은 적 없음은 다른 뜻이다. 뒤엣것만 다시 받아야 한다. */
  it('빈 목록을 받아 둔 것은 null이 아니다', async () => {
    await saveWorkerDirectory([]);

    expect(await loadWorkerDirectory()).toEqual([]);
  });

  it('보관된 값이 깨져 있으면 받은 적 없는 것으로 본다', async () => {
    store.set('worker-directory', '{');

    expect(await loadWorkerDirectory()).toBeNull();
  });
});
