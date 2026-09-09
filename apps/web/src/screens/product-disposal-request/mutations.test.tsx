import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useDisposalRequestMutation, type DisposalRequestPayload } from './mutations';

/**
 * 「승인 요청」 한 번이 보내는 **두 호출**의 시험.
 *
 * ⭐ **여기서 가장 비싼 실패는 「첫 호출 성공 + 둘째 호출 실패」다.** 그것을 성공으로 접으면
 * 결재가 돌지 않는 전표가 남고 사용자는 오지 않을 승인을 기다린다. 되돌리는 길은 승인을 타는
 * 출고 취소뿐이고 그것은 다른 화면 소관이다.
 */

const CREATED = {
  goodsIssue: {
    goodsIssueId: 4001,
    goodsIssueNo: 'GI-2026-000401',
    issueTypeCode: 'OTHER',
    sourceDocumentTypeCode: 'DISPOSITION_DECISION' as const,
    sourceDocumentId: 7001,
    sourceWarehouseId: 11,
    issuedAt: '2026-09-09T10:00:00+09:00',
    statusCode: 'DRAFT',
  },
  lines: [],
};

const PAYLOAD: DisposalRequestPayload = {
  issue: {
    issueTypeCode: 'OTHER',
    sourceDocumentTypeCode: 'DISPOSITION_DECISION',
    sourceDocumentId: 7001,
    sourceWarehouseId: 11,
    issuedAt: '2026-09-09T10:00:00+09:00',
    businessDate: '2026-09-09',
    occurredAt: '2026-09-09T10:00:00+09:00',
    reasonCode: 'DEFECT_AFTER_RECEIPT',
    destinationTypeCode: null,
    destinationId: null,
    postImmediately: false,
    lines: [{ itemId: 501, lotId: 9001, issueQty: 40, uomId: 3, sourceLocationId: 77 }],
  },
  approval: { reason: '재작업 불가 — 변형 손상' },
};

const isCreate = (request: Request): boolean =>
  request.method === 'POST' && request.url.endsWith('/logistics/goods-issues');

const isSubmit = (request: Request): boolean =>
  request.method === 'POST' && request.url.includes(':request-approval');

/** 생성은 201 + ETag. 잠금 토큰이 여기서 나온다. */
const createRoute = (calls: Request[]): StubRoute => ({
  match: isCreate,
  respond: (request) => {
    calls.push(request.clone());
    return jsonResponse(CREATED, { status: 201, headers: { ETag: 'W/"7"' } });
  },
});

const submitRoute = (calls: Request[], respond: () => Response): StubRoute => ({
  match: isSubmit,
  respond: (request) => {
    calls.push(request.clone());
    return respond();
  },
});

const renderMutation = (routes: StubRoute[]) =>
  renderHookWithProviders(() => useDisposalRequestMutation({ onSuccess: () => undefined }), {
    fetch: createStubFetch(routes),
  });

