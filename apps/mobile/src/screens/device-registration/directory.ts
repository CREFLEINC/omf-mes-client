import { readLocal, writeLocal } from '../../patterns/local-store';
import type { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

export interface WorkerEntry {
  workerNo: string;
  workerName: string;
}

export const WORKER_DIRECTORY_KEY = 'worker-directory';

/* 서버가 한 번에 주는 최대에 맞춘다. 적게 받으면 왕복만 늘고, 크게 부르면 서버가 거절한다. */
const PAGE_SIZE = 100;

/**
 * 해당 공장의 재직 작업자를 빠짐없이 받는다.
 *
 * 한 페이지만 받으면 뒤쪽 사번이 통째로 빠지는데, 그 결과가 오프라인에서 없는 사번으로
 * 나타난다 — 조회가 모자랐다는 신호 없이 사실과 반대되는 문장이 작업자에게 간다.
 */
export const fetchWorkerDirectory = async (
  client: Client,
  plantId: number,
): Promise<WorkerEntry[]> => {
  const entries: WorkerEntry[] = [];

  for (let page = 0; ; page += 1) {
    const data = await runRequest(() =>
      client.GET('/mdm/workers', {
        params: { query: { plantId, includeInactive: false, page, size: PAGE_SIZE } },
      }),
    );

    for (const worker of data.items) {
      entries.push({ workerNo: worker.workerNo, workerName: worker.workerName });
    }

    // 빈 페이지도 끝으로 본다. total 만 믿으면 그 값이 틀렸을 때 영원히 돈다.
    if (data.items.length === 0 || entries.length >= data.page.total) {
      return entries;
    }
  }
};

export const saveWorkerDirectory = async (entries: WorkerEntry[]): Promise<void> => {
  await writeLocal(WORKER_DIRECTORY_KEY, JSON.stringify(entries));
};

/** 받아 둔 적이 없으면 null 이다 — 재직자가 0명이라 빈 것과 다른 뜻이다. */
export const loadWorkerDirectory = async (): Promise<WorkerEntry[] | null> => {
  const stored = await readLocal(WORKER_DIRECTORY_KEY);

  if (stored === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as WorkerEntry[]) : null;
  } catch {
    return null;
  }
};
