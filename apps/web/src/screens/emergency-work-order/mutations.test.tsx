import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import type { IssueFormValue } from './issue-form';
import type { IssueCommand } from './issue-request';
import { type IssueResult, useIssueEmergencyWorkOrder } from './mutations';

const WORK_ORDER = { workOrderId: 7001, workOrderNo: 'SYN-WO-0007' };
/** 상세가 내려 주는 토큰. */
const ETAG = 'W/"3"';
/** **발행 응답이** 내려 주는 토큰. 둘을 다르게 둬야 어느 쪽을 실었는지 갈린다. */
const CREATE_ETAG = 'W/"9"';
const CREATE_PATH = '/production/work-orders';
const DETAIL_PATH = '/production/work-orders/7001';
const RELEASE_PATH = '/production/work-orders/7001:release';

/** 계약이 실제로 내려 주는 오류 모양. 손으로 지은 `{ message }` 로는 정규화 갈래가 달라진다. */
const contractError = (status: number): Response =>
  jsonResponse(
    { errors: [{ scope: 'screen', code: 'SYN_CODE', message: '서버 문구' }] },
    { status },
  );

const form = (overrides: Partial<IssueFormValue> = {}): IssueFormValue => ({
  itemId: '5001',
  orderQty: '200',
  plannedEndAtLocal: '2026-08-06T18:00',
  remarks: '고객 긴급 요청',
  ...overrides,
});

const command = (overrides: Partial<IssueCommand> = {}): IssueCommand => ({
  form: form(),
  item: { itemId: 5001, itemCode: 'SYN-ITEM-0001', itemName: '합성 품목', baseUomId: 11 },
  routingOperationId: 901,
  typeCode: 'SYN_EMERGENCY',
  at: new Date('2026-08-05T09:00:00+09:00'),
  ...overrides,
});

interface Call {
  method: string;
  path: string;
  idempotencyKey: string | null;
  ifMatch: string | null;
  body: unknown;
}

interface StubOptions {
  fail?: 'create' | 'detail' | 'release';
  /** 첫 배포만 실패시키고 재시도는 통과시킨다. */
  failFirstRelease?: boolean;
  /** 상세가 성공하되 토큰을 주지 않는다. */
  withoutEtag?: boolean;
  /** 발행이 성공하되 토큰을 주지 않는다 — 조회로 되돌아가는지 보려는 것이다. */
  createWithoutEtag?: boolean;
  /** 발행이 2xx 인데 본문을 읽을 수 없다. */
  createWithoutBody?: boolean;
  /** 배포를 붙잡아 둔다 — 나가 있는 «동안»의 상태를 보려는 것이다. */
  holdRelease?: Promise<void>;
}

interface Stub {
  calls: Call[];
  fetch: StubFetch;
}

/**
 * ⛔ **모르는 경로는 던진다.** 받아 넘기면 경로가 틀려도 감지기가 통과한다 — 스텁이
 * 관대하면 검사는 스텁을 검사하는 셈이 된다.
 */
