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
