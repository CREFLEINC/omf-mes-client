import { type ApiError, normalizeApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { ExpansionBlockReason, ExpansionState } from './expansion';
import { type IssueLockInput, toIssueLock } from './issue-lock';
import type { PendingWorkOrder } from './mutations';

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

const pendingWorkOrder = (failedAt: PendingWorkOrder['failedAt']): PendingWorkOrder => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  body: { lotSize: 200 },
  failedAt,
});

const input = (overrides: Partial<IssueLockInput> = {}): IssueLockInput => ({
  isIssuing: false,
  pending: null,
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

  describe('배포가 끝나지 않은 W/O', () => {
    /*
     * ⛔ **보내는 중이 이것보다 앞이다.** 정상 흐름에서도 W/O 가 만들어진 «뒤 배포가 도는
     * 동안» 이 상태가 잠깐 존재한다 — 뒤에 두면 그 찰나에 「배포되지 않았습니다」가 뜨고
     * **재시도 버튼이 살아난다.** 첫 배포가 아직 전선에 있는데 두 번째를 부르게 된다.
     */
    it('⛔ 배포가 도는 동안에는 재시도를 열지 않는다 — 정상 흐름에 잠깐 존재하는 상태다', () => {
      const lock = toIssueLock(input({ pending: pendingWorkOrder(null), isIssuing: true }));

      expect(lock.reason).toBe(t.issuing);
      expect(lock.canRetryRelease).toBe(false);
    });

    it('배포가 멈추면 다른 무엇보다 먼저 막는다 — 새로 발행하면 같은 지시가 둘이 된다', () => {
      const lock = toIssueLock(
        input({
          pending: pendingWorkOrder('notSent'),
          issueError: networkError,
          expansion: { kind: 'idle' },
          isInputComplete: false,
          typeCode: '',
        }),
      );

      expect(lock.reason).toBe(t.notSent('SYN-WO-0007'));
      expect(lock.canRetryRelease).toBe(true);
    });

    it('⛔ 「발행 실패」가 아니라 「배포 안 됨」으로, 만들어진 번호와 함께 말한다', () => {
      const lock = toIssueLock(input({ pending: pendingWorkOrder('notSent') }));

      expect(lock.reason).toContain('SYN-WO-0007');
      expect(lock.reason).toContain('배포되지 않았습니다');
      expect(lock.reason).not.toContain('발행하지');
    });

    /*
     * ⛔ **보내지 못한 것과 답을 못 받은 것을 갈라 말한다.** 「안 됐다」고 단언했다가 실제로
     * 됐으면 사용자가 두 번 배포를 시도한다 — 되돌릴 수 없는 쓰기에서 가장 나쁜 오독이다.
     */
    it('⛔ 답을 못 받았으면 「안 됐다」고 단언하지 않는다', () => {
      const lock = toIssueLock(input({ pending: pendingWorkOrder('unknown') }));

      expect(lock.reason).toBe(t.releaseUnknown('SYN-WO-0007'));
      expect(lock.reason).toContain('확인되지 않았습니다');
      expect(lock.reason).not.toContain('배포되지 않았습니다');
      expect(lock.isUncertain).toBe(true);
    });

    it('보내지도 못한 것은 단언해도 된다 — 불명으로 흐리지 않는다', () => {
      expect(toIssueLock(input({ pending: pendingWorkOrder('notSent') })).isUncertain).toBe(false);
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

  /*
   * ⚠ **여기서 확인하는 것은 「되는 것」이 아니라 「안 되는 것」이다.** 오류 정규화가 계약
   * 형태의 본문을 만나면 상태 코드를 버려서, 계약 형태로 온 5xx·403 은 상태로 가릴 수 없다.
   * 손으로 지은 오류로만 검사하면 이 한계가 감지기 뒤에 숨는다 — **실제 정규화를 통과시켜**
   * 한계를 눈에 보이게 고정해 둔다. 부품이 고쳐지면 이 검사가 먼저 깨져서 알려 준다.
   */
  describe('⚠ 계약 형태로 온 오류는 상태로 가리지 못한다 — 부품 쪽 한계', () => {
    const contractShaped = (status: number): ApiError =>
      normalizeApiError(status, {
        errors: [{ scope: 'screen', code: 'SYN_CODE', message: '서버 문구' }],
      });

    it('계약 형태의 5xx 는 「결과 불명」으로 잡히지 않는다', () => {
      expect(toIssueLock(input({ issueError: contractShaped(500) })).isUncertain).toBe(false);
    });

    it('계약 형태의 403 은 권한 사유로 잡히지 않는다', () => {
      expect(toIssueLock(input({ issueError: contractShaped(403) })).reason).not.toBe(t.forbidden);
    });

    /*
     * ⭐ **그래서 배포 단계의 불명은 상태에 기대지 않는다.** 어디까지 갔는지로 판정하므로
     * 정규화가 무엇을 버리든 영향받지 않는다 — 안전이 걸린 자리를 부품 사정에서 떼어 놨다.
     */
    it('배포 불명 판정은 이 한계와 무관하다', () => {
      const lock = toIssueLock(
        input({ pending: pendingWorkOrder('unknown'), issueError: contractShaped(500) }),
      );

      expect(lock.isUncertain).toBe(true);
    });
  });

  describe('발행됐는지 모르는 상태', () => {
    it('⛔ 「실패」가 아니라 「확인되지 않았습니다」로 말한다 — 다시 누르면 지시가 둘이 된다', () => {
      const lock = toIssueLock(input({ isCreateUncertain: true }));

      expect(lock.reason).toBe(t.uncertain);
      expect(lock.isUncertain).toBe(true);
    });

    it('배포가 끝나지 않은 W/O 가 있으면 그쪽이 먼저다 — 번호를 아는 쪽이 더 쓸모 있다', () => {
      const lock = toIssueLock(
        input({ isCreateUncertain: true, pending: pendingWorkOrder('notSent') }),
      );

      expect(lock.reason).toBe(t.notSent('SYN-WO-0007'));
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

  /*
   * ⭐ **값은 정해졌지만 이 잠금은 남는다.** 상수를 채운 것과 「빈 값으로는 못 보낸다」는
   * 다른 보장이고, 뒤엣것은 계속 필요하다 — 빈 유형으로 나가면 서버가 양산으로 채워
   * **오류 없이** 엉뚱한 지시가 만들어진다.
   */
  describe('유형 코드', () => {
    it.each([
      ['빈 문자열', ''],
      ['공백만', '   '],
    ])('⛔ %s 이면 잠근다 — 빈 유형으로 보내면 양산 지시가 만들어진다', (_name, typeCode) => {
      expect(toIssueLock(input({ typeCode })).reason).toBe(t.typeCodeUnknown);
    });

    it('⛔ 입력·전개보다 «먼저» 말한다 — 다 채운 뒤에 「어차피 안 된다」를 만나지 않게', () => {
      const lock = toIssueLock(
        input({ typeCode: '', expansion: { kind: 'idle' }, isInputComplete: false }),
      );

      expect(lock.reason).toBe(t.typeCodeUnknown);
    });

    it('값이 있으면 그 자리가 열린다', () => {
      expect(toIssueLock(input({ typeCode: KNOWN_CODE })).reason).toBeUndefined();
    });

    /* 넘기지 않으면 화면이 쓰는 상수를 그대로 쓴다 — 그 값이 이제 정해져 있어 열린다. */
    it('넘기지 않으면 확정된 상수를 쓴다 — 발행이 열려 있다', () => {
      expect(toIssueLock(input({ typeCode: undefined })).reason).toBeUndefined();
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
      t.notSent('SYN-WO-0007'),
      t.releaseUnknown('SYN-WO-0007'),
      ...Object.values(t.blocked),
    ];

    for (const reason of reasons) {
      expect(reason.startsWith(`${messages.emergencyWorkOrder.action}:`)).toBe(true);
    }
  });
});
