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

/** 검사 기준 항목 하나(육안 · 글 입력) — 의뢰 기준 버전 3101 의 것. */
const appearanceSpec = {
  inspectionItemSpecId: 7902,
  inspectionPlanVersionId: 3101,
  sequenceNo: 10,
  inspectionItemCode: 'APPEAR',
  inspectionItemName: '외관',
  dataTypeCode: 'TEXT',
  measurementCount: 1,
  requiredFlag: true,
  automaticJudgment: false,
};
const iq = messages.partsIqcInspection;

/** 의뢰 기준 버전 3101 · 기준서 3001 — 결과 서랍 머리 줄(IQC 와 같은 요약)이 읽는다. */
const planVersion = {
  inspectionPlanVersionId: 3101,
  inspectionPlanId: 3001,
  planVersion: 2,
  acceptanceNumber: 0,
};
const inspectionPlan = {
  inspectionPlanId: 3001,
  inspectionPlanCode: 'IP-OQC-01',
  inspectionPlanName: '출하 기준A',
};

interface Options {
  request?: InspectionRequestResponse;
  /** 검사 기준 항목(외관)을 내린다(T052) — 없으면 항목이 비어 있다. */
  withItems?: boolean;
  /** 결과마다 저장된 측정치. */
  savedMeasurements?: Record<number, unknown[]>;
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
      /* 회차 목록 — 결과 요약을 회차 모양으로. */
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
    if (path === '/quality/inspection-plan-versions/3101/items') {
      const items = options.withItems === true ? [appearanceSpec] : [];
      return jsonResponse({ items, page: pageOf(items.length) });
    }
    if (path === '/quality/inspection-plan-versions/3101') {
      return jsonResponse({ inspectionPlanVersion: planVersion });
    }
    if (path === '/quality/inspection-plans/3001') {
      return jsonResponse({ inspectionPlan });
    }
    const measured = /^\/quality\/inspection-results\/(\d+)\/measurements$/u.exec(path);
    if (measured !== null) {
      const items = options.savedMeasurements?.[Number(measured[1])] ?? [];
      return jsonResponse({ items, page: pageOf(items.length) });
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
  const drawer = within(await screen.findByRole('dialog', { name: s.drawer.addTitle(3) }));
  /* 기준 · 항목을 읽은 뒤 양식이 선다. */
  await drawer.findByRole('button', { name: s.drawer.save });
  return drawer;
};

/** 종합 판정 고르기 — IQC 결과 서랍과 같은 펼침 선택칸(omf-all-around#356). */
const pickOverall = async (
  user: ReturnType<typeof userEvent.setup>,
  drawer: ReturnType<typeof within>,
  code: 'ACCEPTED' | 'REJECTED' | 'HELD',
) => {
  await user.click(drawer.getByRole('combobox', { name: iq.verdict.overall }));
  await user.click(await screen.findByRole('option', { name: iq.judgment[code] }));
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
    expect(
      row1.getByText(
        `${s.lots.portion('창고A', 'A-01-01', '30')} · ${s.lots.portion('창고A', 'K7QX-SYS-STAGING', '10')}`,
      ),
    ).toBeInTheDocument();
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
    /* 판정 규칙은 늘 펼쳐 두지 않고 「검사 결과」 제목 옆 ⓘ 로 둔다. */
    expect(screen.getByRole('button', { name: s.note })).toBeInTheDocument();
    expect(screen.queryByText(s.note)).toBeNull();
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

  it('교체된 LOT 의 부적합은 검사 상세와 따로 「부적합 처분」 상자로 선다(omf-all-around#354)', async () => {
    const lots = [
      shipmentLot(7001, 'P2611-0001', 40),
      shipmentLot(7003, 'P2611-0003', 30, 'REPLACED'),
    ];
    renderShipmentOqc({ request: shipmentOqcRequest({ lots }) });

    expect(
      await screen.findByRole('region', { name: messages.dispositionDecision.box.title }),
    ).toBeInTheDocument();
  });

  it('교체된 LOT 이 없으면 처분 상자를 두지 않는다', async () => {
    renderShipmentOqc();

    await lotsTable();
    expect(
      screen.queryByRole('region', { name: messages.dispositionDecision.box.title }),
    ).toBeNull();
  });

  it('US3-1 Q4 필수 칸(필수 항목 · 매칭 · 판정)이 비면 [저장]이 잠긴다(omf-all-around#356)', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc({ withItems: true });

    const drawer = await openAddDrawer(user);
    /* 필수 항목을 아직 안 재 자동 판정이 없다 — 종합 판정도 고를 수 없고 [저장]은 잠김(IQC 와 같다). */
    expect(drawer.getByRole('button', { name: s.drawer.save })).toBeDisabled();
    expect(drawer.getByRole('combobox', { name: iq.verdict.overall })).toBeDisabled();
    await user.type(
      await drawer.findByRole('textbox', { name: iq.visual.checkValueLabel('외관') }),
      '긁힘 없음',
    );
    await user.click(
      within(drawer.getByRole('group', { name: '외관' })).getByRole('button', { name: iq.ok }),
    );
    expect(drawer.getByRole('button', { name: s.drawer.save })).toBeEnabled();
    /* 매칭을 다 풀면 — 다시 잠김. */
    await user.click(drawer.getByRole('button', { name: s.drawer.selectNone }));
    expect(drawer.getByRole('button', { name: s.drawer.save })).toBeDisabled();
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    expect(writes).toHaveLength(0);
  });

