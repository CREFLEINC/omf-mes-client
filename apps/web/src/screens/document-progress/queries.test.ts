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
  cancelResourceDetailPath,
  cancelResourceKeys,
  useCancelResourceLock,
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
}

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: Recorded[] } => {
  const requests: Recorded[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    const body: unknown = request.method === 'GET' ? null : await request.clone().json();

    requests.push({
      method: request.method,
      pathname: new URL(request.url).pathname,
      headers: new Headers(request.headers),
      body,
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
