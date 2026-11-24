import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { dispositionStub, lotFixture, requestsSent, saveAndConfirm } from './fixtures';
import { DispositionDecisionScreen } from './screen';

/* 005 T077 — W-03-10 입하 LOT 단위 처분(US4-4 · R14a-1 · FR-031 · FR-038). 값은 전부 지어낸 합성값이다. */

const t = messages.dispositionDecision;
const TODAY = new Date(2026, 10, 11);
const KST = 540;

type User = ReturnType<typeof userEvent.setup>;

const result = (seqNo: number, overallJudgmentCode: string, defectSummary: string | null) => ({
  inspectionResultId: 600 + seqNo,
  seqNo,
  overallJudgmentCode,
  defectSummary,
});

/** 입하 LOT 하나에 자재 관리 LOT 셋 — 결과 2(불합격)는 셋째 LOT 에만 매칭됐다. */
const INBOUND_LOTS = [
  lotFixture({
    nonconformanceLotId: 9101,
    lotId: 8101,
    lotNo: 'SAMPLE-ML|0001',
    affectedQty: 1000,
    matchedResults: [result(1, 'ACCEPTED', null)],
  }),
  lotFixture({
    nonconformanceLotId: 9102,
    lotId: 8102,
    lotNo: 'SAMPLE-ML|0002',
    affectedQty: 1000,
    matchedResults: [result(1, 'ACCEPTED', null)],
  }),
  lotFixture({
    nonconformanceLotId: 9103,
    lotId: 8103,
    lotNo: 'SAMPLE-ML|0003',
    affectedQty: 1000,
    matchedResults: [result(2, 'REJECTED', '합성 외관 결함')],
  }),
];

const INBOUND_NONCONFORMANCE = {
  inspectionRequestId: 701,
  inspectionRequestNo: 'SAMPLE-IR-0701',
  inboundLotId: 501,
  inboundLotNo: 'SAMPLE-IL-0501',
  supplierName: '합성 공급사',
  unmatchedResults: [result(3, 'ACCEPTED', null)],
};

const renderScreen = (options: Parameters<typeof dispositionStub>[0] = {}): { user: User } => {
  renderWithProviders(
    <SessionProvider>
      <DispositionDecisionScreen today={TODAY} offsetMinutes={KST} />
    </SessionProvider>,
    {
      session: SYNTHETIC_SESSION,
      fetch: dispositionStub(options),
      route: '/quality/dispositions?nonconformanceId=41',
    },
  );
  return { user: userEvent.setup() };
};

const renderInbound = (options: Parameters<typeof dispositionStub>[0] = {}) =>
  renderScreen({
    lots: INBOUND_LOTS,
    nonconformance: INBOUND_NONCONFORMANCE,
    concessions: [],
    ...options,
  });

const posted = (path: string): Request | undefined =>
  requestsSent().find(
    (request) => request.method === 'POST' && new URL(request.url).pathname === path,
  );

