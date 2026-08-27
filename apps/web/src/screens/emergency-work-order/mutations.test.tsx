import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import type { IssueFormValue } from './issue-form';
import type { IssueCommand } from './issue-request';
import { type IssueResult, useIssueEmergencyWorkOrder } from './mutations';

const WORK_ORDER = { workOrderId: 7001, workOrderNo: 'SYN-WO-0007' };
const ETAG = 'W/"3"';

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
  body: unknown;
}

interface StubOptions {
  /** 이 단계만 실패시킨다. */
  fail?: 'create' | 'release';
  /** 첫 배포만 실패시키고 재시도는 통과시킨다. */
  failFirstRelease?: boolean;
}

interface Stub {
  calls: Call[];
  fetch: StubFetch;
}

const stub = (options: StubOptions = {}): Stub => {
  const calls: Call[] = [];
  let releaseCount = 0;

  const fetch: StubFetch = async (request) => {
    const path = new URL(request.url).pathname;
    /*
     * 본문이 없거나 깨진 요청도 **기록한다.** 파싱에 걸려 넘어지면 그런 요청이 나간 사실이
     * 스텁에서 사라져, 「아무것도 안 보냈다」를 확인하는 감지기가 조용히 통과한다.
     */
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
      body,
    });

    if (path.endsWith(':release')) {
      releaseCount += 1;
      const fails =
        options.fail === 'release' || (options.failFirstRelease === true && releaseCount === 1);

      return fails ? jsonResponse({ message: '실패' }, { status: 500 }) : jsonResponse(WORK_ORDER);
    }

    if (request.method === 'GET') return jsonResponse(WORK_ORDER, { headers: { ETag: ETAG } });

    return options.fail === 'create'
      ? jsonResponse({ message: '실패' }, { status: 500 })
      : jsonResponse(WORK_ORDER, { status: 201 });
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
  stubbed.calls.filter((call) => call.path.endsWith(':release'));

describe('useIssueEmergencyWorkOrder', () => {
  it('한 액션에 세 호출을 순서대로 낸다', async () => {
    const stubbed = stub();
    const result = await issueAndSettle(stubbed);

    expect(result.current.released).toEqual(WORK_ORDER);
    expect(stubbed.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /production/work-orders',
      'GET /production/work-orders/7001',
      'POST /production/work-orders/7001:release',
    ]);
  });

  it('전선에 실리는 본문과 키가 계약대로다', async () => {
    const stubbed = stub();
    await issueAndSettle(stubbed);

    /* ⛔ 계획 참조는 «명시적 null» — 이것이 내부 P/O 자동 생성을 부른다. */
    expect(stubbed.calls[0]?.body).toHaveProperty('productionPlanId', null);
    /* LOT 크기는 지시수량 — 슬롯 하나. */
    expect(stubbed.calls[2]?.body).toEqual({ lotSize: 200 });
    /* 발행과 배포는 서로 다른 키를 쓴다 — 다른 쓰기다. */
    expect(stubbed.calls[0]?.idempotencyKey).toEqual(expect.any(String));
    expect(stubbed.calls[2]?.idempotencyKey).toEqual(expect.any(String));
    expect(stubbed.calls[0]?.idempotencyKey).not.toBe(stubbed.calls[2]?.idempotencyKey);
  });

  describe('⛔ 만들어졌는데 배포되지 않은 창', () => {
    it('배포가 실패하면 「성공」이라 하지 않고 만들어진 번호를 남긴다', async () => {
      const result = await issueAndSettle(stub({ fail: 'release' }));

      expect(result.current.undelivered).toEqual(WORK_ORDER);
      expect(result.current.released).toBeNull();
      expect(result.current.error).not.toBeNull();
    });

    it('⛔ 발행 자체가 실패하면 남길 W/O 가 없다 — 배포 재시도가 열리지 않는다', async () => {
      const stubbed = stub({ fail: 'create' });
      const result = await issueAndSettle(stubbed);

      expect(result.current.error).not.toBeNull();
      expect(result.current.undelivered).toBeNull();
      expect(stubbed.calls).toHaveLength(1);
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
      expect(stubbed.calls.filter((call) => call.path === '/production/work-orders')).toHaveLength(
        1,
      );
    });

    it('재시도가 성공하면 배포 안 됨을 지운다', async () => {
      const result = await issueAndSettle(stub({ failFirstRelease: true }));

      await retryAndSettle(result);

      expect(result.current.released).toEqual(WORK_ORDER);
      expect(result.current.undelivered).toBeNull();
    });

    /*
     * ⛔ 배포가 끝나면 그 키를 **버려야** 한다. 남겨 두면 다음 배포가 끝난 키로 나가고,
     * 서버는 계약대로 **실행 없이 앞 응답을 되돌려 준다** — 화면은 그것을 성공으로 읽어,
     * 일어나지 않은 배포를 일어났다고 단언한다.
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
      expect(result.current.released).toEqual(WORK_ORDER);
    });

    expect(stubbed.calls).toHaveLength(3);
    /* 누른 적 없는 실패가 화면에 뜨지 않는다. */
    expect(result.current.error).toBeNull();
  });
});
