import { describe, expect, it } from 'vitest';

import {
  countOutsideBomLines,
  isOutsideBom,
  resolveBomComponentId,
  resolveLineOrigins,
} from './bom-origin';
import { toMaterialIssueRequestBody } from './material-issue-request-body';
import type { MaterialIssueLineDraft, ShortageLineView } from './types';

/**
 * 집중 갈래 — **BOM 유래 판정**(D-3).
 *
 * ⭐ 「경고는 안 뜨는데 FK 만 비어 나가는」 상태가 이 화면에서 가장 조용한 결함이다. 표시와
 * 본문이 **같은 함수**를 지나는지를 마지막 갈래가 확인한다.
 */

const shortage: ShortageLineView[] = [
  {
    itemId: 7401,
    bomComponentId: 7601,
    uomId: 7501,
    requiredQty: 200,
    issuedQty: 120,
    shortageQty: 80,
  },
  {
    itemId: 7403,
    bomComponentId: null,
    uomId: 7502,
    requiredQty: 10,
    issuedQty: 0,
    shortageQty: 10,
  },
];

const line = (patch: Partial<MaterialIssueLineDraft> = {}): MaterialIssueLineDraft => ({
  key: 'manual:1',
  origin: 'manual',
  bomComponentId: null,
  itemId: '7401',
  uomId: '7501',
  requiredQty: null,
  issuedQty: null,
  shortageQty: null,
  requestedQty: '5',
  ...patch,
});

describe('resolveBomComponentId', () => {
  it('ⓐ 손으로 더한 줄이라도 소요 목록에 같은 품목이 있으면 구성요소를 승계한다', () => {
    expect(resolveBomComponentId(7401, shortage)).toBe(7601);
  });

  it('ⓑ 소요 목록에 없는 품목이면 null 이다 — BOM 밖이다', () => {
    expect(resolveBomComponentId(7409, shortage)).toBeNull();
  });

  it('ⓒ 소요를 아직 부르지 않았으면 전부 null 이다 — 모르는 것을 「BOM 안」으로 단언하지 않는다', () => {
    expect(resolveBomComponentId(7401, [])).toBeNull();
  });

  it('소요 줄 자체가 BOM 밖이면(구성요소가 비면) null 이다', () => {
    expect(resolveBomComponentId(7403, shortage)).toBeNull();
  });
});

describe('resolveLineOrigins', () => {
  it('비어 있는 줄만 채운다', () => {
    const [resolved] = resolveLineOrigins([line()], shortage);

    expect(resolved?.bomComponentId).toBe(7601);
  });

  it('이미 값이 있는 줄은 건드리지 않는다 — 소요가 잠시 비어도 FK 가 날아가지 않는다', () => {
    const [resolved] = resolveLineOrigins([line({ bomComponentId: 7601 })], []);

    expect(resolved?.bomComponentId).toBe(7601);
  });

  it('품목을 고르지 않은 줄은 그대로 둔다', () => {
    const [resolved] = resolveLineOrigins([line({ itemId: '' })], shortage);

    expect(resolved?.bomComponentId).toBeNull();
  });
});

describe('isOutsideBom · countOutsideBomLines', () => {
  it('구성요소가 비면 BOM 밖이다', () => {
    expect(isOutsideBom(line())).toBe(true);
    expect(isOutsideBom(line({ bomComponentId: 7601 }))).toBe(false);
  });

  it('품목을 아직 고르지 않은 줄은 세지 않는다 — 거부당한 것으로 읽히면 안 된다', () => {
    expect(countOutsideBomLines([line({ itemId: '' })])).toBe(0);
  });

  it('BOM 밖 줄만 센다', () => {
    expect(
      countOutsideBomLines([
        line({ key: 'manual:1', bomComponentId: 7601 }),
        line({ key: 'manual:2', itemId: '7409' }),
        line({ key: 'manual:3', itemId: '7410' }),
      ]),
    ).toBe(2);
  });
});

describe('ⓓ 화면의 경고와 본문의 FK 가 같은 판정을 지난다', () => {
  const submittedAt = new Date(2026, 8, 1, 0, 12, 30);

  it('경고가 서지 않는 줄은 본문에 구성요소가 실린다', () => {
    const rows = resolveLineOrigins([line({ itemId: '7401' })], shortage);

    expect(countOutsideBomLines(rows)).toBe(0);

    const body = toMaterialIssueRequestBody(
      {
        workOrderId: '7101',
        destinationLocationId: '7301',
        requiredDate: '',
        requiredTime: '',
        reasonCode: '',
        remarks: '합성 비고',
        lines: rows,
        shortage,
      },
      submittedAt,
    );

    expect(body?.lines[0]?.bomComponentId).toBe(7601);
  });

  it('경고가 서는 줄은 본문에서도 구성요소 키가 빠진다', () => {
    const rows = resolveLineOrigins([line({ itemId: '7409' })], shortage);

    expect(countOutsideBomLines(rows)).toBe(1);

    const body = toMaterialIssueRequestBody(
      {
        workOrderId: '7101',
        destinationLocationId: '7301',
        requiredDate: '',
        requiredTime: '',
        reasonCode: '',
        remarks: '합성 비고',
        lines: rows,
        shortage,
      },
      submittedAt,
    );

    expect('bomComponentId' in (body?.lines[0] ?? {})).toBe(false);
  });
});