describe('W-03-10 입하 LOT 단위 처분', () => {
  it('US4-4 상세에 입하 LOT 번호 · 자재 관리 LOT 목록 · IQC 결과 매칭(참고)을 보인다', async () => {
    renderInbound();

    expect(await screen.findByText('SAMPLE-ML|0003')).toBeInTheDocument();
    expect(screen.getAllByText('SAMPLE-IL-0501').length).toBeGreaterThan(0);
    expect(screen.getByText('SAMPLE-IR-0701')).toBeInTheDocument();
    const lots = screen.getByRole('region', { name: t.panes.lots });
    /* 처분 단위 상시 안내는 두지 않는다(#275) — 유형을 고르면 「자재 관리 LOT n개 …」로 알린다. */
    expect(within(lots).queryByText(/처분 결과는/)).toBeNull();
    expect(
      within(lots).getByText(t.inboundLot.resultChip(2, '불합격', '합성 외관 결함')),
    ).toBeInTheDocument();
    expect(
      within(lots).getByText(t.inboundLot.unmatched(t.inboundLot.resultChip(3, '합격', null))),
    ).toBeInTheDocument();
  });

  it('R14a-1 처분 수량은 남은 수량 전부로 잠겨 있고, 판정 하나가 자재 관리 LOT 전부에 간다', async () => {
    const { user } = renderInbound();
    await screen.findByText('SAMPLE-ML|0003');

    const qty = screen.getByLabelText(t.form.qtyLabel);
    await waitFor(() => expect(qty).toHaveTextContent('3,000 EA'));

    await user.click(screen.getByRole('radio', { name: '폐기' }));
    expect(screen.getByText(t.form.wholeEffect(3, '폐기'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.form.reasonLabel), '합성 폐기 사유');
    await saveAndConfirm(user);

    /* #352 — 결재 없이 판정 저장 경로로 바로 반영한다. */
    await waitFor(() =>
      expect(posted('/quality/nonconformances/41/disposition-decisions')).toBeDefined(),
    );
    await expect(
      posted('/quality/nonconformances/41/disposition-decisions')?.json(),
    ).resolves.toEqual({
      dispositionTypeCode: 'SCRAP',
      decisionQty: 3000,
      uomId: 7001,
      reason: '합성 폐기 사유',
    });
    /* 결과 상자는 두지 않는다 — 종결은 「처분 판정」 제목 옆 라벨이 말한다(#352 사용자 지시). */
    expect(await screen.findByText(t.form.success)).toBeInTheDocument();
    expect(document.querySelector('.disposition-result')).toBeNull();
  });

  it('US4-4 다LOT 부적합의 전량 특채는 lotId 없이 남은 수량으로 저장하고, 바로 풀린 자재 관리 LOT 수를 알린다', async () => {
    const { user } = renderInbound({
      concessionResponse: () =>
        jsonResponse(
          {
            concessionId: 61,
            concessionNo: 'SAMPLE-CN-0061',
            nonconformanceId: 41,
            lotId: 8101,
            approvedQty: 1000,
            consumedQty: 0,
            uomId: 7001,
            validFrom: '2026-11-11',
            approvalRequestId: null,
            statusCode: 'APPROVED',
            concessionIds: [61, 62, 63],
          },
          { status: 201 },
        ),
    });
    await screen.findByText('SAMPLE-ML|0003');

    // 팝업 없이 특채를 고르면 아래에 적용 기간 칸이 펼쳐지고, 사유는 판정 사유 칸 하나로 보낸다(#352).
    await user.click(screen.getByRole('radio', { name: '특채' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText(t.concession.validFrom, { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText('저장하면 자재 관리 LOT 3개에 모두 ‘특채’ 판정이 적용됩니다.'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.form.reasonLabel), '합성 특채 사유');
    await saveAndConfirm(user);

    await waitFor(() => expect(posted('/quality/concessions')).toBeDefined());
    const body = (await posted('/quality/concessions')?.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('lotId');
    expect(body).toMatchObject({
      nonconformanceId: 41,
      approvedQty: 3000,
      uomId: 7001,
      reason: '합성 특채 사유',
    });
    expect(typeof body.validFrom).toBe('string');
    expect(await screen.findByText(t.concession.appliedLots(3))).toBeInTheDocument();
  });

  it('R14a-1 반품 · OQC 부적합(입하 LOT 없음)에는 선별이 없다 — 잠그고 이유를 단다', async () => {
    renderScreen({ lots: INBOUND_LOTS, concessions: [] });
    await screen.findByText('SAMPLE-ML|0003');

    const sort = screen.getByRole('radio', { name: '선별' });
    expect(sort).toBeDisabled();
    expect(sort).toHaveAccessibleDescription(t.form.typeLock.sortNoInboundLot);
    expect(screen.getByRole('radio', { name: '폐기' })).toBeEnabled();
    expect(screen.queryByText(/처분 결과는/)).toBeNull();
  });

  it('G2 L10 취소된 부적합(CANCELLED · IQC 확정 취소로 생김)은 처분 대기 목록에 나오지 않는다', async () => {
    renderInbound({ nonconformance: { ...INBOUND_NONCONFORMANCE, statusCode: 'CANCELLED' } });

    await waitFor(() =>
      expect(
        requestsSent().some(
          (request) => new URL(request.url).pathname === '/quality/nonconformances',
        ),
      ).toBe(true),
    );
    expect(await screen.findByText(t.empty.title)).toBeInTheDocument();
    expect(document.querySelector('[data-nc-id="41"]')).toBeNull();
  });

  it('#275 「지금(바뀌기 전)」 안내 띠는 두지 않는다', async () => {
    renderInbound();
    await screen.findByText('SAMPLE-ML|0003');

    expect(screen.queryByText('지금(바뀌기 전)')).toBeNull();
  });
});
