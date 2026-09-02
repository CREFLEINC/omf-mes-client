import { createApiClient } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';
import {
  ReleaseFailure,
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
  /** 토큰을 들고 있지 않은 대상 — 상세를 불러 얻는다(이어받은 W/O). */
  release: (workOrderId?: number) => Promise<void>;
  /** 토큰을 이미 들고 있는 대상 — 조회 없이 바로 배포한다(방금 발행한 W/O). */
  releaseWith: (ifMatch: string, workOrderId?: number) => Promise<void>;
  keyHolder: ReleaseKeyHolder;
}

/** 실패한 배포가 «어디서» 멈췄는지 꺼낸다. 이 값이 사용자에게 하는 말을 가른다. */
const stepOf = async (run: Promise<void>): Promise<string> => {
  try {
    await run;
  } catch (cause) {
    return cause instanceof ReleaseFailure ? cause.step : 'other';
  }

  return 'none';
};

const harness = (
  options: { withoutEtag?: boolean; failRelease?: boolean; failDetail?: boolean } = {},
): Harness => {
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

    if (options.failDetail === true) return jsonResponse({ message: '실패' }, { status: 500 });

    return options.withoutEtag === true
      ? jsonResponse(WORK_ORDER)
      : jsonResponse(WORK_ORDER, { headers: { ETag: ETAG } });
  };

  const { client, etags } = createApiClient({ baseUrl: 'http://api.test', fetch });

  return {
    calls,
    keyHolder,
    release: (workOrderId = WORK_ORDER.workOrderId) =>
      releaseWorkOrder({
        client,
        etags,
        workOrderId,
        body: { lotSize: 200 },
        keyHolder,
        ifMatch: null,
      }),
    releaseWith: (ifMatch, workOrderId = WORK_ORDER.workOrderId) =>
      releaseWorkOrder({ client, etags, workOrderId, body: { lotSize: 200 }, keyHolder, ifMatch }),
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
  /*
   * ⭐ **두 길이 여기서 갈린다.** 방금 발행한 W/O 는 발행 응답이 토큰을 줘서 조회가 없고,
   * 이어받은 W/O 는 만들어진 순간을 화면이 보지 못했으니 조회로 얻는다.
   */
  describe('토큰을 이미 들고 있으면 — 방금 발행한 W/O', () => {
    it('⭐ 조회 없이 배포만 낸다 — 호출이 셋에서 둘로 준다', async () => {
      const test = harness();
      await test.releaseWith('W/"9"');

      expect(test.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
        'POST /production/work-orders/7001:release',
      ]);
    });

    it('⛔ 들고 있던 그 토큰을 싣는다 — 다시 얻어 온 값으로 바꾸지 않는다', async () => {
      const test = harness();
      await test.releaseWith('W/"9"');

      expect(test.calls[0]?.ifMatch).toBe('W/"9"');
      expect(test.calls[0]?.ifMatch).not.toBe(ETAG);
    });
  });

  it('토큰이 없으면 상세를 먼저 부르고 그다음 배포를 낸다', async () => {
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

  /*
   * ⭐ **어디서 멈췄는지가 사용자에게 하는 말을 가른다.** 보내지도 못한 것은 「배포되지
   * 않았습니다」로 단언해도 되지만, 보냈는데 답을 못 받은 것을 그렇게 말하면 거짓일 수 있다 —
   * 실제로 배포됐는데 사용자가 다시 눌러 이중 배포를 시도하게 된다.
   */
  describe('어디서 멈췄는지 알린다', () => {
    it('⛔ 토큰을 못 얻으면 «보내지 못함» 이다 — 단언해도 되는 자리', async () => {
      expect(await stepOf(harness({ withoutEtag: true }).release())).toBe('notSent');
    });

    it('⛔ 상세 조회가 실패해도 «보내지 못함» 이다', async () => {
      expect(await stepOf(harness({ failDetail: true }).release())).toBe('notSent');
    });

    it('⛔ 배포를 보낸 뒤 실패하면 «불명» 이다 — 안 됐다고 단언하지 않는다', async () => {
      expect(await stepOf(harness({ failRelease: true }).release())).toBe('unknown');
    });
  });
});

/* 규칙에 없는 요청이 오면 스텁이 던지므로, 위 검사들은 경로가 정확한 것도 함께 고정한다. */
describe('스텁 경계', () => {
  it('알 수 없는 경로는 받지 않는다', async () => {
    const fetch = createStubFetch([]);

    await expect(fetch(new Request('http://api.test/nope'))).rejects.toThrow();
  });
});
