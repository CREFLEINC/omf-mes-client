import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import type { CancelResource } from './document-types';
import {
  approvalKeys,
  cancelResourceDetailPath,
  cancelResourceKeys,
  useCancelApprovalRequest,
  useCancelResourceLock,
  useExecuteDocumentCancel,
  useRequestDocumentCancel,
  type CancelTarget,
} from './queries';

/**
 * ⭐ **리소스 세 값을 고르는 자리는 이 화면에 하나뿐이다**(`queries.ts`의 `cancelResourceApiOf`).
 * 그 자리가 값마다 다른 주소를 두드리는지 **이 파일이 값마다 잰다** — 화면 수준 감지기는 유형
 * 표에 실린 값 하나만 지나므로, 나머지 두 값이 조용히 같은 경로로 접혀도 전부 통과한다.
 *
 * **주소를 리터럴로 적는다.** `cancelResourceDetailPath`로 기대값을 만들면 그 함수가 틀렸을 때
 * 기대값도 함께 틀려 감지기가 아무 말도 하지 않는다(동어반복).
 */
const DOCUMENT_ID = 9001;

const RESOURCE_PATHS: Record<CancelResource, string> = {
  'goods-receipts': '/logistics/goods-receipts/9001',
  'inbound-receipts': '/logistics/inbound-receipts/9001',
  'goods-issues': '/logistics/goods-issues/9001',
};

const RESOURCES = Object.keys(RESOURCE_PATHS) as CancelResource[];

const ETAG = '"token-9001"';

interface Recorded {
  method: string;
  pathname: string;
  headers: Headers;
  body: unknown;
  /**
   * 실제로 나간 본문 **글자 그대로**.
   *
   * ⭐ **「본문이 없다」를 재려면 이 자리가 필요하다**(완료 조건 C4-11). 파싱한 값만 두면 본문
   * 없음과 `null` 본문이 같은 모양이 되고, 빈 객체(`{}`)를 싣는 구현도 파싱 뒤에는 구분되지만
   * 「아무것도 싣지 않았다」와는 여전히 섞인다.
   */
  rawBody: string;
}

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: Recorded[] } => {
  const requests: Recorded[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const rawBody = request.method === 'GET' ? '' : await request.clone().text();

    requests.push({
      method: request.method,
      pathname: new URL(request.url).pathname,
      headers: new Headers(request.headers),
      body: rawBody === '' ? null : JSON.parse(rawBody),
      rawBody,
    });

    return stub(request);
  };

  return { fetch, requests };
};

/** 리소스 상세 — 어느 주소로 와도 `ETag`를 준다. 갈래를 가르는 것은 **나간 주소**다. */
const anyResourceDetailRoute: StubRoute = {
  match: (request) =>
    request.method === 'GET' &&
    Object.values(RESOURCE_PATHS).includes(new URL(request.url).pathname),
  respond: () => jsonResponse({}, { headers: { ETag: ETAG } }),
};

const anyRequestCancelRoute: StubRoute = {
  match: (request) =>
    request.method === 'POST' &&
    Object.values(RESOURCE_PATHS).some(
      (path) => new URL(request.url).pathname === `${path}:request-cancel`,
    ),
  respond: () => jsonResponse({ approvalRequestId: 9601 }, { status: 202 }),
};

/** ⛔ 취소 실행 — 어느 리소스로 와도 200을 준다. 갈래를 가르는 것은 **나간 주소**다. */
const anyExecuteCancelRoute: StubRoute = {
  match: (request) =>
    request.method === 'POST' &&
    Object.values(RESOURCE_PATHS).some(
      (path) => new URL(request.url).pathname === `${path}:cancel`,
    ),
  respond: () =>
    jsonResponse({
      documentTypeCode: 'SYN_DOC_TYPE_B',
      documentId: DOCUMENT_ID,
      statusCode: 'SYN_STATUS_CANCELLED',
      reversed: false,
    }),
};

const APPROVAL_REQUEST_ID = 9501;
const APPROVAL_PATH = '/app/approval-requests/9501';

