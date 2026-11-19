import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { codeValuesResponse, overallJudgmentCodeValues, pageOf } from './fixtures';
import { OqcInspectionScreen } from './screen';
import {
  partnerNames,
  shipmentLot,
  shipmentOqcRequest,
  shipmentRequestForOqc,
  shipmentResult,
} from './shipment-oqc-fixtures';
import type { InspectionRequestResponse } from './types';

/**
 * W-04-03 출하 OQC 새 흐름(피처 010 · 시안 W0403-After) — IQC 방식 결과 목록 · 피킹 LOT 매칭 · 판정만 · 확정 없음.
 */

const t = messages.oqcInspection;
const s = messages.oqcInspection.shipment;

const reasonValues = [
  {
    codeValueId: 9901,
    codeGroupId: 990,
    code: 'RECHECK',
    codeName: '재측정',
    displayOrder: 1,
    isActive: true,
  },
];

interface Options {
  request?: InspectionRequestResponse;
  /** 결과 저장 응답 — 기본 201. */
  save?: (request: Request) => Response | undefined;
}

const renderShipmentOqc = (options: Options = {}) => {
  const request = options.request ?? shipmentOqcRequest();
  const writes: Request[] = [];

  const stubFetch: StubFetch = async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith('/app/sessions/current')) return jsonResponse(SYNTHETIC_SESSION);
    if (path === '/quality/inspection-requests') {
      return jsonResponse({ items: [request], page: pageOf(1) });
    }
    if (path === `/quality/inspection-requests/${String(request.inspectionRequestId)}`) {
      return jsonResponse(request);
    }
    if (path === '/quality/inspection-results' && req.method === 'GET') {
      /* 회차 목록 — 결과 요약을 회차 모양으로(생략 칸이 «결과 0건»을 이것으로 본다). */
      const items = (request.results ?? []).map((result) => ({
        ...result,
        inspectionRequestId: request.inspectionRequestId,
        inspectionRound: result.seqNo,
        uomId: 10,
        overallJudgmentCode: result.overallJudgmentCode ?? '',
        inspectorId: 4001,
      }));
      return jsonResponse({ items, page: pageOf(items.length) });
    }
    if (path === '/quality/inspection-results' && req.method === 'POST') {
      writes.push(req.clone());
      return (
        options.save?.(req) ??
        jsonResponse(
          { ...shipmentResult(3, 'ACCEPTED', [7004]), inspectionRound: 3 },
          { status: 201 },
        )
      );
    }
    if (path.startsWith('/quality/inspection-results/') && req.method === 'PUT') {
      writes.push(req.clone());
      return jsonResponse({ ...shipmentResult(1, 'REJECTED', [7001]), inspectionRound: 1 });
    }
    if (path === '/logistics/shipment-requests/6201') return jsonResponse(shipmentRequestForOqc());
    if (path.startsWith('/mdm/partners/')) {
      const id = Number(path.split('/').at(-1));
      return jsonResponse({
        partnerId: id,
        partnerCode: `P${String(id)}`,
        partnerName: partnerNames[id],
      });
    }
    if (path === '/mdm/code-values') {
      return jsonResponse(
        codeValuesResponse(
          url.searchParams.get('codeGroupCode') === 'REINSPECTION_REASON'
            ? reasonValues
            : overallJudgmentCodeValues,
        ),
      );
    }
    if (path === '/app/approval-requests') return jsonResponse({ items: [], page: pageOf(0) });
    /* 참고 조회(품목 이름 · 기준 안내 · 이력 · 시리얼 등)는 이 시험의 관심이 아니다 — 비어 있다. */
    if (req.method === 'GET') return jsonResponse({ message: '없음' }, { status: 404 });

    throw new Error(`스텁에 없는 요청입니다: ${req.method} ${req.url}`);
  };

  renderWithProviders(
    <SessionProvider>
      <OqcInspectionScreen />
    </SessionProvider>,
    { route: `/?ir=${String(request.inspectionRequestId)}`, fetch: stubFetch },
  );

  return { writes };
};

const lotsTable = async (count = 4) =>
  within(await screen.findByRole('table', { name: s.lots.heading(count) }));

const openAddDrawer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: s.results.add }));
  return within(await screen.findByRole('dialog', { name: s.drawer.addTitle(3) }));
};

