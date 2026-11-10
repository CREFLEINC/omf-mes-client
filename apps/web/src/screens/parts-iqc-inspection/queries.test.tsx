import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useSubmitInspection, type SubmitVariables } from './queries';

const VARIABLES: SubmitVariables = {
  inspectionRequestId: 7,
  draftResultId: null,
  previousResultId: 31,
  uomId: 1,
  inspectedAt: '2026-11-09T00:00:00Z',
  inspectedQty: 10,
  rejectedQty: 0,
  overallJudgmentCode: 'ACCEPTED',
  measurements: [],
  defects: [],
  remarks: '',
};

const submit = async (variables: SubmitVariables): Promise<Record<string, unknown>> => {
  const bodies: Record<string, unknown>[] = [];
  const { result } = renderHookWithProviders(() => useSubmitInspection(() => undefined), {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/quality/inspection-results',
        respond: async (request) => {
          bodies.push((await request.clone().json()) as Record<string, unknown>);
          return jsonResponse({ inspectionResultId: 32, versionNo: 1 }, { status: 201 });
        },
      },
      {
        match: (request) => new URL(request.url).pathname.endsWith(':confirm'),
        respond: () => jsonResponse({ inspectionResultId: 32, versionNo: 2 }),
      },
    ]),
  });
  act(() => result.current.write(variables));
  await waitFor(() => expect(bodies).toHaveLength(1));
  return bodies[0] as Record<string, unknown>;
};

describe('useSubmitInspection 재검사', () => {
  it('재검사면 앞 회차를 싣는다', async () => {
    expect(await submit(VARIABLES)).toMatchObject({ previousResultId: 31 });
  });

  it('재검사가 아니면 앞 회차 키를 싣지 않는다', async () => {
    expect(await submit({ ...VARIABLES, previousResultId: null })).not.toHaveProperty(
      'previousResultId',
    );
  });
});

describe('useSubmitInspection OA 4M 변경 정보 (#247)', () => {
  it('고친 4M 변경품을 회차 저장에 싣는다', async () => {
    expect(await submit({ ...VARIABLES, fourMChange: { remarks: '원자재 변경' } })).toMatchObject({
      fourMChange: { remarks: '원자재 변경' },
    });
  });

  it('변경품을 풀면 `null` 을 싣고, 손대지 않으면 키를 싣지 않는다', async () => {
    expect(await submit({ ...VARIABLES, fourMChange: null })).toMatchObject({ fourMChange: null });
    expect(await submit(VARIABLES)).not.toHaveProperty('fourMChange');
  });

  it('임시 저장은 판정을 고르지 않았으면 판정 키를 싣지 않는다', async () => {
    expect(
      await submit({ ...VARIABLES, overallJudgmentCode: '', draftOnly: true }),
    ).not.toHaveProperty('overallJudgmentCode');
  });
});
