import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { createdRequestFixture } from './fixtures';
import {
  toMaterialIssueRequestBody,
  type MaterialIssueRequestInput,
} from './material-issue-request-body';
import { useMaterialIssueRequestMutation } from './mutations';
import type { MaterialIssueRequestCreate, MaterialIssueLineDraft } from './types';

/**
 * 집중 갈래 — **멱등 키의 수명과 제출 순간의 고정**(D-5).
 *
 * ⭐ 이 화면에서 가장 조용한 결함이다. 본문 조립 안에서 `new Date()` 를 뜨면 지문이 매번 달라져
 * 키가 매번 새로 나가고, **그 사실은 서버에 전표가 둘 쌓여야 드러난다.** 서버가 중복 요청을
 * 막지 않으므로(스펙 §6) 같은 키가 나가는 것이 유일한 방어선이다.
 */

const CREATE_PATH = '/logistics/material-issue-requests';

const submittedAt = new Date(2026, 8, 1, 0, 12, 30);

const line = (patch: Partial<MaterialIssueLineDraft> = {}): MaterialIssueLineDraft => ({
  key: 'shortage:1',
  origin: 'shortage',
  bomComponentId: 7601,
  itemId: '7401',
  uomId: '7501',
  requiredQty: 200,
  issuedQty: 120,
  shortageQty: 80,
  requestedQty: '80',
  ...patch,
});

const draft = (patch: Partial<MaterialIssueRequestInput> = {}): MaterialIssueRequestInput => ({
  workOrderId: '7101',
  destinationLocationId: '7301',
  requiredDate: '',
  requiredTime: '',
  reasonCode: '',
  remarks: '합성 비고',
  lines: [line()],
  shortage: [],
  ...patch,
});

const bodyOf = (
  input: MaterialIssueRequestInput,
  now: Date = submittedAt,
): MaterialIssueRequestCreate => {
  const body = toMaterialIssueRequestBody(input, now);

  if (body === null) throw new Error('본문을 만들지 못했습니다 — 픽스처가 잘못됐습니다.');

  return body;
};

interface Capture {
  keys: string[];
  ifMatch: (string | null)[];
}

const captureRoutes = (capture: Capture, status: number, payload: unknown): StubRoute[] => [
  {
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === CREATE_PATH,
    respond: (request) => {
      capture.keys.push(request.headers.get('Idempotency-Key') ?? '');
      capture.ifMatch.push(request.headers.get('If-Match'));

      return jsonResponse(payload, { status });
    },
  },
];

describe('useMaterialIssueRequestMutation', () => {
  it('ⓐ 잠금 토큰 없이 멱등 키만 실어 보낸다(etagPath: null)', async () => {
    const capture: Capture = { keys: [], ifMatch: [] };
    const onSuccess = vi.fn();

    const { result } = renderHookWithProviders(
      () => useMaterialIssueRequestMutation({ onSuccess }),
      { fetch: createStubFetch(captureRoutes(capture, 201, createdRequestFixture)) },
    );

    act(() => {
      result.current.write(bodyOf(draft()));
    });

    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    expect(capture.keys[0]).toBeTruthy();
    expect(capture.ifMatch[0]).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith({
      issueRequestNo: 'SAMPLE-MIR-0003',
      statusCode: 'SAMPLE_MIR_S_A',
      lineCount: 1,
    });
  });

  it('ⓑ 같은 초안을 실패 뒤 다시 보내면 **같은 멱등 키**가 나간다', async () => {
    const capture: Capture = { keys: [], ifMatch: [] };
    const routes = captureRoutes(capture, 500, { message: '합성 서버 오류' });

    const { result } = renderHookWithProviders(
      () => useMaterialIssueRequestMutation({ onSuccess: vi.fn() }),
      { fetch: createStubFetch(routes) },
    );

    /* 재시도가 **같은 제출 순간**을 쓴다 — `stampSubmission` 이 화면에서 하는 일과 같다. */
    const body = bodyOf(draft());

    act(() => {
      result.current.write(body);
    });
    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    act(() => {
      result.current.write(body);
    });
    await waitFor(() => {
      expect(capture.keys).toHaveLength(2);
    });

    expect(capture.keys[1]).toBe(capture.keys[0]);
  });

  it('ⓑ-역 제출 순간이 흔들리면 같은 초안인데도 키가 갈린다 — 본문이 `now` 를 인자로 받는 이유', async () => {
    const capture: Capture = { keys: [], ifMatch: [] };
    const routes = captureRoutes(capture, 500, { message: '합성 서버 오류' });

    const { result } = renderHookWithProviders(
      () => useMaterialIssueRequestMutation({ onSuccess: vi.fn() }),
      { fetch: createStubFetch(routes) },
    );

    act(() => {
      result.current.write(bodyOf(draft(), submittedAt));
    });
    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    act(() => {
      result.current.write(bodyOf(draft(), new Date(2026, 8, 1, 0, 13, 45)));
    });
    await waitFor(() => {
      expect(capture.keys).toHaveLength(2);
    });

    expect(capture.keys[1]).not.toBe(capture.keys[0]);
  });

  it('ⓒ 수량을 고치고 보내면 다른 키가 나간다 — 다른 쓰기다', async () => {
    const capture: Capture = { keys: [], ifMatch: [] };
    const routes = captureRoutes(capture, 500, { message: '합성 서버 오류' });

    const { result } = renderHookWithProviders(
      () => useMaterialIssueRequestMutation({ onSuccess: vi.fn() }),
      { fetch: createStubFetch(routes) },
    );

    act(() => {
      result.current.write(bodyOf(draft()));
    });
    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    act(() => {
      result.current.write(bodyOf(draft({ lines: [line({ requestedQty: '50' })] })));
    });
    await waitFor(() => {
      expect(capture.keys).toHaveLength(2);
    });

    expect(capture.keys[1]).not.toBe(capture.keys[0]);
  });

  it('ⓓ 성공한 뒤 같은 값을 다시 보내면 새 키가 나간다 — 끝난 키로 되묻지 않는다', async () => {
    const capture: Capture = { keys: [], ifMatch: [] };
    const routes = captureRoutes(capture, 201, createdRequestFixture);

    const { result } = renderHookWithProviders(
      () => useMaterialIssueRequestMutation({ onSuccess: vi.fn() }),
      { fetch: createStubFetch(routes) },
    );

    const body = bodyOf(draft());

    act(() => {
      result.current.write(body);
    });
    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    act(() => {
      result.current.write(body);
    });
    await waitFor(() => {
      expect(capture.keys).toHaveLength(2);
    });

    expect(capture.keys[1]).not.toBe(capture.keys[0]);
  });

  it('검증 실패(400)는 화면이 아는 필드로 인라인 오류를 낸다', async () => {
    const routes: StubRoute[] = [
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname === CREATE_PATH,
        respond: () =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'destinationLocationId',
                  code: 'REQUIRED',
                  message: '필수입니다.',
                },
              ],
            },
            { status: 400 },
          ),
      },
    ];

    const { result } = renderHookWithProviders(
      () => useMaterialIssueRequestMutation({ onSuccess: vi.fn() }),
      { fetch: createStubFetch(routes) },
    );

    act(() => {
      result.current.write(bodyOf(draft()));
    });

    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });

    expect(result.current.fieldErrors.destinationLocationId).toBe('필수입니다.');
  });
});
