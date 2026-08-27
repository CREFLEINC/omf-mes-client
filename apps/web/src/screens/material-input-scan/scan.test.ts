import { describe, expect, it } from 'vitest';

import { lot, mold } from './fixtures';
import {
  applyScan,
  EMPTY_SCAN_DRAFT,
  hasMaterial,
  isShotCountExceeded,
  normalizeScanCode,
  toScannedMaterial,
  toScannedMold,
  type ScanDraft,
} from './scan';

describe('normalizeScanCode', () => {
  it('앞뒤 공백을 턴다', () => {
    expect(normalizeScanCode('  SAMPLE-LOT-0001  ')).toBe('SAMPLE-LOT-0001');
  });

  /* 스캐너는 코드 끝에 개행을 붙여 보낸다. 그대로 실으면 같은 LOT이 매번 다른 검색어가 된다. */
  it('스캐너가 붙인 개행을 턴다', () => {
    expect(normalizeScanCode('SAMPLE-LOT-0001\r\n')).toBe('SAMPLE-LOT-0001');
  });

  it.each(['', '   ', '\n'])('쓸 수 없는 값(%j)은 null이다', (raw) => {
    expect(normalizeScanCode(raw)).toBeNull();
  });
});

describe('toScannedMaterial', () => {
  it('계약 응답을 담을 수 있는 모양으로 옮긴다', () => {
    expect(toScannedMaterial(lot())).toMatchObject({
      lotId: 7301,
      lotNo: 'SAMPLE-LOT-0001',
      itemId: 7201,
      uomId: 7401,
      statusCode: 'NORMAL',
      isHeld: false,
    });
  });

  /* `held`는 선택 필드다. 없는 것을 「보류 중」으로 읽으면 멀쩡한 자재에 경고가 붙는다. */
  it('보류 표시가 없으면 보류가 아니다', () => {
    expect(toScannedMaterial(lot({ held: undefined })).isHeld).toBe(false);
  });

  it('보류 표시가 있으면 그대로 옮긴다', () => {
    expect(toScannedMaterial(lot({ held: true })).isHeld).toBe(true);
  });
});

describe('toScannedMold', () => {
  /*
   * 적정 타수는 마스터에 없을 수 있다. 없는 것을 0으로 채우면 남은 타수가 0이 되어
   * **한도를 넘은 금형으로 보인다** — 계약도 그때 남은 타수를 `null`로 내린다.
   */
  it('적정 타수가 없으면 null로 옮긴다 — 0으로 채우지 않는다', () => {
    const scanned = toScannedMold(mold({ guaranteedShotCount: null, availableShotCount: null }));

    expect(scanned.guaranteedShotCount).toBeNull();
    expect(scanned.availableShotCount).toBeNull();
  });

  it('타발수를 그대로 옮긴다', () => {
    expect(toScannedMold(mold())).toMatchObject({
      moldId: 7601,
      moldCode: 'SAMPLE-MLD-01',
      currentShotCount: 12450,
      guaranteedShotCount: 50000,
      availableShotCount: 37550,
    });
  });
});

describe('isShotCountExceeded', () => {
  it('남은 타수가 있으면 넘지 않았다', () => {
    expect(isShotCountExceeded(toScannedMold(mold()))).toBe(false);
  });

  it('남은 타수가 0이면 넘은 것이다', () => {
    expect(isShotCountExceeded(toScannedMold(mold({ availableShotCount: 0 })))).toBe(true);
  });

  /*
   * 적정 타수가 없으면 넘었는지 **알 수 없다.** 여기서 `true`를 내면 알 수 없는 것을 경고로
   * 단정하게 되고, 작업자는 멀쩡한 금형을 교체한다.
   */
  it('적정 타수가 없으면 넘었다고 말하지 않는다', () => {
    expect(
      isShotCountExceeded(
        toScannedMold(mold({ guaranteedShotCount: null, availableShotCount: null })),
      ),
    ).toBe(false);
  });
});

describe('applyScan', () => {
  const material = toScannedMaterial(lot());
  const scannedMold = toScannedMold(mold());

  it('자재는 쌓는다', () => {
    const next = applyScan(EMPTY_SCAN_DRAFT, { kind: 'material', material });

    expect(next.materials).toHaveLength(1);
  });

  /* 러닝체인지로 금형을 바꾸면 새로 읽은 것이 지금 물린 금형이다. 둘이 함께 남으면 안 된다. */
  it('금형은 덮어쓴다', () => {
    const first = applyScan(EMPTY_SCAN_DRAFT, { kind: 'mold', mold: scannedMold });
    const second = applyScan(first, {
      kind: 'mold',
      mold: toScannedMold(mold({ moldId: 7602, moldCode: 'SAMPLE-MLD-02' })),
    });

    expect(second.mold?.moldCode).toBe('SAMPLE-MLD-02');
  });

  it.each([
    { kind: 'duplicate', lotNo: 'SAMPLE-LOT-0001' } as const,
    { kind: 'ambiguous', count: 3 } as const,
    { kind: 'not-found', code: 'SAMPLE-X' } as const,
  ])('담기지 않는 결과($kind)는 후보를 바꾸지 않는다', (outcome) => {
    const before: ScanDraft = { materials: [material], mold: scannedMold };

    expect(applyScan(before, outcome)).toBe(before);
  });
});

describe('hasMaterial', () => {
  it('담긴 LOT을 번호가 아니라 식별자로 찾는다', () => {
    const draft: ScanDraft = { materials: [toScannedMaterial(lot())], mold: null };

    expect(hasMaterial(draft, 7301)).toBe(true);
    expect(hasMaterial(draft, 7302)).toBe(false);
  });
});
