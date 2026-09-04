import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { confirmLockReason, type ConfirmLockInput } from './confirm-lock';
import type { PackedLine } from './types';

const t = messages.packingResult;

const line: PackedLine = {
  shipmentLotAllocationId: 9001,
  itemId: 5001,
  itemCode: 'SYN-FG-1001',
  lotId: 8001,
  lotNo: 'SYN-LOT-000123450',
  uomId: 920001,
  qty: 120,
  remaining: 180,
};

/** 전부 갖춰진 상태 — 여기서 하나씩 무너뜨려 사유를 확인한다. */
const ready = (overrides: Partial<ConfirmLockInput> = {}): ConfirmLockInput => ({
  isOnline: true,
  gate: 'allowed',
  workerNo: '3391',
  handlingUnitTypeCode: 'CARTON',
  lines: [line],
  ...overrides,
});

describe('confirmLockReason', () => {
  it('다 갖춰지면 잠그지 않는다', () => {
    expect(confirmLockReason(ready())).toBeUndefined();
  });

  it('⛔ 오프라인은 «가장 먼저» 막는다 — 다 담고 나서 알면 그 입력이 헛일이 된다', () => {
    expect(confirmLockReason(ready({ isOnline: false, lines: [] }))).toBe(t.locks.offline);
  });

  it('게이팅은 판정마다 다른 말을 한다 — 「모른다」와 「막혔다」를 묶지 않는다', () => {
    expect(confirmLockReason(ready({ gate: 'checking' }))).toBe(t.locks.gateChecking);
    expect(confirmLockReason(ready({ gate: 'denied' }))).toBe(t.locks.gateDenied);
    expect(confirmLockReason(ready({ gate: 'unavailable' }))).toBe(t.locks.gateUnavailable);
    expect(confirmLockReason(ready({ gate: 'unidentified' }))).toBe(t.locks.gateUnidentified);
  });

  it('사번이 없으면 막는다 — 쓰기의 귀속 헤더가 비면 서버가 거부한다', () => {
    expect(confirmLockReason(ready({ workerNo: null }))).toBe(t.locks.workerMissing);
    expect(confirmLockReason(ready({ workerNo: '  ' }))).toBe(t.locks.workerMissing);
  });

  it('유형이 없으면 막는다', () => {
    expect(confirmLockReason(ready({ handlingUnitTypeCode: '' }))).toBe(t.locks.noType);
  });

  it('내용물이 0건이면 막는다 — 빈 포장을 만들 수 없다', () => {
    expect(confirmLockReason(ready({ lines: [] }))).toBe(t.locks.noContents);
  });
});