describe('useDisposalRequestMutation — 승인 요청의 두 호출', () => {
  /**
   * ⛔ **상신 본문이 빠지면 결재함 목록 요약이 빈다**(통지 #675 §3).
   *
   * `approval_request` 에 업무 값이 `reason` 하나뿐이라, 그 문장이 승인자가 보는 전부다.
   * 「본문을 보낸다」로만 단언하면 빈 객체를 보내도 통과하므로 **사유 문자열을 이름으로 지목한다.**
   */
  it('상신 본문에 사유를 싣는다', async () => {
    const creates: Request[] = [];
    const submits: Request[] = [];
    const { result } = renderMutation([
      createRoute(creates),
      submitRoute(submits, () => jsonResponse({}, { status: 202 })),
    ]);

    act(() => result.current.write(PAYLOAD));

    await waitFor(() => expect(submits).toHaveLength(1));

    const body: unknown = await submits[0]?.json();

    expect(body).toEqual({ reason: '재작업 불가 — 변형 손상' });
  });

  /** ⛔ 계약이 `If-Match` 를 필수로 받는다. 토큰은 방금 만든 전표의 201 응답에서 온다. */
  it('상신에 생성 응답의 ETag 를 잠금 토큰으로 싣는다', async () => {
    const submits: Request[] = [];
    const { result } = renderMutation([
      createRoute([]),
      submitRoute(submits, () => jsonResponse({}, { status: 202 })),
    ]);

    act(() => result.current.write(PAYLOAD));

    await waitFor(() => expect(submits).toHaveLength(1));

    expect(submits[0]?.headers.get('If-Match')).toBe('W/"7"');
  });

  /**
   * ⛔ **두 호출의 멱등 키는 달라야 한다** — 같으면 원장이 둘을 한 건으로 본다.
   */
  it('두 호출이 서로 다른 멱등 키를 쓴다', async () => {
    const creates: Request[] = [];
    const submits: Request[] = [];
    const { result } = renderMutation([
      createRoute(creates),
      submitRoute(submits, () => jsonResponse({}, { status: 202 })),
    ]);

    act(() => result.current.write(PAYLOAD));

    await waitFor(() => expect(submits).toHaveLength(1));

    const createKey = creates[0]?.headers.get('Idempotency-Key');
    const submitKey = submits[0]?.headers.get('Idempotency-Key');

    expect(createKey).toBeTruthy();
    expect(submitKey).toBeTruthy();
    expect(submitKey).not.toBe(createKey);
  });

  /**
   * ⛔ **재시도가 새 상신이 되면 안 된다.**
   *
   * 상신 철회 경로가 승인 계약에 없어(§5-6) 그렇게 생긴 중복 결재는 지워지지 않는다.
   * 「키가 같다」만 단언하지 않고 **첫 시도의 키를 이름으로 잡아 두 번째와 견준다** — 둘 다
   * 비어 있어도 통과하는 시험이 되지 않게.
   */
  it('같은 요청을 다시 보내면 상신 멱등 키가 그대로다', async () => {
    const submits: Request[] = [];
    const { result } = renderMutation([
      createRoute([]),
      submitRoute(submits, () => jsonResponse({ code: 'TIMEOUT' }, { status: 504 })),
    ]);

    act(() => result.current.write(PAYLOAD));
    await waitFor(() => expect(submits).toHaveLength(1));

    act(() => result.current.write(PAYLOAD));
    await waitFor(() => expect(submits).toHaveLength(2));

    const first = submits[0]?.headers.get('Idempotency-Key');

    expect(first).toBeTruthy();
    expect(submits[1]?.headers.get('Idempotency-Key')).toBe(first);
  });

  /**
   * ⛔ **전표는 만들어졌는데 상신이 실패한 것을 성공으로 접지 않는다.**
   *
   * 접으면 결재가 돌지 않는 전표가 남는다. 「오류가 있다」로만 단언하면 엉뚱한 사유로 실패해도
   * 통과하므로 **첫 호출이 실제로 갔다는 것까지 함께 잡는다.**
   */
  it('상신이 실패하면 전표가 만들어졌어도 오류로 남는다', async () => {
    const creates: Request[] = [];
    const { result } = renderMutation([
      createRoute(creates),
      submitRoute([], () => jsonResponse({ code: 'ROUTE_NOT_FOUND' }, { status: 400 })),
    ]);

    act(() => result.current.write(PAYLOAD));

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(creates).toHaveLength(1);
    expect(result.current.isSaving).toBe(false);
  });

  /** 생성이 실패하면 **상신하지 않는다** — 상신할 대상이 없다. */
  it('전표 생성이 실패하면 상신하지 않는다', async () => {
    const submits: Request[] = [];
    const { result } = renderMutation([
      {
        match: isCreate,
        respond: () => jsonResponse({ code: 'VALIDATION' }, { status: 400 }),
      },
      submitRoute(submits, () => jsonResponse({}, { status: 202 })),
    ]);

    act(() => result.current.write(PAYLOAD));

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(submits).toHaveLength(0);
  });

  /**
   * ⛔ **잠금 토큰이 없으면 상신하지 않는다.**
   *
   * `?? ''` 로 메우면 빈 토큰이 나가고, 서버의 거부가 화면에서 「저장이 반려됐다」로 읽힌다 —
   * 실제로는 물어보지도 못한 것이다.
   */
  it('생성 응답에 ETag 가 없으면 상신하지 않는다', async () => {
    const submits: Request[] = [];
    const { result } = renderMutation([
      {
        match: isCreate,
        respond: () => jsonResponse(CREATED, { status: 201 }),
      },
      submitRoute(submits, () => jsonResponse({}, { status: 202 })),
    ]);

    act(() => result.current.write(PAYLOAD));

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(submits).toHaveLength(0);
  });

  /** ⭐ 사유를 고쳐 다시 보내면 **다른 쓰기**다 — 첫 요청의 응답으로 덮이면 안 된다. */
  it('사유가 바뀌면 멱등 키가 새로 난다', async () => {
    const submits: Request[] = [];
    const { result } = renderMutation([
      createRoute([]),
      submitRoute(submits, () => jsonResponse({ code: 'TIMEOUT' }, { status: 504 })),
    ]);

    act(() => result.current.write(PAYLOAD));
    await waitFor(() => expect(submits).toHaveLength(1));

    act(() => result.current.write({ ...PAYLOAD, approval: { reason: '보관 비용으로 폐기한다' } }));
    await waitFor(() => expect(submits).toHaveLength(2));

    expect(submits[1]?.headers.get('Idempotency-Key')).not.toBe(
      submits[0]?.headers.get('Idempotency-Key'),
    );
  });
});
