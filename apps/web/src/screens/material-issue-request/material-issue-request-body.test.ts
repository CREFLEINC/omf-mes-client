import { describe, expect, it } from 'vitest';

import {
  stampSubmission,
  toBusinessDate,
  toMaterialIssueRequestBody,
  toOccurredAt,
  toRequiredAt,
  type MaterialIssueRequestInput,
} from './material-issue-request-body';
import type { MaterialIssueLineDraft, ShortageLineView } from './types';

/**
 * 집중 갈래 — **되돌릴 수 없는 쓰기의 본문**을 만드는 자리다.
 *
 * 여기서 틀리면 화면은 정상으로 보이고 전표에만 틀린 값이 실린다. D-1(요청 수량 0 줄 제외) ·
 * D-2(영업일·발생 시각 산출) · D-5(제출 순간 고정)를 이 파일이 지킨다.
 *
 * ⚠ **시간대를 단언하지 않는다.** 검사기가 도는 기기의 시간대가 정해져 있지 않아 `+09:00` 을
 * 못 박으면 다른 시간대에서 거짓으로 붉어진다. 대신 **형태**(초·offset 존재)와 **관계**(영업일이
 * 필요 시각의 날짜가 아니라 제출 순간의 날짜다)를 본다 — 실제 결함은 그 관계에서 난다.
 */

const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

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
    itemId: 7402,
    bomComponentId: 7602,
    uomId: 7501,
    requiredQty: 50,
    issuedQty: 50,
    shortageQty: 0,
  },
];

const line = (patch: Partial<MaterialIssueLineDraft>): MaterialIssueLineDraft => ({
  key: 'shortage:1',
  origin: 'shortage',
  bomComponentId: null,
  itemId: '7401',
  uomId: '7501',
  requiredQty: null,
  issuedQty: null,
  shortageQty: null,
  requestedQty: '80',
  ...patch,
});

const input = (patch: Partial<MaterialIssueRequestInput> = {}): MaterialIssueRequestInput => ({
  workOrderId: '7101',
  destinationLocationId: '7301',
  requiredDate: '',
  requiredTime: '',
  reasonCode: '',
  remarks: '합성 비고',
  lines: [line({})],
  shortage,
  ...patch,
});

/** 2026-09-01 00:12:30 — **로컬 시각으로** 만든다. 자정 직후라 영업일이 어긋나면 바로 드러난다. */
const submittedAt = new Date(2026, 8, 1, 0, 12, 30);

describe('toMaterialIssueRequestBody — 요청 수량 0 줄의 자동 제외 (D-1)', () => {
  it('0·빈칸·못 읽는 값인 줄을 빼고 남은 줄만 싣는다', () => {
    const body = toMaterialIssueRequestBody(
      input({
        lines: [
          line({ key: 'shortage:1', itemId: '7401', requestedQty: '0' }),
          line({ key: 'shortage:2', itemId: '7402', requestedQty: '' }),
          line({ key: 'manual:3', origin: 'manual', itemId: '7403', requestedQty: '12x' }),
          line({ key: 'shortage:4', itemId: '7404', uomId: '7502', requestedQty: '80' }),
        ],
      }),
      submittedAt,
    );

    expect(body).not.toBeNull();
    expect(body?.lines).toEqual([{ itemId: 7404, requestedQty: 80, uomId: 7502 }]);
  });

  it('보낼 줄이 하나도 남지 않으면 본문을 만들지 않는다 — 마지막 겹', () => {
    expect(
      toMaterialIssueRequestBody(input({ lines: [line({ requestedQty: '0' })] }), submittedAt),
    ).toBeNull();
  });

  it('품목·단위를 번호로 읽지 못하는 줄은 뺀다 — 0번 품목이 전표에 실리지 않는다', () => {
    const body = toMaterialIssueRequestBody(
      input({
        lines: [
          line({ key: 'manual:1', origin: 'manual', itemId: '', uomId: '', requestedQty: '5' }),
          line({ key: 'shortage:2', itemId: '7401', requestedQty: '80' }),
        ],
      }),
      submittedAt,
    );

    expect(body?.lines).toHaveLength(1);
    expect(body?.lines[0]?.itemId).toBe(7401);
  });
});

describe('toMaterialIssueRequestBody — 영업일·발생 시각 (D-2)', () => {
  it('영업일은 **제출 순간**의 날짜다 — 필요 시각의 날짜가 아니다', () => {
    const body = toMaterialIssueRequestBody(
      input({ requiredDate: '2026-09-04', requiredTime: '14:00' }),
      submittedAt,
    );

    expect(body?.businessDate).toBe('2026-09-01');
    expect(body?.requiredAt?.startsWith('2026-09-04T14:00:00')).toBe(true);
  });

  it('발생 시각은 초와 offset 을 갖춘 제출 순간이다', () => {
    const body = toMaterialIssueRequestBody(input(), submittedAt);

    expect(body?.occurredAt).toMatch(OFFSET_DATE_TIME);
    expect(body?.occurredAt?.startsWith('2026-09-01T00:12:30')).toBe(true);
  });

  it('필요 시각도 같은 offset 을 단다 — 같은 글자가 지역마다 다른 순간을 가리키지 않게 한다', () => {
    const body = toMaterialIssueRequestBody(
      input({ requiredDate: '2026-09-04', requiredTime: '14:00' }),
      submittedAt,
    );

    expect(body?.requiredAt).toMatch(OFFSET_DATE_TIME);
    expect(body?.requiredAt?.slice(-6)).toBe(body?.occurredAt?.slice(-6));
  });

  it('toBusinessDate·toOccurredAt 는 같은 순간을 본다', () => {
    expect(toOccurredAt(submittedAt).startsWith(`${toBusinessDate(submittedAt)}T`)).toBe(true);
  });
});