const approvalRoute: StubRoute = {
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === APPROVAL_PATH,
  respond: () =>
    jsonResponse({
      request: {
        approvalRequestId: APPROVAL_REQUEST_ID,
        approvalRequestNo: 'SYN-AP-2026-0001',
        approvalTypeCode: 'SYN_APPROVAL_TYPE_CANCEL',
        requestedBy: 9701,
        requestedByName: '이상신',
        requestedAt: '2026-08-06T14:20:00+09:00',
        statusCode: 'SYN_APPROVAL_IN_PROGRESS',
        reason: '합성 사유',
        target: {
          targetTypeCode: 'SYN_TARGET_DOC',
          targetId: DOCUMENT_ID,
          displayName: 'SYN-GR-2026-0001',
          openable: false,
        },
        currentStepNo: 1,
        totalStepNo: 1,
        isMyTurn: false,
      },
      steps: [],
    }),
};

/**
 * 승인 요청을 **부를 수 있는 어떤 주소든** 받는 규칙.
 *
 * ⭐ **`/app/approval-requests/0`처럼 나가면 안 되는 주소까지 받는다** — 스텁이 받아 주지 않으면
 * 하네스가 던져 「요청이 나갔다」가 실패로 보이지만, 그것은 **부르지 않았다는 증명이 아니다.**
 * 받아 준 뒤 **기록으로 0건임을 재는** 것이 부르지 않았다는 증명이다.
 */
const anyApprovalRoute: StubRoute = {
  match: (request) =>
    request.method === 'GET' && new URL(request.url).pathname.startsWith('/app/approval-requests/'),
  respond: () => jsonResponse({ message: '이 주소는 나가면 안 된다' }, { status: 500 }),
};

describe('cancelResourceDetailPath', () => {
  /**
   * ⭐ **토큰 보관소가 응답이 온 URL 경로를 열쇠로 쓴다.** 이 문자열이 실제 조회 주소와 어긋나면
   * 보관소가 늘 비어 있고, 공통 쓰기 훅은 요청을 **아예 보내지 않은 채** 멈춘다 — 증상이
   * 「눌러도 아무 일이 없다」라 알아채기 어렵다.
   */
  it.each(RESOURCES)('%s의 경로를 만든다', (resource) => {
    expect(cancelResourceDetailPath(resource, DOCUMENT_ID)).toBe(RESOURCE_PATHS[resource]);
  });
});

describe('cancelResourceKeys', () => {
  /**
   * **리소스와 번호가 함께 열쇠다.** 번호만 쓰면 리소스가 다른 같은 번호의 문서가 한 캐시 항목을
   * 나눠 쓰고, 그 항목은 실제로 **다른 문서의 잠금 토큰**이다.
   */
  it('리소스가 다르면 다른 키다', () => {
    expect(cancelResourceKeys.detail('goods-receipts', DOCUMENT_ID)).not.toEqual(
      cancelResourceKeys.detail('goods-issues', DOCUMENT_ID),
    );
  });

  it('번호가 다르면 다른 키다', () => {
    expect(cancelResourceKeys.detail('goods-receipts', 9001)).not.toEqual(
      cancelResourceKeys.detail('goods-receipts', 9002),
    );
  });

  /** 뿌리 키가 상세 키의 앞머리다 — 갈리면 성공 뒤 무효화가 상세를 끌고 오지 못한다. */
  it('뿌리 키가 상세 키의 앞머리다', () => {
    expect(cancelResourceKeys.detail('goods-receipts', DOCUMENT_ID).slice(0, 1)).toEqual([
      ...cancelResourceKeys.all,
    ]);
  });
});

describe('useCancelResourceLock — 값마다 다른 주소를 두드린다', () => {
  it.each(RESOURCES)('%s면 그 리소스의 상세를 부른다', async (resource) => {
    const { fetch, requests } = recordingFetch([anyResourceDetailRoute]);
    const target: CancelTarget = { resource, documentId: DOCUMENT_ID };

    const { result } = renderHookWithProviders(() => useCancelResourceLock(target), { fetch });

    await waitFor(() => {
      expect(result.current.data).toEqual(target);
    });

    expect(requests.map((request) => request.pathname)).toEqual([RESOURCE_PATHS[resource]]);
  });

  /** 대상이 없으면 부를 주소가 없다 — 취소 경로가 없는 유형이 그 상태다. */
  it('대상이 없으면 한 번도 부르지 않는다', async () => {
    const { fetch, requests } = recordingFetch([anyResourceDetailRoute]);

    const { result } = renderHookWithProviders(() => useCancelResourceLock(null), { fetch });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(requests).toHaveLength(0);
  });
});

