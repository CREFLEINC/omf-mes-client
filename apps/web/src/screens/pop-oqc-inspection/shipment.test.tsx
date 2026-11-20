import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { codeValuesResponse, overallJudgmentCodeValues, pageOf } from '../oqc-inspection/fixtures';
import {
  partnerNames,
  shipmentLot,
  shipmentOqcRequest,
  shipmentRequestForOqc,
  shipmentResult,
} from '../oqc-inspection/shipment-oqc-fixtures';
import type { InspectionRequestResponse } from '../oqc-inspection/types';
import { PopOqcInspectionScreen } from './screen';

/**
 * P-04-06 출하 OQC 새 흐름(피처 010 · 시안 P0406-After) — 결과 추가만 · 확인 창 없음 · 미검사 LOT 미리 체크.
 */

const pop = messages.popOqcInspection;
const ps = messages.popOqcInspection.shipment;
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

/** 피킹 LOT 이 모두 판정을 가진 열린 의뢰 — 「판정 완료」 탭에 선다. */
const judgedRequest = shipmentOqcRequest({
  inspectionRequestId: 4202,
  inspectionRequestNo: 'IR-OQC-0202',
  shipmentRequestNo: 'SR-261118-002',
  lots: [shipmentLot(7101, 'P2611-0101', 40)],
  results: [shipmentResult(1, 'ACCEPTED', [7101])],
  lotJudgmentSummary: { notInspected: 0, accepted: 1, rejected: 0, held: 0 },
});

/** 의뢰 기준 버전 3101 의 검사 항목 — 수치(길이 9.9~10.1) 하나(T052). */
const lengthSpec = {
  inspectionItemSpecId: 7911,
  inspectionPlanVersionId: 3101,
  sequenceNo: 10,
  inspectionItemCode: 'LEN',
  inspectionItemName: '길이',
  dataTypeCode: 'NUMERIC',
  targetValue: 10,
  lowerLimit: 9.9,
  upperLimit: 10.1,
  measurementCount: 1,
  requiredFlag: true,
  automaticJudgment: true,
};
const pr = messages.pqcInspectionRegister.web.items;

const renderPop = (
  workerNo: string | null = '900028',
  request = shipmentOqcRequest(),
  options: {
    withItems?: boolean;
    /** 기준에 항목이 0개(읽기는 성공). */
    noItems?: boolean;
    before?: InspectionRequestResponse[];
    /** `GET …/oqc-serials` — 의뢰의 저장된 시리얼 기록. */
    serials?: unknown[];
  } = {},
) => {
  const saves: Request[] = [];
  const all: InspectionRequestResponse[] = [...(options.before ?? []), request, judgedRequest];

  const stubFetch: StubFetch = async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/quality/inspection-requests') {
      return url.searchParams.get('pendingOnly') === 'true'
        ? jsonResponse({ items: all, page: pageOf(all.length) })
        : jsonResponse({ items: [], page: pageOf(0) });
    }
    const found = all.find(
      (each) => path === `/quality/inspection-requests/${String(each.inspectionRequestId)}`,
    );
    if (found !== undefined) return jsonResponse(found);
    if (path === '/quality/inspection-results' && req.method === 'GET') {
      return jsonResponse({ items: [], page: pageOf(0) });
    }
    if (path === '/quality/inspection-results' && req.method === 'POST') {
      saves.push(req.clone());
      return jsonResponse(
        { ...shipmentResult(3, 'ACCEPTED', [7004]), inspectionRound: 3 },
        {
          status: 201,
        },
      );
    }
    if (options.withItems === true && path === '/quality/inspection-plan-versions/3101/items') {
      return jsonResponse({ items: [lengthSpec], page: pageOf(1) });
    }
    if (options.noItems === true && path === '/quality/inspection-plan-versions/3101/items') {
      return jsonResponse({ items: [], page: pageOf(0) });
    }
    if (path === '/quality/inspection-requests/4201/oqc-serials') {
      return jsonResponse({ items: options.serials ?? [] });
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
    if (req.method === 'GET') return jsonResponse({ message: '없음' }, { status: 404 });
    throw new Error(`스텁에 없는 요청입니다: ${req.method} ${req.url}`);
  };

  renderWithProviders(
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, workerNo }}>
      <PopOqcInspectionScreen />
    </PopIdentityProvider>,
    { route: '/pop/oqc-inspection', fetch: stubFetch },
  );

  return { saves };
};

