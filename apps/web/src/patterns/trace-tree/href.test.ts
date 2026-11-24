import { describe, expect, it } from 'vitest';

import { legacyTraceHref, lotTraceHref } from './href';

const legacy = (query: string) => legacyTraceHref(new URLSearchParams(query));

describe('옛 주소 넘기기 · [추적 보기] 갈림(FR-017·FR-018)', () => {
  it('Q21 mlot + selected → 자재 기준에서 그 LOT 을 고른다', () => {
    expect(legacy('mlot=A%7C1&selected=101&from=2026-11-01&to=2026-11-07')).toBe(
      '/production/material-trace?lot=101',
    );
  });

  it('Q21 plot + selected → 제품 기준에서 그 LOT 을 고른다', () => {
    expect(legacy('plot=P3&selected=301')).toBe('/production/product-trace?lot=301');
  });

  it('Q21 탭이 있던 때의 주소(tab=backward&lot=번호)는 그 번호를 스캔한 것처럼 연다', () => {
    expect(legacy('tab=backward&lot=P-0001')).toBe('/production/product-trace?q=P-0001');
    expect(legacy('tab=forward&q=A%7C1&selected=101')).toBe('/production/material-trace?lot=101');
  });

  it('Q21 LOT 이 정해지지 않은 주소는 자재 기준 최근 목록', () => {
    expect(legacy('from=2026-11-01&to=2026-11-07&kind=SHIPMENT')).toBe(
      '/production/material-trace',
    );
    expect(legacy('tab=movements&kind=MATERIAL')).toBe('/production/material-trace');
  });

  it('FR-017 [추적 보기] — 자재 LOT 은 자재 기준, 생산 LOT(반제품 포함)은 제품 기준', () => {
    expect(lotTraceHref({ lotId: 101, lotTypeCode: 'MATERIAL' })).toBe(
      '/production/material-trace?lot=101',
    );
    expect(lotTraceHref({ lotId: 301, lotTypeCode: 'PRODUCTION' })).toBe(
      '/production/product-trace?lot=301',
    );
  });
});
