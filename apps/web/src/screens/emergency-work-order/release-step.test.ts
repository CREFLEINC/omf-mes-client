import { createApiClient } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';
import {
  type ReleaseKeyHolder,
  releaseKeyFor,
  releaseWorkOrder,
  workOrderDetailPath,
} from './release-step';

const WORK_ORDER = { workOrderId: 7001, workOrderNo: 'SYN-WO-0007' };
const ETAG = 'W/"3"';

interface Call {
  method: string;
  path: string;
  idempotencyKey: string | null;
  ifMatch: string | null;
}

interface Harness {
  calls: Call[];
  release: (workOrderId?: number) => Promise<void>;
  keyHolder: ReleaseKeyHolder;
}

const harness = (options: { withoutEtag?: boolean; failRelease?: boolean } = {}): Harness => {
  const calls: Call[] = [];
  const keyHolder: ReleaseKeyHolder = { current: null };

  const fetch: StubFetch = async (request) => {
    const path = new URL(request.url).pathname;
    calls.push({
      method: request.method,
      path,
      idempotencyKey: request.headers.get('Idempotency-Key'),
      ifMatch: request.headers.get('If-Match'),
    });

    if (path.endsWith(':release')) {
      return options.failRelease === true
        ? jsonResponse({ message: '실패' }, { status: 500 })
        : jsonResponse(WORK_ORDER);
    }

    return options.withoutEtag === true
      ? jsonResponse(WORK_ORDER)
      : jsonResponse(WORK_ORDER, { headers: { ETag: ETAG } });
  };

  const { client, etags } = createApiClient({ baseUrl: 'http://api.test', fetch });

  return {
    calls,
    keyHolder,
    release: (workOrderId = WORK_ORDER.workOrderId) =>
      releaseWorkOrder({ client, etags, workOrderId, body: { lotSize: 200 }, keyHolder }),
  };
};

describe('workOrderDetailPath', () => {
  it('⭐ 토큰은 «상세» 경로에서 꺼낸다 — 발행이 나가는 목록 경로가 아니다', () => {
    expect(workOrderDetailPath(7001)).toBe('/production/work-orders/7001');
    expect(workOrderDetailPath(7001)).not.toBe('/production/work-orders');
  });
});

describe('releaseKeyFor', () => {
  it('같은 대상에는 같은 키를 준다 — 다시 눌러도 이중 배포가 되지 않는다', () => {
    const holder: ReleaseKeyHolder = { current: null };

    expect(releaseKeyFor(holder, 7001)).toBe(releaseKeyFor(holder, 7001));
  });

  it('⛔ 대상이 바뀌면 새 키를 준다 — 물려주면 다른 W/O 가 앞 응답으로 대체된다', () => {
    const holder: ReleaseKeyHolder = { current: null };
    const first = releaseKeyFor(holder, 7001);

    expect(releaseKeyFor(holder, 7002)).not.toBe(first);
  });

  it('대상이 돌아와도 새 키다 — 앞 키는 이미 그 대상에서 떠났다', () => {
    const holder: ReleaseKeyHolder = { current: null };
    const first = releaseKeyFor(holder, 7001);
    releaseKeyFor(holder, 7002);

    expect(releaseKeyFor(holder, 7001)).not.toBe(first);
  });
});

describe('releaseWorkOrder', () => {
  it('상세를 먼저 부르고 그다음 배포를 낸다', async () => {
    const test = harness();
    await test.release();

    expect(test.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /production/work-orders/7001',
      'POST /production/work-orders/7001:release',
    ]);
  });

  it('⛔ 상세가 내려 준 토큰을 배포에 싣는다', async () => {
    const test = harness();
    await test.release();

    expect(test.calls[1]?.ifMatch).toBe(ETAG);
  });

  it('배포에 멱등 키를 싣는다', async () => {
    const test = harness();
    await test.release();

    expect(test.calls[1]?.idempotencyKey).toEqual(expect.any(String));
  });

  it('⛔ 토큰이 안 오면 배포를 내지 않는다 — 빈 토큰으로 물어 거부당하지 않게', async () => {
    const test = harness({ withoutEtag: true });

    await expect(test.release()).rejects.toThrow();
    expect(test.calls.some((call) => call.path.endsWith(':release'))).toBe(false);
  });

  it('⛔ 다시 시도해도 같은 키로 나간다', async () => {
    const test = harness({ failRelease: true });

    await expect(test.release()).rejects.toThrow();
    await expect(test.release()).rejects.toThrow();

    const keys = test.calls
      .filter((call) => call.path.endsWith(':release'))
      .map((call) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('⛔ 다른 W/O 를 배포하면 다른 키로 나간다', async () => {
    const test = harness({ failRelease: true });

    await expect(test.release(7001)).rejects.toThrow();
    await expect(test.release(7002)).rejects.toThrow();

    const keys = test.calls
      .filter((call) => call.path.endsWith(':release'))
      .map((call) => call.idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('배포가 실패하면 알린다 — 조용히 성공으로 두지 않는다', async () => {
    const test = harness({ failRelease: true });

    await expect(test.release()).rejects.toThrow();
  });
});

/* 규칙에 없는 요청이 오면 스텁이 던지므로, 위 검사들은 경로가 정확한 것도 함께 고정한다. */
describe('스텁 경계', () => {
  it('알 수 없는 경로는 받지 않는다', async () => {
    const fetch = createStubFetch([]);

    await expect(fetch(new Request('http://api.test/nope'))).rejects.toThrow();
  });
});
