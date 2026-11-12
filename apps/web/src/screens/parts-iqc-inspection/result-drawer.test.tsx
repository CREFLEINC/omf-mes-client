import { messages } from '@omf-mes/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { LotMatchField } from './lot-match-field';
import { useSubmitInspection, type SubmitVariables } from './queries';

/**
 * 005 T066 — W-01-01 결과 드로어의 저장(screens/W-01-01.md 「결과 추가·수정 — 오른쪽 드로어」). 지어낸 값만 쓴다.
 * 드로어의 [저장]은 지금 양식의 저장 길(`useSubmitInspection`)을 `draftOnly` + `matchedLotIds` 로 부른다 — 확정하지 않는다.
 */

const t = messages.iqcInboundLot.drawer;

const lot = (lotId: number) => ({
  lotId,
  lotNo: `TST-ITEM|1000|991111|TS01|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: null,
  statusCode: 'INSPECTION_PENDING',
  goodsReceived: false,
});

const variables = (over: Partial<SubmitVariables> = {}): SubmitVariables => ({
  inspectionRequestId: 501,
  draftResultId: null,
  previousResultId: null,
  uomId: 1,
  inspectedAt: '2099-11-11T10:00:00+07:00',
  inspectedQty: 200,
  rejectedQty: 0,
  overallJudgmentCode: 'ACCEPTED',
  measurements: [],
  defects: [],
  remarks: '',
  draftOnly: true,
  ...over,
});

const mountSubmit = () => {
  const sent: { method: string; path: string; body: unknown }[] = [];
  const fetch = createStubFetch([
    {
      match: () => true,
      respond: async (request) => {
        sent.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: request.method === 'GET' ? null : await request.clone().json(),
        });
        return jsonResponse(
          {
            inspectionResultId: 901,
            inspectionResultNo: 'TST-IR-901',
            inspectionRequestId: 501,
            inspectionRound: 1,
            inspectedQty: 200,
            acceptedQty: 200,
            rejectedQty: 0,
            heldQty: 0,
            uomId: 1,
            overallJudgmentCode: 'ACCEPTED',
            statusCode: 'DRAFT',
            versionNo: 1,
          },
          { status: request.method === 'POST' ? 201 : 200 },
        );
      },
    },
  ]);
  const done = vi.fn();
  const hook = renderHookWithProviders(() => useSubmitInspection(done), { fetch });

  return { sent, done, hook };
};

describe('W-01-01 결과 드로어 저장', () => {
  it('US3-1 지금 양식으로 결과 1건 — 결과만 남기고 확정하지 않으며 매칭을 싣는다', async () => {
    const { sent, done, hook } = mountSubmit();

    hook.result.current.write(variables({ matchedLotIds: [1, 2] }));

    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent).toHaveLength(1);
    expect(sent[0]?.path).toBe('/quality/inspection-results');
    expect(sent[0]?.body).toMatchObject({ statusCode: 'DRAFT', matchedLotIds: [1, 2] });
    expect(sent[0]?.body).not.toHaveProperty('previousResultId');
    expect(sent.some((each) => each.path.endsWith(':confirm'))).toBe(false);
  });

  it('US3-4 매칭 없이 저장 — 빈 매칭을 그대로 보낸다', async () => {
    const { sent, done, hook } = mountSubmit();

    hook.result.current.write(variables({ matchedLotIds: [] }));

    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent[0]?.body).toMatchObject({ matchedLotIds: [] });
  });

  it('결과 수정 — 그 결과를 판 번호와 함께 고치고 매칭을 통째로 바꾼다', async () => {
    const { sent, done, hook } = mountSubmit();

    hook.result.current.write(
      variables({ draftResultId: 701, draftVersionNo: 3, matchedLotIds: [3] }),
    );

    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.path).toBe('/quality/inspection-results/701');
    expect(sent[0]?.body).toMatchObject({ matchedLotIds: [3] });
  });

  it('옛 IQC · PQC · OQC 저장은 매칭 칸을 싣지 않는다(지금 동작 그대로)', async () => {
    const { sent, done, hook } = mountSubmit();

    hook.result.current.write(variables({ draftOnly: true }));

    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent[0]?.body).not.toHaveProperty('matchedLotIds');
  });

  it('US3-7 매칭은 이 입하 LOT 의 자재 관리 LOT 만 고른다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <LotMatchField
        lots={[lot(1), lot(2)]}
        otherResults={[]}
        uomCode="EA"
        value={[2]}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.queryByRole('checkbox', { name: lot(9).lotNo })).toBeNull();
    expect(screen.getByText(t.matchNote)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: lot(1).lotNo }));
    expect(onChange).toHaveBeenCalledWith([1, 2]);
  });
});