describe('useRequestDocumentCancel — 값마다 다른 주소로 상신한다', () => {
  it.each(RESOURCES)('%s면 그 리소스의 취소 요청 경로로 나간다', async (resource) => {
    const { fetch, requests } = recordingFetch([anyResourceDetailRoute, anyRequestCancelRoute]);

    const { result } = renderHookWithProviders(
      () => ({
        /* 토큰을 먼저 확보한다 — 계약이 `If-Match`를 필수로 두어 없으면 요청이 나가지 않는다. */
        lock: useCancelResourceLock({ resource, documentId: DOCUMENT_ID }),
        write: useRequestDocumentCancel({
          resource,
          documentId: DOCUMENT_ID,
          onSuccess: () => undefined,
        }),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.lock.data).not.toBeUndefined();
    });

    result.current.write.write({ reason: '합성 사유' });

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    });

    const sent = requests.filter((request) => request.method === 'POST')[0];

    expect(sent?.pathname).toBe(`${RESOURCE_PATHS[resource]}:request-cancel`);
    expect(sent?.headers.get('If-Match')).toBe(ETAG);
    expect(sent?.body).toEqual({ reason: '합성 사유' });
  });

  /**
   * ⛔ **없는 값을 메우지 않는다.** `etagPath`가 `null`이면 공통 훅은 「잠금이 필요 없다」로 읽어
   * 요청을 **그대로 내보내는데**, 대체값을 두면 `…/0:request-cancel`이 실제로 나갈 수 있는
   * 모양이 된다 — 그것은 **남의 문서에 취소를 상신하는** 요청이다.
   */
  it('대상이 없으면 아무 요청도 내보내지 않는다', async () => {
    const { fetch, requests } = recordingFetch([anyResourceDetailRoute, anyRequestCancelRoute]);

    const { result } = renderHookWithProviders(
      () =>
        useRequestDocumentCancel({
          resource: null,
          documentId: null,
          onSuccess: () => undefined,
        }),
      { fetch },
    );

    result.current.write({ reason: '합성 사유' });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(requests).toHaveLength(0);
  });
});

describe('approvalKeys', () => {
  /** 뿌리 키가 상세 키의 앞머리다 — 갈리면 성공 뒤 무효화가 승인 진행을 끌고 오지 못한다. */
  it('뿌리 키가 상세 키의 앞머리다', () => {
    expect(approvalKeys.detail(APPROVAL_REQUEST_ID).slice(0, 1)).toEqual([...approvalKeys.all]);
  });

  /**
   * **진행현황·리소스 상세와 앞머리가 겹치지 않는다** — 겹치면 한쪽만 다시 부르려 해도 다른
   * 쪽이 끌려간다.
   */
  it('다른 자원의 뿌리와 앞머리가 겹치지 않는다', () => {
    expect(approvalKeys.all[0]).not.toBe(cancelResourceKeys.all[0]);
  });

  it('요청 번호가 다르면 다른 키다', () => {
    expect(approvalKeys.detail(9501)).not.toEqual(approvalKeys.detail(9502));
  });
});

describe('useCancelApprovalRequest — C4-1 · C4-2', () => {
  it('쓸 수 있는 값이면 그 번호의 승인 요청을 부른다', async () => {
    const { fetch, requests } = recordingFetch([approvalRoute]);

    const { result } = renderHookWithProviders(
      () => useCancelApprovalRequest({ kind: 'submitted', approvalRequestId: APPROVAL_REQUEST_ID }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.data).not.toBeUndefined();
    });

    expect(requests.map((request) => request.pathname)).toEqual([APPROVAL_PATH]);
  });

  /**
   * ⛔ **없는 값을 0으로 메우지 않는다.** 메우면 `/app/approval-requests/0`이 실제로 나가
   * 남의 요청을 열거나 헛돈다. 스텁이 그 주소를 **받아 주는데도** 기록이 0건이어야 한다.
   */
  it.each([
    ['요청이 없으면', { kind: 'notSubmitted' } as const],
    ['조회할 수 없는 값이면', { kind: 'unusable' } as const],
  ])('%s 한 번도 부르지 않는다', async (_label, submission) => {
    const { fetch, requests } = recordingFetch([anyApprovalRoute]);

    const { result } = renderHookWithProviders(() => useCancelApprovalRequest(submission), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(requests).toHaveLength(0);
  });
});

