import { messages } from '@omf-mes/i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  renderWithProviders,
} from '../../test/api-harness';
import { InboundDetail } from './inbound-detail';
import type { InboundInspection } from './inbound-queries';
import { LotMatchField } from './lot-match-field';
import { useSubmitInspection, type SubmitVariables } from './queries';

/**
 * 005 T066 — W-01-01 결과 드로어의 저장(screens/W-01-01.md 「결과 추가·수정 — 오른쪽 드로어」). 지어낸 값만 쓴다.
 * 드로어의 [저장]은 지금 양식의 저장 길(`useSubmitInspection`)을 `draftOnly` + `matchedLotIds` 로 부른다 — 확정하지 않는다.
 *
 * 판정 규칙 변경(T135 · 2026-11-12): 매칭 1개 이상 필수 · [전부 선택], 불합격 · 보류를 덮는 결과는 재검 사유 필수.
 * 드로어 칸은 지금 IQC 양식 대신 자리표시 양식으로 잰다 — 판정 고르기 · [저장]만 드로어 약속(`InspectionFormDrawer`)대로 부른다.
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

  it('US3-9 재검 사유를 결과 추가 · 수정 본문에 싣는다', async () => {
    const { sent, done, hook } = mountSubmit();

    hook.result.current.write(
      variables({ matchedLotIds: [1], reinspectionReasonCode: 'TST-REMEASURE' }),
    );
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    hook.result.current.write(
      variables({
        draftResultId: 701,
        draftVersionNo: 3,
        matchedLotIds: [1],
        reinspectionReasonCode: 'TST-REMEASURE',
      }),
    );
    await waitFor(() => expect(done).toHaveBeenCalledTimes(2));

    expect(sent[0]?.body).toMatchObject({ reinspectionReasonCode: 'TST-REMEASURE' });
    expect(sent[1]?.method).toBe('PUT');
    expect(sent[1]?.body).toMatchObject({ reinspectionReasonCode: 'TST-REMEASURE' });
  });

  it('재검 사유가 필요 없으면 본문에 싣지 않는다', async () => {
    const { sent, done, hook } = mountSubmit();

    hook.result.current.write(variables({ matchedLotIds: [1] }));

    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent[0]?.body).not.toHaveProperty('reinspectionReasonCode');
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

/* ── 드로어 화면(판정 규칙 변경 · T135) ── */

const result = (
  seqNo: number,
  judgment: string,
  matchedLotIds: number[],
  reasonName: string | null = null,
) => ({
  inspectionResultId: 700 + seqNo,
  inspectionResultNo: `TST-IR-${String(seqNo)}`,
  seqNo,
  overallJudgmentCode: judgment,
  inspectedQty: 200,
  rejectedQty: judgment === 'REJECTED' ? 3 : 0,
  defectNames: [],
  matchedLotIds,
  inspectorName: '합성 검사자',
  inspectedAt: '2099-11-11T01:00:00Z',
  statusCode: 'DRAFT',
  versionNo: 2,
  reinspectionReasonCode: reasonName === null ? null : 'TST-REMEASURE',
  reinspectionReasonName: reasonName,
});

const inspection = (results: ReturnType<typeof result>[]): InboundInspection =>
  ({
    inspectionRequestId: 501,
    inspectionRequestNo: 'TST-REQ-0501',
    inspectionTypeCode: 'IQC',
    targetTypeCode: 'INBOUND_LOT',
    targetId: 77,
    itemId: 31,
    targetQty: 2000,
    uomId: 1,
    statusCode: 'IN_PROGRESS',
    requestedAt: '2099-11-11T01:00:00Z',
    versionNo: 5,
    inboundLotId: 77,
    inboundLotNo: 'IL-20991111-0003',
    inboundLotVersionNo: 4,
    lotCount: 2,
    confirmedAt: null,
    overallJudgmentCode: null,
    previewJudgmentCode: 'REJECTED',
    lots: [lot(1), lot(2)],
    poAllocations: [],
    unallocatedQty: 0,
    results,
    nextResultSeqNo: results.length + 1,
  }) as unknown as InboundInspection;

const STUB = { accept: '자리 — 합격', reject: '자리 — 불합격', save: '자리 — 저장' };