describe('W-04-03 출하 OQC 새 흐름 — 상세', () => {
  it('US3-2 Q4 피킹 LOT 마다 판정 · 적용 회차가 보이고 미검사가 남는다', async () => {
    renderShipmentOqc();
    const lots = await lotsTable();

    const row4 = within(lots.getByText('P2611-0004').closest('tr') as HTMLElement);
    expect(row4.getByText(s.judgments.NOT_INSPECTED)).toBeInTheDocument();
    const row3 = within(lots.getByText('P2611-0003').closest('tr') as HTMLElement);
    expect(row3.getByText(s.judgments.REJECTED)).toBeInTheDocument();
    expect(row3.getByText(s.lots.applied(2))).toBeInTheDocument();
    expect(row3.getByText(s.lots.replaceHint)).toBeInTheDocument();
    /* 지시서에서 읽은 창고 · 위치 몫. */
    const row1 = within(lots.getByText('P2611-0001').closest('tr') as HTMLElement);
    expect(row1.getByText(s.lots.portion('창고A', 'A-01-01', '40'))).toBeInTheDocument();
    /* 고객 · 지시서 번호. */
    expect(await screen.findByText(partnerNames[501] as string)).toBeInTheDocument();
    expect(screen.getAllByText('SR-261118-001').length).toBeGreaterThan(0);
  });

  it('US3-4 결과 표에 검사 수량 · 불량 칸이 없고 확정 · 임시 저장 단추가 없다', async () => {
    renderShipmentOqc();
    const results = within(await screen.findByRole('table', { name: s.results.heading(2) }));

    expect(
      results.queryByRole('columnheader', {
        name: messages.iqcInboundLot.results.columns.inspectedQty,
      }),
    ).toBeNull();
    expect(
      results.getByRole('columnheader', { name: s.results.columns.inspectedAt }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.result.save })).toBeNull();
    expect(screen.queryByLabelText(t.result.fields.accepted)).toBeNull();
    /* 출하 OQC 결과는 서버가 지우지 않는다 — [삭제] 없음. */
    expect(
      results.queryByRole('button', { name: `${s.results.seq(1)} ${s.results.remove}` }),
    ).toBeNull();
    expect(
      results.getByRole('button', { name: `${s.results.seq(1)} ${s.results.edit}` }),
    ).toBeInTheDocument();
    expect(screen.getByText(s.note)).toBeInTheDocument();
  });

  it('US3-5 교체된 LOT 은 회색 이력 줄(교체됨 · 부적합 번호)로만 남고 매칭 후보에서 빠진다', async () => {
    const user = userEvent.setup();
    const lots = [
      shipmentLot(7001, 'P2611-0001', 40),
      shipmentLot(7002, 'P2611-0002', 40),
      shipmentLot(7003, 'P2611-0003', 30, 'REPLACED'),
      shipmentLot(7004, 'P2611-0004', 30),
    ];
    renderShipmentOqc({ request: shipmentOqcRequest({ lots }) });

    const table = await lotsTable(3);
    const replacedRow = within(table.getByText('P2611-0003').closest('tr') as HTMLElement);
    expect(replacedRow.getByText(s.lots.replaced)).toBeInTheDocument();
    expect(replacedRow.getByText(/NC-261118-0003/)).toBeInTheDocument();

    const drawer = await openAddDrawer(user);
    expect(drawer.queryByRole('checkbox', { name: 'P2611-0003' })).toBeNull();
    expect(drawer.getByRole('checkbox', { name: 'P2611-0004' })).toBeChecked();
    expect(drawer.getByRole('checkbox', { name: 'P2611-0001' })).not.toBeChecked();
  });

  it('US3-1 Q4 매칭 없이 제출하면 「피킹 LOT 을 1개 이상 고르세요」로 막고 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc();

    const drawer = await openAddDrawer(user);
    await user.click(drawer.getByRole('button', { name: s.drawer.selectNone }));
    await user.click(drawer.getByRole('button', { name: s.judgments.ACCEPTED }));
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    expect(drawer.getAllByText(s.drawer.matchRequired).length).toBeGreaterThan(0);
    expect(writes).toHaveLength(0);
  });

  it('US3-4 판정만 골라 제출하면 매칭 · 판정을 작성중으로 보낸다(수량은 서버가 채운다)', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc();

    const drawer = await openAddDrawer(user);
    await user.click(drawer.getByRole('button', { name: s.judgments.ACCEPTED }));
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = (await writes[0]?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      inspectionRequestId: 4201,
      overallJudgmentCode: 'ACCEPTED',
      matchedLotIds: [7004],
      statusCode: 'DRAFT',
    });
    expect(body).not.toHaveProperty('reinspectionReasonCode');
  });

  it('US3-3 Q5 불합격 LOT 을 합격으로 덮으면 재검 사유가 필수다', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc();

    const drawer = await openAddDrawer(user);
    await user.click(drawer.getByRole('checkbox', { name: 'P2611-0004' }));
    await user.click(drawer.getByRole('checkbox', { name: 'P2611-0003' }));
    await user.click(drawer.getByRole('button', { name: s.judgments.ACCEPTED }));
    expect(drawer.getByText(s.drawer.reasonHelp)).toBeInTheDocument();
    expect(
      drawer.getByText(s.drawer.reasonLine('P2611-0003', 2, '불합격', '합격')),
    ).toBeInTheDocument();

    await user.click(drawer.getByRole('button', { name: s.drawer.save }));
    expect(drawer.getAllByText(s.drawer.reasonRequired).length).toBeGreaterThan(0);
    expect(writes).toHaveLength(0);

    await user.click(drawer.getByRole('combobox', { name: s.drawer.reasonHeading }));
    await user.click(await screen.findByRole('option', { name: '재측정' }));
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(await writes[0]?.json()).toMatchObject({
      matchedLotIds: [7003],
      reinspectionReasonCode: 'RECHECK',
    });
  });

  it('US3-3 서버가 재검 사유를 요구하면(400) 드로어에 문구가 선다', async () => {
    const user = userEvent.setup();
    renderShipmentOqc({
      save: () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'reinspectionReasonCode',
                code: 'REINSPECTION_REASON_REQUIRED',
                message: 'server',
              },
            ],
          },
          { status: 400 },
        ),
    });

    const drawer = await openAddDrawer(user);
    await user.click(drawer.getByRole('button', { name: s.judgments.HELD }));
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    expect(
      await drawer.findByText(s.drawer.ruleErrors.REINSPECTION_REASON_REQUIRED),
    ).toBeInTheDocument();
  });

  it('작성중 결과를 고치면 PUT 으로 매칭 · 판정만 보낸다', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc();

    await user.click(
      await screen.findByRole('button', { name: `${s.results.seq(1)} ${s.results.edit}` }),
    );
    const drawer = within(await screen.findByRole('dialog', { name: s.drawer.editTitle(1) }));
    expect(drawer.getByRole('checkbox', { name: 'P2611-0001' })).toBeChecked();
    await user.click(drawer.getByRole('checkbox', { name: 'P2611-0002' }));
    await user.click(drawer.getByRole('button', { name: s.judgments.REJECTED }));
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.method).toBe('PUT');
    expect(writes[0]?.headers.get('If-Match')).toBe('1');
    expect(await writes[0]?.json()).toEqual({
      overallJudgmentCode: 'REJECTED',
      matchedLotIds: [7001],
    });
  });

  it('Q16 생략으로 닫힌 의뢰는 안내만 서고 결과를 더할 수 없다', async () => {
    renderShipmentOqc({
      request: shipmentOqcRequest({ statusCode: 'SKIPPED', results: [], lotJudgments: [] }),
    });

    expect(await screen.findByText(s.skipped, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: s.results.add })).toBeNull();
    const lots = await lotsTable();
    expect(lots.getAllByText(s.judgments.SKIPPED).length).toBeGreaterThan(0);
  });

  it('US3-6 피킹 LOT 이 없으면 빈 상태와 「결과를 추가할 수 없습니다」', async () => {
    renderShipmentOqc({
      request: shipmentOqcRequest({
        statusCode: 'REQUESTED',
        lots: [],
        results: [],
        lotJudgments: [],
        pickedLotCount: 0,
      }),
    });

    expect(await screen.findByText(s.lots.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(s.results.addBlocked)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: s.results.add })).toBeDisabled();
  });
});

describe('W-04-03 출하 OQC 새 흐름 — 목록', () => {
  it('Q4 의뢰번호 아래 지시서 번호, 피킹 LOT 수, LOT 판정 요약 칩이 보인다', async () => {
    renderShipmentOqc();

    const open = await screen.findByRole('button', { name: t.queue.openRow('IR-OQC-0201') });
    const row = within(open.closest('tr') as HTMLElement);
    expect(row.getByText('SR-261118-001')).toBeInTheDocument();
    expect(row.getByText(s.queue.pickedLots(4))).toBeInTheDocument();
    expect(row.getByText(s.overview.rejected(1))).toBeInTheDocument();
  });

  it('FR-012 결과가 있는 의뢰에는 [생략 요청]이 없다', async () => {
    renderShipmentOqc();

    const open = await screen.findByRole('button', { name: t.queue.openRow('IR-OQC-0201') });
    const row = within(open.closest('tr') as HTMLElement);
    await waitFor(() =>
      expect(
        row.queryByRole('button', { name: messages.iqcInspection.queue.skipRequest }),
      ).toBeNull(),
    );
  });
});
