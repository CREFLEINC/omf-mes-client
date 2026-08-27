import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { ExpansionBlockReason, ExpansionState } from './expansion';
import { type IssueLockInput, toIssueLock } from './issue-lock';

const t = messages.emergencyWorkOrder.lock;

const READY: ExpansionState = {
  kind: 'ready',
  bom: {
    bomId: 71,
    parentItemId: 5001,
    bomCode: 'SYN-BOM-0001',
    bomVersion: 3,
    statusCode: 'SYN_ACTIVE',
    isDefault: true,
    effectiveFrom: '2026-01-01',
    baseQty: 1,
    baseUomId: 11,
  },
  routing: {
    routingId: 31,
    itemId: 5001,
    routingCode: 'SYN-RT-0001',
    routingVersion: 2,
    statusCode: 'SYN_ACTIVE',
  },
  operations: [],
};

const KNOWN_CODE = 'SYN_EMERGENCY';

const input = (overrides: Partial<IssueLockInput> = {}): IssueLockInput => ({
  isIssuing: false,
  undeliveredWorkOrderNo: null,
  issueError: null,
  expansion: READY,
  isInputComplete: true,
  typeCode: KNOWN_CODE,
  ...overrides,
});

const httpError = (status: number): ApiError => ({ kind: 'http', status, message: '서버 응답' });
const networkError: ApiError = { kind: 'network' };