  it('[되돌리기]는 LOT 매칭 바꿈부터 한 칸씩 되돌리고 적은 값은 남긴다 — [다시 실행]이 다시 건다(omf-all-around#356)', async () => {
    const user = userEvent.setup();
    renderShipmentOqc({ withItems: true });

    const drawer = await openAddDrawer(user);
    const text = await drawer.findByRole('textbox', { name: iq.visual.checkValueLabel('외관') });
    const lot = drawer.getByRole('checkbox', { name: 'P2611-0004' });
    const undo = drawer.getByRole('button', { name: iq.footer.undo });
    expect(lot).toBeChecked();

    await user.type(text, 'A');
    await user.click(drawer.getByRole('button', { name: s.drawer.selectNone }));
    expect(lot).not.toBeChecked();

    await user.click(undo);
    expect(lot).toBeChecked();
    expect(text).toHaveValue('A');
    await user.click(undo);
    expect(text).toHaveValue('');
    expect(lot).toBeChecked();

    await user.click(drawer.getByRole('button', { name: iq.footer.redo }));
    await user.click(drawer.getByRole('button', { name: iq.footer.redo }));
    expect(text).toHaveValue('A');
    expect(lot).not.toBeChecked();
  });

  it('US3-4 판정만 골라 제출하면 매칭 · 판정을 작성중으로 보낸다(수량은 서버가 채운다)', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc();

    const drawer = await openAddDrawer(user);
    await pickOverall(user, drawer, 'ACCEPTED');
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
    await pickOverall(user, drawer, 'ACCEPTED');
    expect(drawer.getByText(s.drawer.reasonHelp)).toBeInTheDocument();
    expect(
      drawer.getByText(s.drawer.reasonLine('P2611-0003', 2, '불합격', '합격')),
    ).toBeInTheDocument();

    /* 재검 사유를 고르기 전 — [저장]이 잠긴다(omf-all-around#356). */
    expect(drawer.getByRole('button', { name: s.drawer.save })).toBeDisabled();
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
    await pickOverall(user, drawer, 'HELD');
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    expect(
      await drawer.findByText(s.drawer.ruleErrors.REINSPECTION_REASON_REQUIRED),
    ).toBeInTheDocument();
  });

  it('FR-009·T052 검사 기준 항목이 있으면 결과 서랍에 측정 칸이 서고, 판정한 항목만 측정치로 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc({ withItems: true });

    const drawer = await openAddDrawer(user);
    await user.type(
      await drawer.findByRole('textbox', { name: iq.visual.checkValueLabel('외관') }),
      '긁힘 없음',
    );
    await user.click(
      within(drawer.getByRole('group', { name: '외관' })).getByRole('button', { name: iq.ok }),
    );
    /* 필수 항목을 다 판정하면 자동 판정이 종합 판정을 채운다(IQC 와 같다). */
    expect(drawer.getByRole('combobox', { name: iq.verdict.overall })).toHaveTextContent(
      iq.judgment.ACCEPTED as string,
    );
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = (await writes[0]?.json()) as { measurements?: Record<string, unknown>[] };
    expect(body.measurements).toEqual([
      expect.objectContaining({
        inspectionItemSpecId: 7902,
        sampleNo: 1,
        textValue: '긁힘 없음',
        judgmentCode: 'ACCEPTED',
      }),
    ]);
  });

  it('FR-009·T052 작성중 결과를 고치면 저장된 측정치가 칸에 되살아나고 PUT 에 그대로 실린다', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc({
      withItems: true,
      savedMeasurements: {
        9201: [
          {
            inspectionMeasurementId: 1,
            inspectionResultId: 9201,
            inspectionItemSpecId: 7902,
            sampleNo: 1,
            textValue: '찍힘',
            judgmentCode: 'REJECTED',
            measuredAt: '2026-11-18T03:00:00.000Z',
          },
        ],
      },
    });

    await user.click(
      await screen.findByRole('button', { name: `${s.results.seq(1)} ${s.results.edit}` }),
    );
    const drawer = within(await screen.findByRole('dialog', { name: s.drawer.editTitle(1) }));
    expect(await drawer.findByDisplayValue('찍힘')).toBeInTheDocument();
    await pickOverall(user, drawer, 'REJECTED');
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = (await writes[0]?.json()) as { measurements?: Record<string, unknown>[] };
    expect(body.measurements).toEqual([
      expect.objectContaining({
        inspectionItemSpecId: 7902,
        textValue: '찍힘',
        judgmentCode: 'REJECTED',
      }),
    ]);
  });

  it('#356 결과 서랍이 IQC 와 같은 짜임 — 검사일시 · 검사 수량(매칭 합) · 자동 판정 · 아래 줄 단추, 되돌리기 · 비우기 · 닫기 확인', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc({ withItems: true });

    const drawer = await openAddDrawer(user);
    /* 머리 줄 — 기준서 번호 · 이름(IQC 와 같은 요약). */
    expect(await drawer.findByText('IP-OQC-01')).toBeInTheDocument();
    expect(drawer.getByText('출하 기준A')).toBeInTheDocument();
    /* 검사 수량은 매칭한 피킹 LOT 수량의 합 — 읽기 전용. */
    const qty = drawer.getByRole('textbox', { name: iq.lot.inspectedQty });
    expect(qty).toHaveValue('30');
    expect(qty).toHaveAttribute('readonly');
    await user.click(drawer.getByRole('checkbox', { name: 'P2611-0001' }));
    expect(qty).toHaveValue('70');
    expect(drawer.getByText(iq.verdict.pending)).toBeInTheDocument();
    /* 판정 변경 사유 칸은 없다 — 이 흐름 서버가 받지 않는다. */
    expect(drawer.queryByLabelText(iq.verdict.reason)).toBeNull();

    /* 항목을 NG 로 — 자동 판정이 불합격, 되돌리면 다시 대기. */
    await user.click(
      within(drawer.getByRole('group', { name: '외관' })).getByRole('button', { name: iq.ng }),
    );
    expect(drawer.getByRole('combobox', { name: iq.verdict.overall })).toHaveTextContent(
      iq.judgment.REJECTED as string,
    );
    await user.click(drawer.getByRole('button', { name: iq.footer.undo }));
    expect(drawer.getByText(iq.verdict.pending)).toBeInTheDocument();
    await user.click(drawer.getByRole('button', { name: iq.footer.redo }));
    expect(drawer.getByRole('combobox', { name: iq.verdict.overall })).toHaveTextContent(
      iq.judgment.REJECTED as string,
    );
    /* 비우기 — 판정은 비고 매칭한 LOT 은 남는다. */
    await user.click(drawer.getByRole('button', { name: iq.footer.clear }));
    expect(drawer.getByText(iq.verdict.pending)).toBeInTheDocument();
    expect(drawer.getByRole('checkbox', { name: 'P2611-0001' })).toBeChecked();

    /* 입력 중 [취소] — 한 번 묻는다. */
    await user.click(drawer.getByRole('button', { name: s.drawer.cancel }));
    expect(await screen.findByText(s.drawer.discardBody)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: s.drawer.discardStay }));
    expect(screen.queryByText(s.drawer.discardBody)).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('작성중 결과를 고치면 PUT 으로 매칭 · 판정 · 검사일시만 보낸다', async () => {
    const user = userEvent.setup();
    const { writes } = renderShipmentOqc();

    await user.click(
      await screen.findByRole('button', { name: `${s.results.seq(1)} ${s.results.edit}` }),
    );
    const drawer = within(await screen.findByRole('dialog', { name: s.drawer.editTitle(1) }));
    expect(await drawer.findByRole('checkbox', { name: 'P2611-0001' })).toBeChecked();
    await user.click(drawer.getByRole('checkbox', { name: 'P2611-0002' }));
    await pickOverall(user, drawer, 'REJECTED');
    await user.click(drawer.getByRole('button', { name: s.drawer.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.method).toBe('PUT');
    expect(writes[0]?.headers.get('If-Match')).toBe('1');
    /* 검사일시는 저장된 값을 공장 시각으로 되살려 그대로 싣는다(01:12Z = 08:12 +07:00). */
    expect(await writes[0]?.json()).toEqual({
      overallJudgmentCode: 'REJECTED',
      matchedLotIds: [7001],
      inspectedAt: '2026-11-18T08:12:00+07:00',
    });
  });

  it('Q16 생략으로 닫힌 의뢰는 IQC 와 같은 요약만 — 피킹 LOT 표 · 결과 추가가 없다(#353)', async () => {
    renderShipmentOqc({
      request: shipmentOqcRequest({ statusCode: 'SKIPPED', results: [], lotJudgments: [] }),
    });

    expect(await screen.findByText(messages.partsIqcInspection.skipped.notice)).toBeInTheDocument();
    expect(screen.getByText(messages.partsIqcInspection.skipped.titleOqc)).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: messages.partsIqcInspection.lot.heading }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: s.results.add })).toBeNull();
    expect(screen.queryByRole('table', { name: s.lots.heading(4) })).toBeNull();
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
    /* 건별 생략 요청 칸은 없어졌다(omf-all-around#353). */
    expect(screen.queryByRole('columnheader', { name: '생략' })).toBeNull();
  });
});