/** 드로어 화면을 띄운다 — 자리표시 양식의 [저장]은 드로어 검사를 거쳐 보낼 값을 `saved` 에 남긴다. */
const mountDrawer = (data: InboundInspection) => {
  const saved: { matchedLotIds: number[]; reinspectionReasonCode: string | null }[] = [];
  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/quality/inspection-requests/501',
      respond: () => jsonResponse(data),
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/code-values',
      respond: () =>
        jsonResponse({
          items: [
            {
              codeValueId: 1,
              code: 'TST-REMEASURE',
              codeName: '합성 재측정',
              displayOrder: 1,
              isActive: true,
            },
            {
              codeValueId: 2,
              code: 'TST-OLD',
              codeName: '합성 안 쓰는 사유',
              displayOrder: 2,
              isActive: false,
            },
          ],
          page: { page: 1, size: 100, totalElements: 2, totalPages: 1 },
        }),
    },
  ]);

  renderWithProviders(
    <SessionProvider>
      <InboundDetail
        inspectionRequestId={501}
        itemParts={{ code: 'TST-ITEM', name: '합성 자재' }}
        planText="AQL 1.0"
        uomCode="EA"
        renderForm={({ drawer }) => (
          <div>
            {drawer.matchField}
            <button type="button" onClick={() => drawer.onJudgmentChange('ACCEPTED')}>
              {STUB.accept}
            </button>
            <button type="button" onClick={() => drawer.onJudgmentChange('REJECTED')}>
              {STUB.reject}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!drawer.validate()) return;
                saved.push({
                  matchedLotIds: drawer.matchedLotIds,
                  reinspectionReasonCode: drawer.reinspectionReasonCode,
                });
              }}
            >
              {STUB.save}
            </button>
          </div>
        )}
      />
    </SessionProvider>,
    {
      fetch,
      session: {
        userId: 8101,
        loginId: 'TST-LOGIN-01',
        userName: '합성 사용자',
        scopes: [{ businessUnitId: 8301 }],
        mustChangePassword: false,
        roles: [],
        permissions: ['W-01-01'],
      },
    },
  );

  return { saved };
};

const openAdd = async (seqNo: number) => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: messages.iqcInboundLot.results.add }));
  const drawer = await screen.findByRole('dialog', { name: t.addTitle(seqNo) });
  return { user, drawer };
};