describe('toIssueLock', () => {
  it('전부 갖춰지면 잠그지 않는다', () => {
    expect(toIssueLock(input())).toEqual({
      reason: undefined,
      isUncertain: false,
      canRetryRelease: false,
    });
  });

  describe('배포되지 않은 W/O', () => {
    it('⛔ 무엇보다 먼저 막는다 — 새로 발행하면 같은 지시가 둘이 된다', () => {
      const lock = toIssueLock(
        input({
          undeliveredWorkOrderNo: 'SYN-WO-0007',
          isIssuing: true,
          issueError: networkError,
          expansion: { kind: 'idle' },
          isInputComplete: false,
          typeCode: '',
        }),
      );

      expect(lock.reason).toBe(t.undelivered('SYN-WO-0007'));
      expect(lock.canRetryRelease).toBe(true);
    });

    it('⛔ 「발행 실패」가 아니라 「배포 안 됨」으로, 만들어진 번호와 함께 말한다', () => {
      const lock = toIssueLock(input({ undeliveredWorkOrderNo: 'SYN-WO-0007' }));

      expect(lock.reason).toContain('SYN-WO-0007');
      expect(lock.reason).toContain('배포되지 않았습니다');
      expect(lock.reason).not.toContain('발행하지');
    });

    it('배포 재시도는 이 상태에서만 열린다', () => {
      for (const overrides of [
        {},
        { isIssuing: true },
        { issueError: networkError },
        { issueError: httpError(403) },
        { typeCode: '' },
        { expansion: { kind: 'idle' } as ExpansionState },
        { isInputComplete: false },
      ]) {
        expect(toIssueLock(input(overrides)).canRetryRelease).toBe(false);
      }
    });
  });

  describe('결과를 모르는 요청', () => {
    it.each([
      ['연결 실패', networkError],
      ['500', httpError(500)],
      ['503', httpError(503)],
    ])('%s 는 결과 불명으로 본다 — 다시 보내면 지시가 둘이 될 수 있다', (_name, error) => {
      const lock = toIssueLock(input({ issueError: error }));

      expect(lock.reason).toBe(t.uncertain);
      expect(lock.isUncertain).toBe(true);
    });

    it.each([
      ['400', httpError(400)],
      ['409', httpError(409)],
      ['403', httpError(403)],
    ])('%s 는 결과가 분명하다 — 불명으로 잠그지 않는다', (_name, error) => {
      expect(toIssueLock(input({ issueError: error })).isUncertain).toBe(false);
    });
  });

  it('⛔ 권한이 없으면 감추지 않고 사유와 함께 잠근다', () => {
    const lock = toIssueLock(input({ issueError: httpError(403) }));

    expect(lock.reason).toBe(t.forbidden);
    expect(lock.isUncertain).toBe(false);
  });

  describe('유형 코드 미정', () => {
    it.each([undefined, '', '   '])('값이 없으면 잠근다: %s', (typeCode) => {
      expect(toIssueLock(input({ typeCode })).reason).toBe(t.typeCodeUnknown);
    });

    it('⛔ 입력·전개보다 «먼저» 말한다 — 다 채운 뒤에 「어차피 안 된다」를 만나지 않게', () => {
      const lock = toIssueLock(
        input({ typeCode: '', expansion: { kind: 'idle' }, isInputComplete: false }),
      );

      expect(lock.reason).toBe(t.typeCodeUnknown);
    });

    it('값이 오면 그 자리가 열린다 — 상수 한 줄이면 된다', () => {
      expect(toIssueLock(input({ typeCode: KNOWN_CODE })).reason).toBeUndefined();
    });
  });

  describe('전개', () => {
    const blocked = (reason: ExpansionBlockReason): ExpansionState => ({ kind: 'blocked', reason });

    it.each([
      [{ kind: 'idle' } as ExpansionState, t.itemNotChosen],
      [{ kind: 'loading' } as ExpansionState, t.expansionLoading],
      [{ kind: 'error' } as ExpansionState, t.expansionError],
      [{ kind: 'needsRevision', routings: [] } as ExpansionState, t.revisionNotChosen],
      [blocked('bomMissing'), t.blocked.bomMissing],
      [blocked('routingMissing'), t.blocked.routingMissing],
      [blocked('bothMissing'), t.blocked.bothMissing],
      [blocked('operationsMissing'), t.blocked.operationsMissing],
    ])('전개가 $0.kind 이면 그 사유로 잠근다', (expansion, reason) => {
      expect(toIssueLock(input({ expansion })).reason).toBe(reason);
    });

    it('⛔ 막힌 사유가 서로 다른 문구다 — 무엇을 마련해야 하는지 갈린다', () => {
      const reasons = new Set([
        t.blocked.bomMissing,
        t.blocked.routingMissing,
        t.blocked.bothMissing,
        t.blocked.operationsMissing,
      ]);

      expect(reasons.size).toBe(4);
    });
  });

  it('전개가 끝났는데 입력이 덜 찼으면 입력을 짚는다', () => {
    expect(toIssueLock(input({ isInputComplete: false })).reason).toBe(t.inputIncomplete);
  });

  it('⛔ 전개 사유가 입력 사유보다 앞선다 — 고르기 전에 「수량을 채우라」고 하지 않는다', () => {
    const lock = toIssueLock(input({ expansion: { kind: 'idle' }, isInputComplete: false }));

    expect(lock.reason).toBe(t.itemNotChosen);
  });

  describe('보내는 중', () => {
    it('보내는 중에는 다시 누를 수 없다', () => {
      expect(toIssueLock(input({ isIssuing: true })).reason).toBe(t.issuing);
    });

    it('⛔ 보내는 중이 권한·전개보다 앞선다 — 나가 있는 요청이 먼저다', () => {
      const lock = toIssueLock(
        input({ isIssuing: true, issueError: httpError(403), expansion: { kind: 'idle' } }),
      );

      expect(lock.reason).toBe(t.issuing);
    });
  });

  it('⛔ 모든 사유가 컨트롤 이름으로 시작한다 — 끊겨 보여도 무엇이 막혔는지 안다', () => {
    const reasons = [
      t.issuing,
      t.uncertain,
      t.forbidden,
      t.typeCodeUnknown,
      t.itemNotChosen,
      t.expansionLoading,
      t.expansionError,
      t.revisionNotChosen,
      t.inputIncomplete,
      t.undelivered('SYN-WO-0007'),
      ...Object.values(t.blocked),
    ];

    for (const reason of reasons) {
      expect(reason.startsWith(`${messages.emergencyWorkOrder.action}:`)).toBe(true);
    }
  });
});