const openRequest = async (user: ReturnType<typeof userEvent.setup>, no = 'IR-OQC-0201') => {
  await user.click(await screen.findByRole('button', { name: pop.queue.selectRow(no) }));
  return within(await screen.findByRole('region', { name: /회차 검사 결과 등록/u }));
};

describe('P-04-06 출하 OQC 새 흐름', () => {
  it('Q4 목록 카드에 지시서 번호와 LOT 판정 요약이 보이고, 판정을 마친 열린 의뢰는 「판정 완료」 탭에 선다', async () => {
    const user = userEvent.setup();
    renderPop();

    const card = await screen.findByRole('button', { name: pop.queue.selectRow('IR-OQC-0201') });
    expect(within(card).getByText('SR-261118-001')).toBeInTheDocument();
    expect(within(card).getByText(s.overview.rejected(1))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: pop.queue.selectRow('IR-OQC-0202') })).toBeNull();

    await user.click(screen.getByRole('tab', { name: new RegExp(pop.queue.doneHeading, 'u') }));
    expect(
      await screen.findByRole('button', { name: pop.queue.selectRow('IR-OQC-0202') }),
    ).toBeInTheDocument();
  });

  it('#334 판정 불가(피킹 LOT 없음) 의뢰는 판정 대기 목록 맨 아래로, 고른 의뢰는 그대로', async () => {
    const user = userEvent.setup();
    /* 서버 순서: 판정 불가 → 판정 가능(IR-OQC-0201). 화면은 판정 가능을 먼저 보인다. */
    const noLot = shipmentOqcRequest({
      inspectionRequestId: 4209,
      inspectionRequestNo: 'IR-OQC-0209',
      shipmentRequestNo: 'SR-261118-009',
      statusCode: 'REQUESTED',
      lots: [],
      results: [],
      pickedLotCount: 0,
      lotJudgmentSummary: { notInspected: 0, accepted: 0, rejected: 0, held: 0 },
    });
    renderPop('900028', shipmentOqcRequest(), { before: [noLot] });

    const judgeable = await screen.findByRole('button', {
      name: pop.queue.selectRow('IR-OQC-0201'),
    });
    const blocked = screen.getByRole('button', { name: pop.queue.selectRow('IR-OQC-0209') });
    expect(within(blocked).getByText(ps.cannotJudge)).toBeInTheDocument();
    /* 판정 가능 카드가 판정 불가 카드보다 앞에 선다. */
    expect(
      judgeable.compareDocumentPosition(blocked) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(blocked);
    expect(blocked).toHaveAttribute('aria-pressed', 'true');
    expect((await screen.findAllByText(ps.form.noLots)).length).toBeGreaterThan(0);
  });

  it('US3-1·Q4 목록 카드는 품목 코드와 「피킹 LOT n개 · 합 단위」를 보인다(품목 번호 #id 가 아니다)', async () => {
    renderPop(
      '900028',
      shipmentOqcRequest({
        itemCode: 'FG-A100',
        itemName: '센서 모듈 A',
        uomCode: 'EA',
        pickedQty: 110,
      }),
    );

    const card = await screen.findByRole('button', { name: pop.queue.selectRow('IR-OQC-0201') });
    expect(within(card).getByText('FG-A100')).toBeInTheDocument();
    expect(within(card).getByText(ps.cardLots(4, '110 EA'))).toBeInTheDocument();
    expect(within(card).queryByText(/#2101/u)).toBeNull();
  });

  it('US3-1·Q4 머리에 품목 코드·이름, 목표·피킹·초과, 고객·납품처가 서고 피킹 LOT 줄에 창고·위치 몫(적치 대기)이 보인다', async () => {
    const user = userEvent.setup();
    renderPop(
      '900028',
      shipmentOqcRequest({ itemCode: 'FG-A100', itemName: '센서 모듈 A', uomCode: 'EA' }),
    );

    await openRequest(user);

    expect(await screen.findByText(partnerNames[501] as string)).toBeInTheDocument();
    expect(screen.getByText(partnerNames[502] as string)).toBeInTheDocument();
    expect(screen.getByText(ps.itemValue('FG-A100', '센서 모듈 A'))).toBeInTheDocument();
    expect(screen.getByText('100 EA')).toBeInTheDocument();
    expect(screen.getByText('140 EA')).toBeInTheDocument();
    /* 정보 띠 — 지시량 · 피킹량 · 초과량(단위 포함, 출하 완료와 같은 말). */
    const band = screen.getByRole('group', { name: ps.bandLabel });
    expect(within(band).getByText(ps.target)).toBeInTheDocument();
    expect(within(band).getByText(ps.picked)).toBeInTheDocument();
    expect(within(band).getByText(ps.over)).toBeInTheDocument();
    expect(within(band).getByText('40 EA')).toBeInTheDocument();
    expect(
      screen.getByText(
        `${s.lots.portion('창고A', 'A-01-01', '30 EA')} · ${s.lots.portion('창고A', ps.staging, '10 EA')}`,
      ),
    ).toBeInTheDocument();
  });

  it('US3-4 수량 칸이 없고, 새 결과는 미검사 LOT 만 미리 체크한다', async () => {
    const user = userEvent.setup();
    renderPop();

    const match = await openRequest(user);
    expect(match.getByRole('checkbox', { name: 'P2611-0004' })).toBeChecked();
    expect(match.getByRole('checkbox', { name: 'P2611-0001' })).not.toBeChecked();
    expect(screen.queryByLabelText(pop.result.fields.accepted)).toBeNull();
    /* 긴 안내 문단은 없다(POP 통일 · 2026-11-20). */
    expect(screen.queryByText(s.note)).toBeNull();
    expect(screen.getByText(ps.bar.blocked.judgment)).toBeInTheDocument();
  });

  it('US3-4 판정을 고르고 [결과 저장]을 누르면 확인 창 없이 작성중으로 사번 헤더와 함께 보낸다', async () => {
    const user = userEvent.setup();
    const { saves } = renderPop();

    await openRequest(user);
    await user.click(screen.getByRole('radio', { name: s.judgments.ACCEPTED }));
    expect(screen.getByText(ps.bar.ready)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: ps.bar.save }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(saves[0]?.headers.get('X-Worker-No')).toBe('900028');
    expect(await saves[0]?.json()).toMatchObject({
      matchedLotIds: [7004],
      overallJudgmentCode: 'ACCEPTED',
      statusCode: 'DRAFT',
    });
    expect(await screen.findByText(ps.bar.saved(3))).toBeInTheDocument();
  });

  it('FR-009·T052 검사 기준 항목이 있으면 측정 칸이 서고, 잰 값(자동 판정)을 측정치로 함께 보낸다', async () => {
    const user = userEvent.setup();
    const { saves } = renderPop('900028', shipmentOqcRequest(), { withItems: true });

    await openRequest(user);
    /* ① 검사 대상 LOT · 판정에서 판정, ② 검사 항목에서 값 — 구획을 바꿔도 넣은 것은 남는다. */
    await user.click(screen.getByRole('radio', { name: s.judgments.ACCEPTED }));
    await user.click(await screen.findByRole('tab', { name: new RegExp(pr.heading, 'u') }));
    await user.type(
      await screen.findByRole('textbox', { name: pr.valueLabel('길이', 1) }),
      '10.02',
    );
    await user.click(screen.getByRole('button', { name: ps.bar.save }));

    await waitFor(() => expect(saves).toHaveLength(1));
    const body = (await saves[0]?.json()) as { measurements?: Record<string, unknown>[] };
    expect(body.measurements).toEqual([
      expect.objectContaining({
        inspectionItemSpecId: 7911,
        sampleNo: 1,
        numericValue: 10.02,
        judgmentCode: 'ACCEPTED',
      }),
    ]);
  });

  it('FR-009·T052 수치 항목에 숫자가 아닌 값을 넣으면 저장이 잠기고 바닥 띠가 이유를 말한다', async () => {
    const user = userEvent.setup();
    renderPop('900028', shipmentOqcRequest(), { withItems: true });

    await openRequest(user);
    await user.click(screen.getByRole('radio', { name: s.judgments.ACCEPTED }));
    await user.click(await screen.findByRole('tab', { name: new RegExp(pr.heading, 'u') }));
    await user.type(await screen.findByRole('textbox', { name: pr.valueLabel('길이', 1) }), 'abc');

    expect(screen.getByText(ps.bar.blocked.measurement)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ps.bar.save })).toBeDisabled();
  });

  it('US3-1 매칭을 모두 풀면 저장이 잠기고 바닥 띠가 이유를 말한다', async () => {
    const user = userEvent.setup();
    renderPop();

    const match = await openRequest(user);
    await user.click(match.getByRole('checkbox', { name: 'P2611-0004' }));
    await user.click(screen.getByRole('radio', { name: s.judgments.ACCEPTED }));

    expect(screen.getByText(ps.bar.blocked.match)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ps.bar.save })).toBeDisabled();
  });

  it('US3-3 Q5 불합격 LOT 을 합격으로 덮으면 재검 사유를 받아야 저장된다', async () => {
    const user = userEvent.setup();
    const { saves } = renderPop();

    const match = await openRequest(user);
    await user.click(match.getByRole('checkbox', { name: 'P2611-0004' }));
    await user.click(match.getByRole('checkbox', { name: 'P2611-0003' }));
    await user.click(screen.getByRole('radio', { name: s.judgments.ACCEPTED }));

    expect(screen.getByText(ps.bar.blocked.reason)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ps.bar.save })).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: s.drawer.reasonHeading }));
    await user.click(await screen.findByRole('option', { name: '재측정' }));
    await user.click(screen.getByRole('button', { name: ps.bar.save }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(await saves[0]?.json()).toMatchObject({
      matchedLotIds: [7003],
      reinspectionReasonCode: 'RECHECK',
    });
  });

  it('US3-5 교체된 LOT 은 「교체로 빠진 LOT」 아래로 가고 매칭 후보에서 빠진다', async () => {
    const user = userEvent.setup();
    renderPop(
      '900028',
      shipmentOqcRequest({
        lots: [
          shipmentLot(7001, 'P2611-0001', 40),
          shipmentLot(7002, 'P2611-0002', 40),
          shipmentLot(7003, 'P2611-0003', 30, 'REPLACED'),
          shipmentLot(7004, 'P2611-0004', 30),
        ],
      }),
    );

    const match = await openRequest(user);
    expect(match.queryByRole('checkbox', { name: 'P2611-0003' })).toBeNull();
    expect(screen.getByText(ps.lotsReplacedHeading)).toBeInTheDocument();
    expect(await screen.findByText(/NC-261118-0003/)).toBeInTheDocument();
    /* US3-5 시안 — 「2회차 불합격 · PDA 교체 시각 작업자 · 부적합 NC-…」. */
    expect(
      screen.getByText(/^2회차 불합격 · PDA 교체 .* 작업자A · 부적합 NC-261118-0003$/u),
    ).toBeInTheDocument();
  });

  it('사번이 없으면 저장이 잠긴다', async () => {
    const user = userEvent.setup();
    const { saves } = renderPop(null);

    await openRequest(user);
    await user.click(screen.getByRole('radio', { name: s.judgments.ACCEPTED }));

    expect(screen.getByRole('button', { name: ps.bar.save })).toBeDisabled();
    expect(screen.getByText(pop.bar.blocked.worker)).toBeInTheDocument();
    expect(saves).toHaveLength(0);
  });

  it('#334 검사 항목이 0개면 결과 등록에 「검사 항목」 칸째 없다(제목 · 안내 없음)', async () => {
    const user = userEvent.setup();
    renderPop('900028', shipmentOqcRequest(), { noItems: true });

    const region = await openRequest(user);
    expect(region.getByText(ps.form.match.matchHeading)).toBeInTheDocument();
    await waitFor(() => {
      expect(region.queryByText(pr.heading)).toBeNull();
    });
    expect(region.queryByText(messages.pqcInspection.measurements.noItems)).toBeNull();
  });

  it('#334 [시리얼 검사 기록]은 바닥 띠 [결과 저장] 왼쪽에 서고 창을 연다', async () => {
    const user = userEvent.setup();
    renderPop();

    const region = await openRequest(user);
    expect(region.queryByRole('button', { name: pop.serial.open })).toBeNull();
    const serialButton = screen.getByRole('button', { name: pop.serial.open });
    const saveButton = screen.getByRole('button', { name: ps.bar.save });
    expect(
      serialButton.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.click(serialButton);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('#334 검사 결과 탭은 회차마다 저장된 시리얼(번호 · OK/NG)을 보인다', async () => {
    const user = userEvent.setup();
    renderPop('900028', shipmentOqcRequest(), {
      serials: [
        {
          serialNumberId: 1,
          serialNo: 'SN-RESULT-1',
          lotId: 7001,
          lotNo: 'P2611-0001',
          firstJudgmentCode: 'NG',
          finalJudgmentCode: 'NG',
          inspectedAt: '2026-11-18T01:00:00Z',
          inspectionResultId: 9201,
          inspectionRound: 1,
        },
      ],
    });

    await openRequest(user);
    await user.click(screen.getByRole('tab', { name: new RegExp(s.results.title, 'u') }));
    const serials = await screen.findByLabelText(ps.results.serials(1));
    expect(within(serials).getByText('SN-RESULT-1')).toBeInTheDocument();
    expect(within(serials).getByText(messages.oqcInspection.serials.ng)).toBeInTheDocument();
  });

  /* 사용자 지시 2026-11-20 — 판정을 마친 열린 의뢰는 결과 등록을 닫아 두고 [재검사]로 연다. */
  it('#334 판정 완료 의뢰는 결과 등록 없이 [재검사]만 서고, 누르면 재검사 회차로 열리고 [취소]로 닫힌다', async () => {
    const user = userEvent.setup();
    const { saves } = renderPop();

    await user.click(
      await screen.findByRole('tab', { name: new RegExp(pop.queue.doneHeading, 'u') }),
    );
    await user.click(
      await screen.findByRole('button', { name: pop.queue.selectRow('IR-OQC-0202') }),
    );
    const reinspect = await screen.findByRole('button', { name: ps.bar.reinspect });
    expect(screen.queryByRole('region', { name: /회차 (재)?검사 결과 등록/u })).toBeNull();
    expect(screen.queryByRole('button', { name: ps.bar.save })).toBeNull();
    expect(screen.queryByRole('button', { name: pop.serial.open })).toBeNull();

    await user.click(reinspect);
    expect(
      await screen.findByRole('region', { name: ps.form.reinspectHeading(2) }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ps.bar.save })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pop.serial.open })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    expect(screen.queryByRole('region', { name: ps.form.reinspectHeading(2) })).toBeNull();
    expect(screen.getByRole('button', { name: ps.bar.reinspect })).toBeInTheDocument();
    expect(saves).toHaveLength(0);
  });

  it('#334 판정 대기 의뢰는 [재검사] 없이 결과 등록이 바로 선다', async () => {
    const user = userEvent.setup();
    renderPop();

    await openRequest(user);
    expect(screen.getByRole('region', { name: ps.form.heading(3) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ps.bar.reinspect })).toBeNull();
    expect(screen.queryByRole('button', { name: messages.common.cancel })).toBeNull();
  });
});
