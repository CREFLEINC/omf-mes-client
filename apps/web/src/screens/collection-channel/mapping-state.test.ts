import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  countWarnings,
  hasUnitMismatch,
  inspectionItemText,
  isStaleRevision,
  lacksItemName,
  mappingWarnings,
  warningRowText,
  warningSummaryLines,
} from './mapping-state';
import type { CollectionChannel } from './types';

const t = messages.collectionChannel;

const channel = (overrides: Partial<CollectionChannel> = {}): CollectionChannel => ({
  collectionChannelId: 8001,
  equipmentId: 3001,
  channelKey: 'BARREL_TEMP',
  isActive: true,
  ...overrides,
});

const mapped = (overrides: Partial<CollectionChannel> = {}): CollectionChannel =>
  channel({ inspectionItemId: 5001, ...overrides });

describe('이어 둔 검사 항목을 이름으로', () => {
  it('코드와 이름이 오면 함께 적는다', () => {
    expect(
      inspectionItemText(mapped({ inspectionItemCode: 'CYCLE', inspectionItemName: '사이클' })),
    ).toBe(t.mapping.itemLabel('CYCLE', '사이클'));
  });

  /** ⛔ 없는 쪽을 빈칸으로 두면 「· 」 같은 부스러기가 남는다. */
  it('코드만 오면 코드만 적는다', () => {
    expect(inspectionItemText(mapped({ inspectionItemCode: 'CYCLE' }))).toBe('CYCLE');
  });

  it('이름만 오면 이름만 적는다', () => {
    expect(inspectionItemText(mapped({ inspectionItemName: '사이클' }))).toBe('사이클');
  });

  /** ⛔ 오지 않은 이름을 지어내지 않는다 — 아는 데까지만 말한다(G-9). */
  it('둘 다 오지 않으면 「연결됨」까지만 말한다', () => {
    expect(inspectionItemText(mapped())).toBe(t.mapping.mapped);
  });

  it('빈 문자열은 오지 않은 것과 같다', () => {
    expect(inspectionItemText(mapped({ inspectionItemCode: '', inspectionItemName: '' }))).toBe(
      t.mapping.mapped,
    );
  });
});

describe('이름이 오지 않은 줄', () => {
  it('이어 두었는데 코드도 이름도 없으면 그런 줄이다', () => {
    expect(lacksItemName(mapped())).toBe(true);
  });

  it('한쪽이라도 오면 아니다', () => {
    expect(lacksItemName(mapped({ inspectionItemCode: 'CYCLE' }))).toBe(false);
  });

  /** ⭐ 잇지 않은 줄은 애초에 이름이 있을 수 없다 — 그 줄까지 세면 늘 서는 말이 된다. */
  it('잇지 않은 줄은 세지 않는다', () => {
    expect(lacksItemName(channel())).toBe(false);
  });
});

describe('옛 개정판 경고', () => {
  it('서버가 「최신이 아니다」라고 하면 선다', () => {
    expect(isStaleRevision(mapped({ inspectionItemIsCurrentRevision: false }))).toBe(true);
  });

  it('최신이면 서지 않는다', () => {
    expect(isStaleRevision(mapped({ inspectionItemIsCurrentRevision: true }))).toBe(false);
  });

  /**
   * ⛔ **판정이 오지 않은 것은 「옛 판이다」가 아니라 「모른다」다.** 모르는 것을 경고로
   * 세우면 멀쩡한 줄에까지 늑대가 온다.
   */
  it('판정이 오지 않으면 서지 않는다', () => {
    expect(isStaleRevision(mapped())).toBe(false);
    expect(isStaleRevision(mapped({ inspectionItemIsCurrentRevision: null }))).toBe(false);
  });
});

describe('단위 불일치 경고', () => {
  it('둘 다 있고 서로 다르면 선다', () => {
    expect(hasUnitMismatch(mapped({ unitCode: 'SEC', inspectionItemUnitCode: 'MIN' }))).toBe(true);
  });

  it('같으면 서지 않는다', () => {
    expect(hasUnitMismatch(mapped({ unitCode: 'SEC', inspectionItemUnitCode: 'SEC' }))).toBe(false);
  });

  /** ⛔ 「없다」는 「다르다」가 아니다 — 한쪽이 비면 견줄 것이 없다. */
  it('한쪽이 없으면 견주지 않는다', () => {
    expect(hasUnitMismatch(mapped({ unitCode: 'SEC' }))).toBe(false);
    expect(hasUnitMismatch(mapped({ inspectionItemUnitCode: 'SEC' }))).toBe(false);
    expect(hasUnitMismatch(mapped({ unitCode: '', inspectionItemUnitCode: 'SEC' }))).toBe(false);
  });
});

describe('줄에 붙는 경고', () => {
  it('둘 다면 둘 다 붙고 순서가 고정이다', () => {
    expect(
      mappingWarnings(
        mapped({
          inspectionItemIsCurrentRevision: false,
          unitCode: 'SEC',
          inspectionItemUnitCode: 'MIN',
        }),
      ),
    ).toEqual(['staleRevision', 'unitMismatch']);
  });

  it('멀쩡하면 아무것도 붙지 않는다', () => {
    expect(mappingWarnings(mapped({ inspectionItemIsCurrentRevision: true }))).toEqual([]);
  });

  /** Rev 번호가 오면 어느 판인지 함께 적는다 — 없으면 지어내지 않는다. */
  it('옛 Rev 줄은 Rev 번호를 함께 말한다', () => {
    expect(warningRowText(mapped({ inspectionPlanVersion: 2 }), 'staleRevision')).toBe(
      t.warnings.staleRevisionRow(2),
    );
    expect(warningRowText(mapped(), 'staleRevision')).toBe(t.warnings.staleRevisionRow(null));
  });

  it('단위 불일치 줄은 두 단위를 함께 말한다', () => {
    expect(
      warningRowText(mapped({ unitCode: 'SEC', inspectionItemUnitCode: 'MIN' }), 'unitMismatch'),
    ).toBe(t.warnings.unitMismatchRow('SEC', 'MIN'));
  });
});

describe('표 위 요약', () => {
  const channels = [
    mapped({ inspectionItemIsCurrentRevision: false }),
    mapped({ unitCode: 'SEC', inspectionItemUnitCode: 'MIN' }),
    mapped({ inspectionItemIsCurrentRevision: true, unitCode: 'SEC' }),
  ];

  it('갈래마다 따로 센다', () => {
    expect(countWarnings(channels)).toEqual({ staleRevision: 1, unitMismatch: 1 });
  });

  it('셀 것이 있는 갈래만 줄을 세운다', () => {
    expect(warningSummaryLines({ staleRevision: 2, unitMismatch: 0 })).toEqual([
      t.warnings.staleRevision(2),
    ]);
  });

  /** 셀 것이 없으면 빈 배열이다 — 그때는 요약 자체가 서지 않는다. */
  it('아무것도 없으면 빈 배열이다', () => {
    expect(warningSummaryLines({ staleRevision: 0, unitMismatch: 0 })).toEqual([]);
  });
});