describe('toRequiredAt — 반쪽 입력은 값을 만들지 않는다', () => {
  it('날짜가 비면 null 이다', () => {
    expect(toRequiredAt('', '14:00', submittedAt)).toBeNull();
  });

  it('시각이 비면 null 이다 — 시각을 지어내지 않는다', () => {
    expect(toRequiredAt('2026-09-04', '', submittedAt)).toBeNull();
  });
});

describe('toMaterialIssueRequestBody — 비운 칸은 키 자체를 싣지 않는다', () => {
  it('사유·비고·필요 시각이 비면 그 키가 본문에 없다', () => {
    const body = toMaterialIssueRequestBody(input({ remarks: '' }), submittedAt);

    expect(body).not.toBeNull();
    expect('reasonCode' in (body ?? {})).toBe(false);
    expect('remarks' in (body ?? {})).toBe(false);
    expect('requiredAt' in (body ?? {})).toBe(false);
  });

  it('사유·비고를 적으면 다듬은 값이 실린다', () => {
    const body = toMaterialIssueRequestBody(
      input({ reasonCode: 'SAMPLE_MIR_R_A', remarks: '  합성 비고  ' }),
      submittedAt,
    );

    expect(body?.reasonCode).toBe('SAMPLE_MIR_R_A');
    expect(body?.remarks).toBe('합성 비고');
  });

  it('W/O·도착 위치를 정하지 않으면 본문을 만들지 않는다', () => {
    expect(toMaterialIssueRequestBody(input({ workOrderId: '' }), submittedAt)).toBeNull();
    expect(
      toMaterialIssueRequestBody(input({ destinationLocationId: '' }), submittedAt),
    ).toBeNull();
  });

  it('줄번호·기출고 수량을 싣지 않는다 — 서버가 정하는 값이다', () => {
    const body = toMaterialIssueRequestBody(input(), submittedAt);
    const first = body?.lines[0] ?? {};

    expect('lineNo' in first).toBe(false);
    expect('issuedQty' in first).toBe(false);
  });
});

describe('toMaterialIssueRequestBody — BOM 유래 FK (D-3 의 본문 쪽)', () => {
  it('소요 목록에 있는 품목은 구성요소 번호를 승계한다', () => {
    const body = toMaterialIssueRequestBody(input(), submittedAt);

    expect(body?.lines[0]?.bomComponentId).toBe(7601);
  });

  it('소요 목록에 없는 품목은 **키 자체를 싣지 않는다**', () => {
    const body = toMaterialIssueRequestBody(
      input({ lines: [line({ key: 'manual:9', origin: 'manual', itemId: '7409' })] }),
      submittedAt,
    );

    expect('bomComponentId' in (body?.lines[0] ?? {})).toBe(false);
  });
});

describe('stampSubmission — 제출 순간을 초안에 매어 둔다 (D-5)', () => {
  it('값이 그대로면 앞서 찍은 순간을 그대로 쓴다 — 재시도가 같은 본문을 낸다', () => {
    const draft = input();
    const first = stampSubmission(null, draft, submittedAt);
    const retried = stampSubmission(first, draft, new Date(2026, 8, 1, 0, 13, 45));

    expect(retried.at).toBe(first.at);
    expect(toMaterialIssueRequestBody(draft, retried.at)).toEqual(
      toMaterialIssueRequestBody(draft, first.at),
    );
  });

  /**
   * ⭐ **줄 키는 본문에 실리지 않는다** — 그러니 지문에도 들지 않아야 한다(리뷰 M-2 의 여파).
   *
   * 초안이 다시 세워지면 줄 키가 새로 발급된다. 그때마다 지문이 갈리면 **보낼 값이 하나도 달라지지
   * 않았는데 새 멱등 키**가 나가고, 서버가 중복을 막지 않으므로 전표가 둘 쌓인다.
   */
  it('줄 키만 새로 발급돼도 같은 도장을 쓴다 — 보낼 값이 그대로다', () => {
    const first = stampSubmission(null, input(), submittedAt);
    const reseated = stampSubmission(
      first,
      input({ lines: [line({ key: 'shortage:99' })] }),
      new Date(2026, 8, 1, 0, 13, 45),
    );

    expect(reseated.at).toBe(first.at);
  });

  it('표시 전용 값이 달라져도 같은 도장을 쓴다 — 소요·기출고·부족은 나가지 않는다', () => {
    const first = stampSubmission(null, input(), submittedAt);
    const redisplayed = stampSubmission(
      first,
      input({ lines: [line({ requiredQty: 999, issuedQty: 111, shortageQty: 5 })] }),
      new Date(2026, 8, 1, 0, 13, 45),
    );

    expect(redisplayed.at).toBe(first.at);
  });

  it('보낼 값이 달라지면 새로 찍는다 — 다른 쓰기다', () => {
    const first = stampSubmission(null, input(), submittedAt);
    const later = new Date(2026, 8, 1, 0, 13, 45);
    const next = stampSubmission(first, input({ lines: [line({ requestedQty: '50' })] }), later);

    expect(next.at).toBe(later);
  });
});
