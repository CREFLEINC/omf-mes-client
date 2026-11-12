import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '../../patterns/session';
import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { dispositionStub, lotFixture, requestsSent } from './fixtures';
import { NOW_BAND } from './now-band';
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
    expect(screen.getByText(t.inboundLot.bannerTitle)).toBeInTheDocument();
    const lots = screen.getByRole('region', { name: t.panes.lots });
    expect(within(lots).getByText(t.inboundLot.matchingNote)).toBeInTheDocument();
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

    const qty = screen.getByLabelText(`${t.form.qtyLabel} (EA)`);
    await waitFor(() => expect(qty).toHaveValue('3,000 EA'));
    expect(qty).toHaveAttribute('readonly');

    await user.click(screen.getByRole('radio', { name: '재작업' }));
    expect(
      screen.getByText(t.form.wholeEffect(3, t.form.reworkInboundEffect('SAMPLE-IL-0501'))),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.form.reasonLabel), '합성 재작업 사유');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() =>
      expect(posted('/quality/nonconformances/41/disposition-decisions')).toBeDefined(),
    );
    await expect(
      posted('/quality/nonconformances/41/disposition-decisions')?.json(),
    ).resolves.toEqual({
      dispositionTypeCode: 'REWORK',
      decisionQty: 3000,
      uomId: 7001,
      reason: '합성 재작업 사유',
    });
    expect(await screen.findByText(t.form.resultClosed('재작업'))).toBeInTheDocument();
    expect(
      screen.getByText(t.form.resultLots(3, t.form.resultWhat.REWORK ?? '')),
    ).toBeInTheDocument();
    expect(screen.getByText(t.form.reworkReopened('SAMPLE-IL-0501'))).toBeInTheDocument();
  });

  it('US4-4 다LOT 부적합의 전량 특채는 lotId 없이 남은 수량으로 요청하고, 특채가 걸린 자재 관리 LOT 수를 알린다', async () => {
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
            approvalRequestId: 77,
            statusCode: 'PENDING',
            concessionIds: [61, 62, 63],
          },
          { status: 201 },
        ),
    });
    await screen.findByText('SAMPLE-ML|0003');

    await user.click(screen.getByRole('button', { name: t.concession.request }));
    const dialog = await screen.findByRole('dialog', { name: t.concession.requestHeading });
    // 수량 입력 없음 — 사용 가능 수량은 남은 수량 고정, 대상은 자재 관리 LOT 전부.
    expect(within(dialog).getByLabelText(t.concession.qty)).toHaveValue('3,000 EA');
    expect(within(dialog).getByLabelText(t.concession.qty)).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText(t.concession.target)).toHaveValue(
      t.concession.targetAll('SAMPLE-IL-0501', 3),
    );
    await user.type(within(dialog).getByLabelText(t.concession.reason), '합성 특채 사유');
    await user.click(within(dialog).getByRole('button', { name: t.concession.request }));

    await waitFor(() => expect(posted('/quality/concessions')).toBeDefined());
    const body = (await posted('/quality/concessions')?.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('lotId');
    expect(body).toMatchObject({ nonconformanceId: 41, approvedQty: 3000, uomId: 7001 });
    expect(await screen.findByText(t.concession.requestedLots(3))).toBeInTheDocument();
  });

  it('R14a-1 반품 · OQC 부적합(입하 LOT 없음)에는 선별이 없다 — 잠그고 이유를 단다', async () => {
    renderScreen({ lots: INBOUND_LOTS, concessions: [] });
    await screen.findByText('SAMPLE-ML|0003');

    const sort = screen.getByRole('radio', { name: '선별' });
    expect(sort).toBeDisabled();
    expect(sort).toHaveAccessibleDescription(t.form.typeLock.sortNoInboundLot);
    expect(screen.getByRole('radio', { name: '재작업' })).toBeEnabled();
    expect(screen.queryByText(t.inboundLot.bannerTitle)).toBeNull();
  });

  it('US4-4 결재 대기 특채가 있으면 그 번호로 알리고, 다른 처분을 잠근다', async () => {
    renderInbound({
      concessions: [
        {
          concessionId: 61,
          concessionNo: 'SAMPLE-CN-0061',
          nonconformanceId: 41,
          lotId: 8101,
          approvedQty: 1000,
          consumedQty: 0,
          uomId: 7001,
          validFrom: '2026-11-11',
          approvalRequestId: 77,
          statusCode: 'PENDING',
        },
        {
          concessionId: 62,
          concessionNo: 'SAMPLE-CN-0062',
          nonconformanceId: 41,
          lotId: 8102,
          approvedQty: 1000,
          consumedQty: 0,
          uomId: 7001,
          validFrom: '2026-11-11',
          approvalRequestId: 77,
          statusCode: 'PENDING',
        },
      ],
    });

    expect(
      await screen.findByText(t.concession.pendingBanner('SAMPLE-CN-0061', 3)),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '폐기' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '폐기' })).toHaveAccessibleDescription(
      t.form.typeLock.concessionPending,
    );
  });

  it('US4-4 G2 M3 결재가 승인된 특채는 「승인됨 — 적용 대기」이고 [특채 적용]이 처분 판정 상자 안에 있다', async () => {
    const pending = {
      concessionId: 61,
      concessionNo: 'SAMPLE-CN-0061',
      nonconformanceId: 41,
      lotId: 8101,
      approvedQty: 1000,
      consumedQty: 0,
      uomId: 7001,
      validFrom: '2026-11-11',
      approvalRequestId: 77,
      statusCode: 'PENDING',
    };
    const { user } = renderInbound({ concessions: [pending], approvalStatusCode: 'APPROVED' });

    const banner = await screen.findByText(t.concession.approvedBanner('SAMPLE-CN-0061', 3));
    const box = banner.closest('.disposition-pending-concession') as HTMLElement;
    /* 처분 판정 상자 안 — 「특채 요청 이력」 탭에만 있지 않다. */
    expect(box.closest('.disposition-decision-card')).not.toBeNull();
    expect(screen.queryByText(t.concession.pendingBanner('SAMPLE-CN-0061', 3))).toBeNull();

    await user.click(within(box).getByRole('button', { name: t.concession.apply }));
    await waitFor(() => expect(posted('/quality/concessions/61:apply')).toBeDefined());
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

  it('「지금」 띠는 접힌 채로 시작하고, 펼치면 바뀌기 전 방식을 보인다', async () => {
    const { user } = renderInbound();
    await screen.findByText('SAMPLE-ML|0003');

    const band = screen.getByRole('region', { name: NOW_BAND.title });
    const toggle = within(band).getByRole('button', { name: NOW_BAND.expand });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(band).queryByText(NOW_BAND.items[0].note)).not.toBeVisible();

    await user.click(toggle);

    expect(within(band).getByRole('button', { name: NOW_BAND.collapse })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(within(band).getByText(NOW_BAND.items[0].note)).toBeVisible();
  });
});