describe('W-01-01 결과 드로어 — 판정 규칙 변경(2026-11-12)', () => {
  it('US3-4 자재 관리 LOT 를 하나도 고르지 않으면 저장할 수 없고 「자재 관리 LOT를 1개 이상 고르세요」', async () => {
    const { saved } = mountDrawer(inspection([]));
    const { user, drawer } = await openAdd(1);

    await user.click(within(drawer).getByRole('button', { name: STUB.accept }));
    await user.click(within(drawer).getByRole('button', { name: STUB.save }));

    expect(within(drawer).getByRole('alert')).toHaveTextContent(t.matchRequired);
    expect(saved).toEqual([]);

    await user.click(within(drawer).getByRole('checkbox', { name: lot(2).lotNo }));
    await user.click(within(drawer).getByRole('button', { name: STUB.save }));
    expect(saved).toEqual([{ matchedLotIds: [2], reinspectionReasonCode: null }]);
  });

  it('US3-4 [전부 선택]은 이 입하 LOT 의 자재 관리 LOT 마다 매칭으로 저장한다(「전체」 표시 없음)', async () => {
    const { saved } = mountDrawer(inspection([]));
    const { user, drawer } = await openAdd(1);

    await user.click(within(drawer).getByRole('button', { name: t.selectAll }));
    expect(within(drawer).getByRole('checkbox', { name: lot(1).lotNo })).toBeChecked();
    expect(within(drawer).getByRole('checkbox', { name: lot(2).lotNo })).toBeChecked();
    expect(within(drawer).getByRole('button', { name: t.selectAll })).toBeDisabled();

    await user.click(within(drawer).getByRole('button', { name: STUB.accept }));
    await user.click(within(drawer).getByRole('button', { name: STUB.save }));
    expect(saved).toEqual([{ matchedLotIds: [1, 2], reinspectionReasonCode: null }]);
  });

  it('US3-8 결과 1(불합격, LOT 1 · 2) 뒤 결과 2(합격, LOT 1) — 재검 사유 칸이 LOT 0001 의 대체를 보이고 사유와 함께 저장한다', async () => {
    const { saved } = mountDrawer(inspection([result(1, 'REJECTED', [1, 2])]));
    const { user, drawer } = await openAdd(2);

    await user.click(within(drawer).getByRole('checkbox', { name: lot(1).lotNo }));
    expect(within(drawer).queryByRole('combobox', { name: t.reasonHeading })).toBeNull();

    await user.click(within(drawer).getByRole('button', { name: STUB.accept }));
    expect(within(drawer).getByText(t.reasonLine('0001', 1, '불합격', '합격'))).toBeInTheDocument();
    expect(within(drawer).queryByText(t.reasonLine('0002', 1, '불합격', '합격'))).toBeNull();

    await user.click(within(drawer).getByRole('combobox', { name: t.reasonHeading }));
    expect(screen.queryByRole('option', { name: '합성 안 쓰는 사유' })).toBeNull();
    await user.click(await screen.findByRole('option', { name: '합성 재측정' }));
    await user.click(within(drawer).getByRole('button', { name: STUB.save }));

    expect(saved).toEqual([{ matchedLotIds: [1], reinspectionReasonCode: 'TST-REMEASURE' }]);
  });

  it('US3-9 결과 3(합격, [전부 선택])을 재검 사유 없이 저장하려 하면 막히고 사유를 고르라고 한다', async () => {
    const { saved } = mountDrawer(
      inspection([result(1, 'REJECTED', [1, 2]), result(2, 'ACCEPTED', [1], '합성 재측정')]),
    );
    const { user, drawer } = await openAdd(3);

    await user.click(within(drawer).getByRole('button', { name: t.selectAll }));
    await user.click(within(drawer).getByRole('button', { name: STUB.accept }));
    /* LOT 0001 은 결과 2(합격)를 덮으니 사유가 필요 없고, LOT 0002 만 결과 1 불합격을 덮는다. */
    expect(within(drawer).getByText(t.reasonLine('0002', 1, '불합격', '합격'))).toBeInTheDocument();
    expect(within(drawer).queryByText(t.reasonLine('0001', 2, '합격', '합격'))).toBeNull();

    await user.click(within(drawer).getByRole('button', { name: STUB.save }));
    expect(within(drawer).getByRole('alert')).toHaveTextContent(t.reasonRequired);
    expect(saved).toEqual([]);

    await user.click(within(drawer).getByRole('combobox', { name: t.reasonHeading }));
    await user.click(await screen.findByRole('option', { name: '합성 재측정' }));
    await user.click(within(drawer).getByRole('button', { name: STUB.save }));
    expect(saved).toEqual([{ matchedLotIds: [1, 2], reinspectionReasonCode: 'TST-REMEASURE' }]);
  });

  it('US3-9 불합격을 불합격으로, 합격을 불합격으로 바꾸는 결과는 재검 사유를 묻지 않는다', async () => {
    const { saved } = mountDrawer(
      inspection([result(1, 'REJECTED', [1]), result(2, 'ACCEPTED', [2], '합성 재측정')]),
    );
    const { user, drawer } = await openAdd(3);

    await user.click(within(drawer).getByRole('button', { name: t.selectAll }));
    await user.click(within(drawer).getByRole('button', { name: STUB.reject }));
    expect(within(drawer).queryByRole('combobox', { name: t.reasonHeading })).toBeNull();

    await user.click(within(drawer).getByRole('button', { name: STUB.save }));
    expect(saved).toEqual([{ matchedLotIds: [1, 2], reinspectionReasonCode: null }]);
  });

  it('US3-9 결과 수정도 같다 — 보류였던 앞 결과를 합격으로 덮게 고치면 사유를 묻고, 저장된 사유는 채워 둔다', async () => {
    const { saved } = mountDrawer(
      inspection([result(1, 'HELD', [1]), result(2, 'ACCEPTED', [1], '합성 재측정')]),
    );
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', {
        name: `${messages.iqcInboundLot.results.seq(2)} ${messages.iqcInboundLot.results.edit}`,
      }),
    );
    const drawer = await screen.findByRole('dialog', { name: t.editTitle(2) });
    await user.click(within(drawer).getByRole('button', { name: STUB.accept }));

    expect(within(drawer).getByText(t.reasonLine('0001', 1, '보류', '합격'))).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: STUB.save }));
    expect(saved).toEqual([{ matchedLotIds: [1], reinspectionReasonCode: 'TST-REMEASURE' }]);
  });
});
