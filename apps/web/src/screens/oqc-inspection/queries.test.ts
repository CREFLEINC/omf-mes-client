import { messages } from '@omf-mes/i18n';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { EMPTY_FILTERS, toListQuery } from './filters';
import { confirmedRound, queueResponse, waitingRequest } from './fixtures';
import {
  toResultCreateBody,
  useInspectionQueue,
  useSaveInspectionResult,
  type SaveResultVariables,
} from './queries';

const t = messages.oqcInspection;

const VARIABLES: SaveResultVariables = {
  inspectionRequestId: waitingRequest.inspectionRequestId,
  inspectedQty: 500,
  acceptedQty: 480,
  rejectedQty: 15,
  heldQty: 5,
  uomId: 10,
  overallJudgmentCode: 'ACCEPTED',
  inspectedAt: '2026-08-30T10:00:00+09:00',
  previousResultId: null,
};

/**
 * ⭐ **집중 지점 V3 — 고른 판정이 몸통에 실린다.**
 *
 * 「고르지 않으면 키 자체가 없다」는 화면으로 잴 수 없다(고르지 않으면 저장 자체가 막힌다) —
 * 그래서 몸통 만드는 자리를 직접 부른다.
 */
describe('toResultCreateBody', () => {
  it('언제나 확정으로 보낸다 — 이 화면에는 임시 저장이 없다', () => {
    expect(toResultCreateBody(VARIABLES).statusCode).toBe('확정');
  });

  it('고른 판정을 싣는다', () => {
    expect(toResultCreateBody(VARIABLES).overallJudgmentCode).toBe('ACCEPTED');
  });

  it('고르지 않았으면 키 자체가 없다 — 빈 문자열은 코드가 아니다', () => {
    const body = toResultCreateBody({ ...VARIABLES, overallJudgmentCode: '' });

    expect('overallJudgmentCode' in body).toBe(false);
  });

  it('재검사가 아니면 previousResultId 키를 싣지 않는다 — null 은 「사슬을 끊어라」로 읽힐 수 있다', () => {
    expect('previousResultId' in toResultCreateBody(VARIABLES)).toBe(false);
    expect(toResultCreateBody({ ...VARIABLES, previousResultId: 9101 }).previousResultId).toBe(
      9101,
    );
  });

  it('검사자·단말·재검사 사유를 보내지 않는다 — 앞 둘은 서버가 풀고 셋째는 값 목록이 없다', () => {
    const body = toResultCreateBody(VARIABLES);

    expect('inspectorId' in body).toBe(false);
    expect('terminalId' in body).toBe(false);
    expect('reinspectionReasonCode' in body).toBe(false);
  });
});

describe('useInspectionQueue', () => {
  it('고정 축 OQC 를 싣고 기간·상태를 싣지 않는다', async () => {
    let sent: URL | undefined;

    const { result } = renderHookWithProviders(
      () => useInspectionQueue(toListQuery(EMPTY_FILTERS, 1)),
      {
        fetch: createStubFetch([
          {
            match: (request) => new URL(request.url).pathname === '/quality/inspection-requests',
            respond: (request) => {
              sent = new URL(request.url);
              return jsonResponse(queueResponse());
            },
          },
        ]),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sent?.searchParams.get('inspectionTypeCode')).toBe('OQC');
    expect(sent?.searchParams.get('pendingOnly')).toBe('true');
    expect(sent?.searchParams.get('size')).toBe('50');
    expect(sent?.searchParams.has('statusCode')).toBe(false);
    expect(sent?.searchParams.has('requestedFrom')).toBe(false);
    expect(sent?.searchParams.has('inspectedFrom')).toBe(false);
    expect(result.current.data?.rows).toHaveLength(3);
  });
});

/** 저장 요청 하나를 받는 스텁. 응답을 바깥에서 정한다. */
const saveStub = (respond: (request: Request) => Response, sink: Request[]) =>
  createStubFetch([
    {
      match: (request) =>
        new URL(request.url).pathname === '/quality/inspection-results' &&
        request.method === 'POST',
      respond: (request) => {
        sink.push(request);
        return respond(request);
      },
    },
  ]);

describe('useSaveInspectionResult — 확정 배선(V1)', () => {
  it('확정 경로로 보내고 멱등 키를 싣되 If-Match 는 보내지 않는다', async () => {
    const sent: Request[] = [];

    const { result } = renderHookWithProviders(
      () => useSaveInspectionResult(waitingRequest.inspectionRequestId, () => undefined),
      { fetch: saveStub(() => jsonResponse(confirmedRound, { status: 201 }), sent) },
    );

    act(() => {
      result.current.write(VARIABLES);
    });

    await waitFor(() => expect(sent).toHaveLength(1));

    const request = sent[0];

    expect(new URL(request?.url ?? '').pathname).toBe('/quality/inspection-results');
    expect(request?.headers.get('Idempotency-Key')).toBeTruthy();
    /* ⛔ 빈 If-Match 는 계약 위반이라 서버가 400 으로 되돌린다 — 헤더 자체를 만들지 않는다. */
    expect(request?.headers.has('If-Match')).toBe(false);
    await expect(request?.clone().json()).resolves.toMatchObject({ statusCode: '확정' });
  });
});

/**
 * ⭐ **집중 지점 V5 — 409 두 갈래를 화면 안에서 되말한다.**
 *
 * `DUPLICATE_KEY`·`INVALID_STATE` 는 `conflictCause` 를 싣지 않아 공유 정규화기가
 * `kind:'http'` 로 떨어뜨리고 서버 원문만 남는다. `VERSION_CONFLICT` 는 되말하지 **않는다** —
 * 공유 배너의 원인별 문구가 이미 정확하다.
 */
describe('useSaveInspectionResult — 409 되말하기(V5)', () => {
  const writeAndWait = async (body: unknown) => {
    const sent: Request[] = [];

    const { result } = renderHookWithProviders(
      () => useSaveInspectionResult(waitingRequest.inspectionRequestId, () => undefined),
      { fetch: saveStub(() => jsonResponse(body, { status: 409 }), sent) },
    );

    act(() => {
      result.current.write(VARIABLES);
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    return result;
  };

  it('DUPLICATE_KEY 를 회차 중복 문구로 되말한다', async () => {
    const result = await writeAndWait({ code: 'DUPLICATE_KEY', message: '서버가 준 임의의 원문' });

    expect(result.current.error).toEqual({
      kind: 'http',
      status: 409,
      message: t.save.duplicateRound,
    });
  });

  it('INVALID_STATE 를 「재검사로 진행하세요」로 되말한다', async () => {
    const result = await writeAndWait({ code: 'INVALID_STATE', message: '서버가 준 다른 원문' });

    expect(result.current.error).toEqual({
      kind: 'http',
      status: 409,
      message: t.save.invalidState,
    });
  });

  it('VERSION_CONFLICT 는 되말하지 않는다 — 공유 배너의 원인별 문구가 더 정확하다', async () => {
    const result = await writeAndWait({
      code: 'VERSION_CONFLICT',
      conflictCause: 'user',
      message: '다른 사용자가 먼저 고쳤습니다',
    });

    expect(result.current.error).toMatchObject({ kind: 'conflict', cause: 'user' });
    expect(JSON.stringify(result.current.error)).not.toContain(t.save.duplicateRound);
    expect(JSON.stringify(result.current.error)).not.toContain(t.save.invalidState);
  });
});
