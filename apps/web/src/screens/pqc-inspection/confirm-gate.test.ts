import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toConfirmBlockedReason, type ConfirmGateInput } from './confirm-gate';
import { toTotals } from './quantity-draft';

const t = messages.pqcInspection.result;

/** 아무것도 막히지 않은 상태. 시험마다 «한 가지만» 무너뜨려 그 갈래를 잰다. */
const OPEN: ConfirmGateInput = {
  canInputInspection: true,
  isLocked: false,
  hasRound: true,
  totals: toTotals({ accepted: '30', rejected: '0', held: '0' }, 30),
  judgment: 'ACCEPTED',
  isAllJudged: true,
};

describe('toConfirmBlockedReason — 막힌 사유를 하나로 좁힌다', () => {
  it('전부 갖춰지면 막지 않는다', () => {
    expect(toConfirmBlockedReason(OPEN)).toBeNull();
  });

  /*
   * ⛔ 이 갈래에 감지기가 없어 게이트를 통째로 지워도 아무 시험도 죽지 않던 자리다.
   * 단말 컨텍스트가 서는 날 실제 플래그로 갈아끼울 때 회귀를 잡아 줄 유일한 장치다.
   */
  it('단말에 검사 입력 권한이 없으면 막고, 사유가 «권한»을 가리킨다', () => {
    expect(toConfirmBlockedReason({ ...OPEN, canInputInspection: false })).toBe(
      t.confirmBlockedByTerminal,
    );
  });

  /*
   * ⭐ 차례가 규정이다 — 다른 것이 함께 막혀 있어도 권한이 먼저 나와야 한다. 뒤에 두면
   * 수량·판정을 다 채운 사람이 마지막에야 「이 단말은 할 수 없다」를 만난다.
   */
  it('권한이 없으면 다른 사유보다 «먼저» 나온다', () => {
    const blocked = toConfirmBlockedReason({
      ...OPEN,
      canInputInspection: false,
      hasRound: false,
      judgment: '',
      isAllJudged: false,
      totals: toTotals({ accepted: '1', rejected: '0', held: '0' }, 30),
    });

    expect(blocked).toBe(t.confirmBlockedByTerminal);
  });

  it('확정된 회차는 이미 확정됐다고 말한다', () => {
    expect(toConfirmBlockedReason({ ...OPEN, isLocked: true })).toBe(t.confirmBlockedByConfirmed);
  });

  it('회차가 없으면 «먼저 임시 저장»을 말한다 — 오류가 났다고 하지 않는다', () => {
    expect(toConfirmBlockedReason({ ...OPEN, hasRound: false })).toBe(t.confirmBlockedByUnsaved);
  });

  it('합계가 맞지 않으면 수량을 가리킨다', () => {
    const totals = toTotals({ accepted: '28', rejected: '0', held: '0' }, 30);

    expect(toConfirmBlockedReason({ ...OPEN, totals })).toBe(t.confirmBlockedByTotals);
  });

  /* ⛔ 셀 수 없는 것과 「합이 맞다」는 다르다 — 쓰레기 입력에 확정이 열리면 안 된다. */
  it('셀 수 없으면 막는다', () => {
    const totals = toTotals({ accepted: 'abc', rejected: '0', held: '0' }, 30);

    expect(toConfirmBlockedReason({ ...OPEN, totals })).toBe(t.confirmBlockedByTotals);
  });

  it('종합 판정을 고르지 않았으면 판정을 가리킨다', () => {
    expect(toConfirmBlockedReason({ ...OPEN, judgment: '' })).toBe(t.confirmBlockedByJudgment);
  });

  it('판정하지 않은 검사 항목이 남았으면 항목을 가리킨다', () => {
    expect(toConfirmBlockedReason({ ...OPEN, isAllJudged: false })).toBe(t.confirmBlockedByItems);
  });

  /* 푸는 방법이 다르므로 문구도 달라야 한다 — 뭉치면 무엇을 고칠지 알 수 없다. */
  it('사유가 서로 다른 문장이다', () => {
    const reasons = [
      toConfirmBlockedReason({ ...OPEN, canInputInspection: false }),
      toConfirmBlockedReason({ ...OPEN, isLocked: true }),
      toConfirmBlockedReason({ ...OPEN, hasRound: false }),
      toConfirmBlockedReason({
        ...OPEN,
        totals: toTotals({ accepted: '1', rejected: '0', held: '0' }, 30),
      }),
      toConfirmBlockedReason({ ...OPEN, judgment: '' }),
      toConfirmBlockedReason({ ...OPEN, isAllJudged: false }),
    ];

    expect(new Set(reasons).size).toBe(reasons.length);
  });
});