describe('useExecuteDocumentCancel — 값마다 다른 주소로 실행한다 · C4-11', () => {
  /**
   * ⭐ **리소스 세 값을 고르는 자리가 상신과 같은 하나다**(`cancelResourceApiOf`). 화면 수준
   * 감지기는 유형 표에 실린 값 하나만 지나므로, 나머지 두 값이 조용히 같은 경로로 접혀도
   * 전부 통과한다 — 그래서 여기서 **값마다** 잰다.
   */
  it.each(RESOURCES)('%s면 그 리소스의 취소 실행 경로로 나간다', async (resource) => {
    const { fetch, requests } = recordingFetch([anyResourceDetailRoute, anyExecuteCancelRoute]);

    const { result } = renderHookWithProviders(
      () => ({
        /* 토큰을 먼저 확보한다 — 계약이 `If-Match`를 필수로 두어 없으면 요청이 나가지 않는다. */
        lock: useCancelResourceLock({ resource, documentId: DOCUMENT_ID }),
        write: useExecuteDocumentCancel({
          resource,
          documentId: DOCUMENT_ID,
          onSuccess: () => undefined,
        }),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.lock.data).not.toBeUndefined();
    });

    result.current.write.write();

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    });

    const sent = requests.filter((request) => request.method === 'POST')[0];

    expect(sent?.pathname).toBe(`${RESOURCE_PATHS[resource]}:cancel`);
    expect(sent?.headers.get('If-Match')).toBe(ETAG);
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /**
   * ⭐ **본문이 없다**(계약이 `requestBody`를 두지 않았다). 빈 객체라도 실으면 계약 밖의 요청이
   * 되고, 무엇보다 「보낼 값이 없다」는 이 조작의 성질이 흐려진다.
   */
  it('본문 없이 나간다', async () => {
    const { fetch, requests } = recordingFetch([anyResourceDetailRoute, anyExecuteCancelRoute]);

    const { result } = renderHookWithProviders(
      () => ({
        lock: useCancelResourceLock({ resource: 'goods-receipts', documentId: DOCUMENT_ID }),
        write: useExecuteDocumentCancel({
          resource: 'goods-receipts',
          documentId: DOCUMENT_ID,
          onSuccess: () => undefined,
        }),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.lock.data).not.toBeUndefined();
    });

    result.current.write.write();

    await waitFor(() => {
      expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    });

    expect(requests.filter((request) => request.method === 'POST')[0]?.rawBody).toBe('');
  });

  /** 응답을 **화면 타입으로 옮겨** 넘긴다 — 내부 번호가 화면 쪽으로 새지 않는다. */
  it('성공 콜백이 화면 타입을 받는다', async () => {
    const { fetch } = recordingFetch([anyResourceDetailRoute, anyExecuteCancelRoute]);
    const received: unknown[] = [];

    const { result } = renderHookWithProviders(
      () => ({
        lock: useCancelResourceLock({ resource: 'goods-receipts', documentId: DOCUMENT_ID }),
        write: useExecuteDocumentCancel({
          resource: 'goods-receipts',
          documentId: DOCUMENT_ID,
          onSuccess: (view) => received.push(view),
        }),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.lock.data).not.toBeUndefined();
    });

    result.current.write.write();

    await waitFor(() => {
      expect(received).toHaveLength(1);
    });

    expect(received[0]).toEqual({
      statusCode: 'SYN_STATUS_CANCELLED',
      reversed: false,
      reversalTransactionNo: null,
      reversalBusinessDate: null,
    });
  });

  /**
   * ⛔ **없는 값을 메우지 않는다** — 상신 쪽과 같은 규율이고 대가는 더 크다. `etagPath`가 `null`이면
   * 공통 훅이 「잠금이 필요 없다」로 읽어 요청을 **그대로 내보내는데**, 이 요청은 원장에서 수량을
   * 되돌린다.
   */
  it('대상이 없으면 아무 요청도 내보내지 않는다', async () => {
    const { fetch, requests } = recordingFetch([anyResourceDetailRoute, anyExecuteCancelRoute]);

    const { result } = renderHookWithProviders(
      () =>
        useExecuteDocumentCancel({ resource: null, documentId: null, onSuccess: () => undefined }),
      { fetch },
    );

    result.current.write();

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(requests).toHaveLength(0);
  });
});