const stub = (options: StubOptions = {}): Stub => {
  const calls: Call[] = [];
  let releaseCount = 0;

  const fetch: StubFetch = async (request) => {
    const path = new URL(request.url).pathname;
    /* 본문이 없거나 깨진 요청도 기록한다 — 나간 사실이 스텁에서 사라지지 않게. */
    const body =
      request.method === 'POST'
        ? await request
            .clone()
            .json()
            .catch(() => undefined)
        : undefined;

    calls.push({
      method: request.method,
      path,
      idempotencyKey: request.headers.get('Idempotency-Key'),
      ifMatch: request.headers.get('If-Match'),
      body,
    });

    if (path === RELEASE_PATH) {
      releaseCount += 1;
      if (options.holdRelease !== undefined) await options.holdRelease;
      const fails =
        options.fail === 'release' || (options.failFirstRelease === true && releaseCount === 1);
      return fails ? contractError(500) : jsonResponse(WORK_ORDER);
    }

    if (path === DETAIL_PATH) {
      if (options.fail === 'detail') return contractError(500);
      return options.withoutEtag === true
        ? jsonResponse(WORK_ORDER)
        : jsonResponse(WORK_ORDER, { headers: { ETag: ETAG } });
    }

    if (path === CREATE_PATH) {
      if (options.fail === 'create') return contractError(400);
      if (options.createWithoutBody === true) {
        return new Response(null, { status: 201 });
      }
      /*
       * ⭐ **발행 응답이 토큰을 준다** — 이것이 있어 배포 전에 상세를 부르지 않는다.
       * `createWithoutEtag` 는 그 헤더가 오지 않았을 때 조회로 되돌아가는지를 보려는 것이다.
       */
      return options.createWithoutEtag === true
        ? jsonResponse(WORK_ORDER, { status: 201 })
        : jsonResponse(WORK_ORDER, { status: 201, headers: { ETag: CREATE_ETAG } });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${path}`);
  };

  return { calls, fetch };
};

const renderIssue = (stubbed: Stub) =>
  renderHookWithProviders(() => useIssueEmergencyWorkOrder(), { fetch: stubbed.fetch });

/** 발행을 내고 **더 나갈 것이 없을 때까지** 기다린다. 성공·실패 어느 쪽으로 끝나든 같다. */
const issueAndSettle = async (stubbed: Stub, overrides: Partial<IssueCommand> = {}) => {
  const { result } = renderIssue(stubbed);

  act(() => {
    result.current.issue(command(overrides));
  });
  await waitFor(() => {
    expect(result.current.isIssuing).toBe(false);
  });

  return result;
};

const retryAndSettle = async (result: { current: IssueResult }): Promise<void> => {
  act(() => {
    result.current.retryRelease();
  });
  await waitFor(() => {
    expect(result.current.isIssuing).toBe(false);
  });
};

const releaseCalls = (stubbed: Stub): Call[] =>
  stubbed.calls.filter((call) => call.path === RELEASE_PATH);
const createCalls = (stubbed: Stub): Call[] =>
  stubbed.calls.filter((call) => call.path === CREATE_PATH);

describe('useIssueEmergencyWorkOrder', () => {
  /*
   * ⭐ **한 액션에 두 호출이다.** 종전에는 토큰을 얻으려 가운데 상세를 한 번 더 불렀는데,
   * 발행 응답이 그것을 직접 준다 — 걸음이 하나 줄어든 만큼 「만들어졌는데 배포가 안 끝나는」
   * 창도 좁아진다.
   */
  it('⭐ 한 액션에 두 호출이다 — 가운데 조회가 없다', async () => {
    const stubbed = stub();
    const result = await issueAndSettle(stubbed);

    expect(result.current.releasedNo).toBe('SYN-WO-0007');
    expect(stubbed.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `POST ${CREATE_PATH}`,
      `POST ${RELEASE_PATH}`,
    ]);
  });

  /*
   * ⛔ **발행이 준 토큰을 그대로 실어야 한다.** 상세 토큰과 값을 다르게 둬서, 실수로 조회로
   * 되돌아가거나 엉뚱한 자리에서 꺼내 오면 값이 갈려 드러나게 했다.
   */
  it('⛔ 발행 응답이 준 토큰을 배포에 싣는다', async () => {
    const stubbed = stub();
    await issueAndSettle(stubbed);

    expect(stubbed.calls[1]?.ifMatch).toBe(CREATE_ETAG);
    expect(stubbed.calls[1]?.ifMatch).not.toBe(ETAG);
  });

  /*
   * ⚠ **토큰이 오지 않으면 지어내지 않고 조회로 되돌아간다.** 빈 토큰으로 배포하면 서버가
   * 거부하고, 그 거부는 「배포가 반려됐다」로 읽힌다 — 실제로는 물어보지도 못한 것이다.
   */
  it('⚠ 발행이 토큰을 주지 않으면 상세를 불러 얻는다 — 빈 값으로 보내지 않는다', async () => {
    const stubbed = stub({ createWithoutEtag: true });
    await issueAndSettle(stubbed);

    expect(stubbed.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `POST ${CREATE_PATH}`,
      `GET ${DETAIL_PATH}`,
      `POST ${RELEASE_PATH}`,
    ]);
    expect(stubbed.calls[2]?.ifMatch).toBe(ETAG);
  });

  it('전선에 실리는 본문과 키가 계약대로다', async () => {
    const stubbed = stub();
    await issueAndSettle(stubbed);

    /* ⛔ 계획 참조는 «명시적 null» — 이것이 내부 P/O 자동 생성을 부른다. */
    expect(stubbed.calls[0]?.body).toHaveProperty('productionPlanId', null);
    /* LOT 크기는 지시수량 — 슬롯 하나. */
    expect(stubbed.calls[1]?.body).toEqual({ lotSize: 200 });
    /* 발행과 배포는 서로 다른 키를 쓴다 — 다른 쓰기다. */
    expect(stubbed.calls[0]?.idempotencyKey).not.toBe(stubbed.calls[1]?.idempotencyKey);
  });

  describe('⛔ 한 번에 하나만 나간다', () => {
    it('같은 틱에 두 번 눌러도 발행은 한 번이다 — 긴급 지시가 둘이 되지 않게', async () => {
      const stubbed = stub();
      const { result } = renderIssue(stubbed);

      act(() => {
        result.current.issue(command());
        result.current.issue(command());
      });
      await waitFor(() => {
        expect(result.current.isIssuing).toBe(false);
      });

      expect(createCalls(stubbed)).toHaveLength(1);
    });

    it('배포가 나가 있는 «동안» 재시도를 눌러도 두 번 나가지 않는다', async () => {
      let letGo = (): void => undefined;
      const held = new Promise<void>((resolve) => {
        letGo = resolve;
      });
      const stubbed = stub({ holdRelease: held });
      const { result } = renderIssue(stubbed);

      act(() => {
        result.current.issue(command());
      });
      await waitFor(() => {
        expect(releaseCalls(stubbed)).toHaveLength(1);
      });

      /* 첫 배포가 아직 전선에 있는 동안 누른다. */
      act(() => {
        result.current.retryRelease();
      });
      await act(async () => {
        letGo();
        await held;
      });
      await waitFor(() => {
        expect(result.current.isIssuing).toBe(false);
      });

      expect(releaseCalls(stubbed)).toHaveLength(1);
    });

    it('배포가 끝나지 않은 W/O 가 있으면 새 발행을 내지 않는다', async () => {
      const stubbed = stub({ fail: 'release' });
      const result = await issueAndSettle(stubbed);

      act(() => {
        result.current.issue(command());
      });
      await waitFor(() => {
        expect(result.current.isIssuing).toBe(false);
      });

      expect(createCalls(stubbed)).toHaveLength(1);
    });
  });

  describe('⛔ 만들어졌는데 배포가 끝나지 않은 창', () => {
    /*
     * ⚠ 발행이 토큰을 준 뒤에는 상세를 부르지 않으므로, 이 두 가지는 **토큰이 오지 않아
     * 조회로 되돌아간 경우**에만 성립한다. 그 갈래가 사라지지 않았음을 함께 고정한다.
     */
    it('배포를 «보내지도 못하면» 그렇게 말한다 — 단언해도 되는 자리다', async () => {
      const result = await issueAndSettle(stub({ createWithoutEtag: true, fail: 'detail' }));

      expect(result.current.pending).toMatchObject({
        workOrderNo: 'SYN-WO-0007',
        failedAt: 'notSent',
      });
      expect(result.current.releasedNo).toBeNull();
    });

    it('⛔ 토큰이 안 오면 배포를 내지 않는다 — 빈 토큰으로 물어 거부당하지 않게', async () => {
      const stubbed = stub({ createWithoutEtag: true, withoutEtag: true });
      const result = await issueAndSettle(stubbed);

      expect(result.current.pending?.failedAt).toBe('notSent');
      expect(releaseCalls(stubbed)).toHaveLength(0);
    });

    it('⛔ 배포를 «보냈는데 답을 못 받으면» 안 됐다고 단언하지 않는다', async () => {
      const result = await issueAndSettle(stub({ fail: 'release' }));

      expect(result.current.pending?.failedAt).toBe('unknown');
      expect(result.current.releasedNo).toBeNull();
    });

    it('⛔ 발행 자체가 실패하면 남길 W/O 가 없다 — 배포 재시도가 열리지 않는다', async () => {
      const stubbed = stub({ fail: 'create' });
      const result = await issueAndSettle(stubbed);

      expect(result.current.error).not.toBeNull();
      expect(result.current.pending).toBeNull();
      expect(stubbed.calls).toHaveLength(1);
    });

    /*
     * ⛔ 2xx 인데 번호를 못 읽었다면 **지시는 이미 만들어졌을 수 있다.** 「발행 실패」로 말하면
     * 사용자가 한 번 더 눌러 긴급 지시가 둘이 된다. 번호를 모르니 재시도도 낼 수 없다.
     */
    it('⛔ 발행이 성공했는데 번호를 못 읽은 것을 「실패」로 말하지 않는다', async () => {
      const stubbed = stub({ createWithoutBody: true });
      const result = await issueAndSettle(stubbed);

      expect(result.current.isCreateUncertain).toBe(true);
      expect(result.current.releasedNo).toBeNull();
      /* 배포로 넘어가지 않는다 — 대상 번호를 모른다. */
      expect(stubbed.calls).toHaveLength(1);
    });

    it('발행이 «분명히» 거부되면 불명으로 흐리지 않는다', async () => {
      const result = await issueAndSettle(stub({ fail: 'create' }));

      expect(result.current.isCreateUncertain).toBe(false);
    });
  });

  describe('배포 재시도', () => {
    it('⛔ 배포만 다시 내고 같은 키를 쓴다 — 이중 발행도 이중 배포도 아니다', async () => {
      const stubbed = stub({ fail: 'release' });
      const result = await issueAndSettle(stubbed);
      const firstKey = releaseCalls(stubbed).at(-1)?.idempotencyKey;

      await retryAndSettle(result);

      expect(releaseCalls(stubbed)).toHaveLength(2);
      expect(releaseCalls(stubbed).at(-1)?.idempotencyKey).toBe(firstKey);
      expect(createCalls(stubbed)).toHaveLength(1);
    });

    it('재시도가 성공하면 배포 안 끝남을 지운다', async () => {
      const result = await issueAndSettle(stub({ failFirstRelease: true }));

      await retryAndSettle(result);

      expect(result.current.releasedNo).toBe('SYN-WO-0007');
      expect(result.current.pending).toBeNull();
    });

    it('⛔ 재시도가 그 W/O 의 본문을 보낸다 — 대상과 본문이 함께 다닌다', async () => {
      const stubbed = stub({ fail: 'release' });
      const result = await issueAndSettle(stubbed, { form: form({ orderQty: '350' }) });

      /* 배포가 안 끝난 동안 다른 수량으로 눌러 봐도 새 발행이 나가지 않는다. */
      act(() => {
        result.current.issue(command({ form: form({ orderQty: '999' }) }));
      });
      await retryAndSettle(result);

      expect(releaseCalls(stubbed).at(-1)?.body).toEqual({ lotSize: 350 });
    });

    /*
     * ⛔ 배포가 끝나면 그 키를 **버려야** 한다. 남겨 두면 다음 배포가 끝난 키로 나가고,
     * 서버는 계약대로 **실행 없이 앞 응답을 되돌려 준다** — 화면은 그것을 성공으로 읽는다.
     */
    it('⛔ 배포가 끝나면 그 키를 버린다 — 다음 배포가 앞 응답으로 대체되지 않게', async () => {
      const stubbed = stub();
      const result = await issueAndSettle(stubbed);

      act(() => {
        result.current.issue(command());
      });
      await waitFor(() => {
        expect(releaseCalls(stubbed)).toHaveLength(2);
      });

      const keys = releaseCalls(stubbed).map((call) => call.idempotencyKey);
      expect(keys[0]).not.toBe(keys[1]);
    });

    /*
     * ⛔ 발행 키도 같다 — 다만 방향이 반대다. **끝나기 전에는 같은 키**여야 통신이 끊긴 뒤
     * 다시 눌러도 지시가 둘이 되지 않는다.
     */
    it('⛔ 같은 본문으로 다시 발행하면 같은 키를 쓴다 — 끊긴 뒤 다시 눌러도 하나다', async () => {
      const stubbed = stub({ fail: 'create' });
      const result = await issueAndSettle(stubbed);

      act(() => {
        result.current.issue(command());
      });
      await waitFor(() => {
        expect(createCalls(stubbed)).toHaveLength(2);
      });

      const keys = createCalls(stubbed).map((call) => call.idempotencyKey);
      expect(keys[0]).toBe(keys[1]);
      expect(result.current.pending).toBeNull();
    });

    it('본문이 달라지면 다른 발행이라 새 키를 쓴다', async () => {
      const stubbed = stub({ fail: 'create' });
      const result = await issueAndSettle(stubbed);

      act(() => {
        result.current.issue(command({ form: form({ orderQty: '350' }) }));
      });
      await waitFor(() => {
        expect(createCalls(stubbed)).toHaveLength(2);
      });

      const keys = createCalls(stubbed).map((call) => call.idempotencyKey);
      expect(keys[0]).not.toBe(keys[1]);
    });
  });

  /*
   * 「아무것도 안 나갔다」를 기다림으로 확인하면 **첫 검사에서 바로 통과**한다 — 아직 안 나간
   * 것과 안 나갈 것을 가르지 못한다. 그래서 헛발들을 낸 뒤 «성한» 발행을 붙이고 **호출이 그
   * 셋뿐인지**를 본다. 헛발이 나갔다면 넷이 된다.
   */
  it('⛔ 헛발은 전선에 나가지 않는다 — 대상 없는 재시도도, 갖춰지지 않은 발행도', async () => {
    const stubbed = stub();
    const { result } = renderIssue(stubbed);

    act(() => {
      result.current.retryRelease();
    });
    for (const overrides of [
      { typeCode: '' },
      { form: form({ remarks: '' }) },
      { routingOperationId: null },
    ]) {
      act(() => {
        result.current.issue(command(overrides));
      });
    }
    act(() => {
      result.current.issue(command());
    });
    await waitFor(() => {
      expect(result.current.releasedNo).toBe('SYN-WO-0007');
    });

    /* 갖춰진 발행 한 번이 낸 두 호출뿐이다 — 헛발은 한 건도 전선에 나가지 않았다. */
    expect(stubbed.calls).toHaveLength(2);
    /* 누른 적 없는 실패가 화면에 뜨지 않는다. */
    expect(result.current.error).toBeNull();
  });
});
