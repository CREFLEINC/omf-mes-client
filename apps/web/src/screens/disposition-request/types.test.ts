import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { stageOf } from './codes';
import { nonconformanceFixture, productCandidate, returnCandidate } from './fixtures';
import { toCandidateRow, toDecisionRow, toNonconformanceRow } from './types';
import { decisionFixture } from './fixtures';

const t = messages.dispositionRequest;

describe('toCandidateRow', () => {
  it('부적합이 없으면 단계는 NONE 이고 입고 정보가 머리에 남는다', () => {
    const row = toCandidateRow(returnCandidate());

    expect(row.stage).toBe('NONE');
    expect(row.nonconformanceId).toBeNull();
    expect(row.receiptNo).toBe('RT-TEST-0044');
    expect(row.receivedAtText).toBe('2026-09-01');
    expect(row.partnerName).toBe('합성 거래처');
    expect(row.qtyText).toBe('200');
    expect(row.itemText).toBe('SYN-FG-1 · 합성 제품');
  });

  it('부적합이 있으면 그 상태가 단계다', () => {
    expect(toCandidateRow(productCandidate()).stage).toBe('NOT_REQUESTED');
    expect(toCandidateRow(productCandidate({ nonconformanceStatusCode: 'DECIDED' })).stage).toBe(
      'DECIDED',
    );
  });

  /* ⛔ 모르는 상태 코드에 이름을 지어내지 않는다(G-9) — 코드를 그대로 든다. */
  it('모르는 상태 코드는 단계 없이 코드를 그대로 든다', () => {
    const row = toCandidateRow(
      productCandidate({ nonconformanceStatusCode: 'SYN-UNKNOWN' as never }),
    );

    expect(row.stage).toBeNull();
    expect(row.stageCodeText).toBe('SYN-UNKNOWN');
  });
});

describe('toNonconformanceRow', () => {
  it('LOT 이 하나면 그 LOT 을 든다', () => {
    const row = toNonconformanceRow(nonconformanceFixture());

    expect(row.lotId).toBe(8202);
    expect(row.lotNo).toBe('LOT-TEST-0305');
    expect(row.nonconformanceId).toBe(7001);
    expect(row.stage).toBe('NOT_REQUESTED');
  });

  /* 이 화면의 등록은 LOT 하나 단위다 — 여러 LOT 부적합에는 새로 등록할 LOT 이 없다. */
  it('LOT 이 여럿이면 LOT 을 비우고 건수로 적는다', () => {
    const lots = nonconformanceFixture().lots;
    const row = toNonconformanceRow(
      nonconformanceFixture({
        lots: [lots[0]!, { ...lots[0]!, nonconformanceLotId: 7102, lotId: 8203 }],
      }),
    );

    expect(row.lotId).toBeNull();
    expect(row.lotNo).toBe(t.target.lotCount(2));
  });
});

describe('stageOf', () => {
  it('없음은 NONE 이고 알려진 셋은 그대로다', () => {
    expect(stageOf(null)).toBe('NONE');
    expect(stageOf(undefined)).toBe('NONE');
    expect(stageOf('PENDING_DECISION')).toBe('PENDING_DECISION');
  });

  it('NONE 이라는 코드가 서버에서 오면 모르는 값이다 — 계약 값이 아니다', () => {
    expect(stageOf('NONE')).toBeNull();
  });
});

describe('toDecisionRow', () => {
  it('판정 일시를 분까지 자르고 결재 여부를 든다', () => {
    const row = toDecisionRow(decisionFixture({ approvalRequestId: 501 }));

    expect(row.decidedAtText).toBe('2026-09-02 14:20');
    expect(row.hasApproval).toBe(true);
    expect(row.qtyText).toBe('240');
  });
});
