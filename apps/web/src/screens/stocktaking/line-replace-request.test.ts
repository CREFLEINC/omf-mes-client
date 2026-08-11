import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { countLineFixtures, LOCATION_ID } from './fixtures';
import { EMPTY_LINE_DRAFTS, setDraftQty, setDraftReason, type LineDrafts } from './line-draft';
import {
  isLinesTruncated,
  LOCATION_LINE_PAGE_SIZE,
  replaceBlockReason,
  toBusinessDate,
  toLineReplace,
  toLineRows,
  toOccurredAt,
} from './line-replace-request';
import { toCountLineView } from './types';
import { CODE_MAX } from './validation';

const t = messages.stocktaking;

const REASON = 'SAMPLE_VARIANCE_REASON_D';

const lines = countLineFixtures.map(toCountLineView);

/** 세 줄 전부를 「장부와 같은 수량」으로 채운다 — **차이가 없는 위치**의 기본 상태다. */
const filledSame = (): LineDrafts =>
  lines.reduce(
    (drafts, line) => setDraftQty(drafts, line.inventoryCountLineId, String(line.systemQty)),
    EMPTY_LINE_DRAFTS,
  );

const rowsOf = (drafts: LineDrafts = EMPTY_LINE_DRAFTS) => toLineRows(lines, drafts);

const blockReasonOf = (
  drafts: LineDrafts = EMPTY_LINE_DRAFTS,
  overrides: { isTruncated?: boolean; isReasonListPending?: boolean } = {},
): string | null =>
  replaceBlockReason({
    rows: rowsOf(drafts),
    isTruncated: false,
    isReasonListPending: false,
    ...overrides,
  });

/** 자정 직전. 영업일이 **실행 시각의 날짜**에서 나온다는 것을 경계에서 잰다. */
const BEFORE_MIDNIGHT = new Date(2026, 7, 11, 23, 59, 59);
const AFTER_MIDNIGHT = new Date(2026, 7, 12, 0, 0, 1);

describe('LOCATION_LINE_PAGE_SIZE · isLinesTruncated — 전건을 받았는가', () => {
  /*
   * **이 값은 완화이고 보장이 아니다**(계획 결정 8). 계약의 `size`에는 `maximum`이 없어
   * 어떤 값도 근거가 없다 — 잘렸다는 사실을 밝히는 것은 아래의 판정이다.
   */
  it('한 위치의 라인을 한 번에 받으려는 쪽 크기를 싣는다', () => {
    expect(LOCATION_LINE_PAGE_SIZE).toBeGreaterThan(0);
  });

  /*
   * **감지기 M50 · 완료 조건 C34** — 잘림 판정이 한 곳이다. 서버가 말한 전체 건수가 받은
   * 건수보다 많으면 못 받은 줄이 있고, 그 줄은 치환에 실리지 않아 **미실사로 되돌아간다.**
   */
  it('전체 건수가 받은 건수보다 많으면 잘린 것이다', () => {
    expect(isLinesTruncated({ page: 1, size: 200, total: 4 }, 3)).toBe(true);
    expect(isLinesTruncated({ page: 1, size: 200, total: 3 }, 3)).toBe(false);
    /* 서버가 더 적게 말하는 경우도 잘린 것이 아니다 — 받은 것이 전부보다 많을 수는 없다. */
    expect(isLinesTruncated({ page: 1, size: 200, total: 2 }, 3)).toBe(false);
  });
});

describe('toLineRows — 표가 그리는 줄과 보낼 줄이 같은 재료에서 나온다', () => {
  it('표의 줄 차례와 개수가 응답 그대로다', () => {
    expect(rowsOf().map((row) => row.line.lineNo)).toEqual([1, 2, 3]);
  });

  /** 아무것도 치지 않은 위치는 **전 줄이 준비되지 않은** 상태다(전 줄 필수). */
  it('아무것도 치지 않으면 어느 줄도 준비되지 않는다', () => {
    expect(rowsOf().every((row) => !row.isReady)).toBe(true);
  });

  /*
   * **판정을 다시 만들지 않는다**(감지기 M36). 사유 필수는 `variance-rule.ts`가 정하고
   * 이 줄 뷰는 그 결과를 실어 나른다 — 9401만 장부(100)와 다른 값을 쳤다.
   */
  it('장부와 다르게 친 줄에만 사유 필수가 선다', () => {
    const drafts = setDraftQty(filledSame(), lines[0]?.inventoryCountLineId ?? 0, '98');

    expect(rowsOf(drafts).map((row) => row.isReasonRequired)).toEqual([true, false, false]);
  });

  /** 사유가 필수인데 고르지 않았으면 그 줄은 준비되지 않았다. */
  it('사유가 필수인 줄은 사유를 골라야 준비된다', () => {
    const lineId = lines[0]?.inventoryCountLineId ?? 0;
    const withVariance = setDraftQty(filledSame(), lineId, '98');

    expect(rowsOf(withVariance)[0]?.isReady).toBe(false);
    expect(rowsOf(setDraftReason(withVariance, lineId, REASON))[0]?.isReady).toBe(true);
  });

  /*
   * **차이가 없는 줄에는 사유를 요구하지 않는다** — 승인 G1이 「필수도로 갈라 적용한다」로
   * 정한 갈림이 여기다. 차이 없는 위치는 코드 목록이 비어 있어도 그대로 저장된다.
   */
  it('장부와 같게 친 줄은 사유 없이도 준비된다', () => {
    expect(rowsOf(filledSame()).every((row) => row.isReady)).toBe(true);
  });

  /*
   * **완료 조건 C41** — 친 값이 저장된 실물 수량과 다르면 차이 칸이 낡았다.
   * 9402는 저장값(40)을 그대로 쳤으므로 낡지 않았고, 9401은 저장값이 98인데 100을 쳤다.
   */
  it('저장된 실물 수량과 다르게 친 줄에만 낡음 표식이 선다', () => {
    expect(rowsOf(filledSame()).map((row) => row.isVarianceStale)).toEqual([true, false, true]);
  });

  it('사유가 50자를 넘으면 그 줄이 준비되지 않는다', () => {
    const lineId = lines[1]?.inventoryCountLineId ?? 0;
    const drafts = setDraftReason(filledSame(), lineId, 'A'.repeat(CODE_MAX + 1));

    expect(rowsOf(drafts)[1]?.isReady).toBe(false);
    expect(rowsOf(drafts)[1]?.reason).toEqual({
      kind: 'invalid',
      message: t.errors.codeTooLong(CODE_MAX),
    });
  });
});

describe('replaceBlockReason — 저장이 왜 막혔는가', () => {
  /*
   * **완료 조건 C34 · 감지기 M31** — 잘림은 **경고가 아니라 차단**이다. 좁혀 보낸 목록으로
   * 치환하면 못 받은 줄이 미실사로 되돌아가므로, 다른 어떤 사정보다 앞에 선다.
   */
  it('잘렸으면 전 줄을 채웠어도 막는다', () => {
    expect(blockReasonOf(filledSame(), { isTruncated: true })).toBe(t.actionReasons.saveTruncated);
  });

  /*
   * **감지기 M37** — 빈 배열을 보내면 그 위치가 통째로 미실사로 되돌아가고 목 서버는 그것을
   * 200으로 받는다(실측). 막는 곳이 화면뿐이다.
   */
  it('보낼 줄이 하나도 없으면 막는다', () => {
    expect(
      replaceBlockReason({ rows: [], isTruncated: false, isReasonListPending: false }),
    ).toBe(t.actionReasons.saveNoLines);
  });

  /*
   * **완료 조건 C36 · 감지기 M38** — 「이 위치 실사 완료」의 뜻이 전 줄이라는 사실이
   * **남은 줄 수**로 읽혀야 한다.
   */
  it('실물 수량을 넣지 않은 줄 수를 사유가 말한다', () => {
    expect(blockReasonOf()).toBe(t.actionReasons.saveIncompleteQty(3));

    const oneFilled = setDraftQty(EMPTY_LINE_DRAFTS, lines[0]?.inventoryCountLineId ?? 0, '100');

    expect(blockReasonOf(oneFilled)).toBe(t.actionReasons.saveIncompleteQty(2));
  });

  it('형식이 잘못된 줄 수를 사유가 말한다', () => {
    const drafts = setDraftQty(filledSame(), lines[2]?.inventoryCountLineId ?? 0, '-1');

    expect(blockReasonOf(drafts)).toBe(t.actionReasons.saveInvalidQty(1));
  });

  /*
   * **완료 조건 C38 · 승인 G1** — 차이가 있는 줄이 **하나라도** 있는 위치만 잠긴다.
   * 문구가 「차이가 없는 위치는 지금도 저장할 수 있습니다」를 밝히는 이유가 그 갈림이다.
   */
  it('차이가 있는데 사유 목록이 비어 있으면 막는다', () => {
    const drafts = setDraftQty(filledSame(), lines[0]?.inventoryCountLineId ?? 0, '98');

    expect(blockReasonOf(drafts, { isReasonListPending: true })).toBe(
      t.actionReasons.saveReasonListPending,
    );
  });

  /** **차이가 없으면 목록이 비어 있어도 열린다** — 잠기는 범위가 필수도에 맞춰 좁혀진다. */
  it('차이가 없으면 사유 목록이 비어 있어도 막지 않는다', () => {
    expect(blockReasonOf(filledSame(), { isReasonListPending: true })).toBeNull();
  });

  it('사유가 필수인데 고르지 않은 줄 수를 사유가 말한다', () => {
    const drafts = setDraftQty(filledSame(), lines[0]?.inventoryCountLineId ?? 0, '98');

    expect(blockReasonOf(drafts)).toBe(t.actionReasons.saveNeedsReason(1));
  });

  it('사유가 50자를 넘으면 막는다', () => {
    const drafts = setDraftReason(
      filledSame(),
      lines[1]?.inventoryCountLineId ?? 0,
      'A'.repeat(CODE_MAX + 1),
    );

    expect(blockReasonOf(drafts)).toBe(t.actionReasons.saveInvalidReason);
  });

  it('전 줄이 준비되면 막지 않는다', () => {
    expect(blockReasonOf(filledSame())).toBeNull();
  });
});

describe('toLineReplace — 치환 본문', () => {
  const bodyOf = (drafts: LineDrafts, now = BEFORE_MIDNIGHT) =>
    toLineReplace({ locationId: LOCATION_ID, rows: rowsOf(drafts), now });

  /*
   * **완료 조건 C44** — 본문이 넷이고 `lines`가 **표에 있는 전 줄**이다.
   * 좁히는 조건을 만들지 않았으므로 표의 줄이 곧 그 위치의 전 줄이다.
   */
  it('본문이 위치·영업일·발생 시각·전 줄이다', () => {
    const body = bodyOf(filledSame());

    expect(Object.keys(body ?? {}).sort()).toEqual([
      'businessDate',
      'lines',
      'locationId',
      'occurredAt',
    ]);
    expect(body?.locationId).toBe(LOCATION_ID);
    expect(body?.lines).toHaveLength(lines.length);
  });

  /*
   * **완료 조건 C45** — 각 줄이 일곱 값을 싣고 그 값이 **표의 줄에서 온다.**
   * `inventoryCountLineId`를 싣는 것이 「기존 줄을 고친다」의 뜻이다(없으면 신규 행이 된다).
   */
  it('각 줄이 표의 값을 그대로 싣는다', () => {
    const body = bodyOf(filledSame());
    const first = body?.lines[0];
    const source = lines[0];

    expect(first).toEqual({
      inventoryCountLineId: source?.inventoryCountLineId,
      locationId: source?.locationId,
      itemId: source?.itemId,
      lotId: source?.lotId,
      countedQty: source?.systemQty,
      uomId: source?.uomId,
      countedAt: toOccurredAt(BEFORE_MIDNIGHT),
    });
  });

  /** `lotId`가 `null`인 줄은 **빈 값 그대로** 싣는다 — 참조 실패가 아니다. */
  it('자재 LOT이 없는 줄은 null을 그대로 싣는다', () => {
    expect(bodyOf(filledSame())?.lines[1]?.lotId).toBeNull();
  });

  /** 고르지 않은 사유는 **키 자체를 싣지 않는다** — 빈 문자열은 「빈 값을 넣었다」로 남는다. */
  it('사유를 고르지 않은 줄에는 사유 키가 없다', () => {
    expect(bodyOf(filledSame())?.lines[1]).not.toHaveProperty('varianceReasonCode');
  });

  it('고른 사유는 다듬어 싣는다', () => {
    const drafts = setDraftReason(filledSame(), lines[1]?.inventoryCountLineId ?? 0, ` ${REASON} `);

    expect(bodyOf(drafts)?.lines[1]?.varianceReasonCode).toBe(REASON);
  });

  /*
   * **감지기 M38 — 전 줄 필수의 마지막 겹.** 버튼 사유가 뚫려도 본문을 만들 수 없어야
   * **친 줄만 나가는** 파괴 경로가 코드에 남지 않는다.
   */
  it('한 줄이라도 준비되지 않으면 본문을 만들지 않는다', () => {
    const oneFilled = setDraftQty(EMPTY_LINE_DRAFTS, lines[0]?.inventoryCountLineId ?? 0, '100');

    expect(bodyOf(oneFilled)).toBeNull();
  });

  /** **감지기 M37** — 줄이 없으면 본문도 없다. 빈 배열은 그 위치를 통째로 미실사로 되돌린다. */
  it('줄이 하나도 없으면 본문을 만들지 않는다', () => {
    expect(toLineReplace({ locationId: LOCATION_ID, rows: [], now: BEFORE_MIDNIGHT })).toBeNull();
  });

  /*
   * **감지기 M46** — 초안 키를 그대로 실으면 **표에서 사라진 줄**이 요청에 나간다.
   * 줄 집합이 바뀌어 없어진 줄의 초안은 여기서 교차로 걸러진다(수명 표 10행의 짝).
   */
  it('표에 없는 줄의 초안은 싣지 않는다', () => {
    const withGhost = setDraftQty(filledSame(), 9499, '999');
    const body = toLineReplace({
      locationId: LOCATION_ID,
      rows: toLineRows(lines, withGhost),
      now: BEFORE_MIDNIGHT,
    });

    expect(body?.lines).toHaveLength(lines.length);
    expect(body?.lines.map((line) => line.countedQty)).not.toContain(999);
  });
});

describe('toBusinessDate · toOccurredAt — 시각을 인자로 받는다', () => {
  /*
   * **영업일 산출 규칙이 어디에도 정의돼 있지 않다**(계획 §6.4). 실행 시각의 날짜로 파생하고
   * 그 근거를 남긴다 — 별도 입력칸을 두는 대안은 **사용자가 무엇을 넣어야 하는지 화면이
   * 설명할 수 없어** 택하지 않았다.
   */
  it('영업일이 실행 시각의 날짜다', () => {
    expect(toBusinessDate(BEFORE_MIDNIGHT)).toBe('2026-08-11');
    expect(toBusinessDate(AFTER_MIDNIGHT)).toBe('2026-08-12');
  });

  it('발생 시각이 초와 offset을 갖춘다', () => {
    expect(toOccurredAt(BEFORE_MIDNIGHT)).toMatch(
      /^2026-08-11T23:59:59[+-]\d{2}:\d{2}$/,
    );
  });

  /** UTC로 옮기지 않는다 — `toISOString`을 쓰면 자정 경계에서 날짜가 하루 어긋난다. */
  it('발생 시각의 날짜가 영업일과 같다', () => {
    expect(toOccurredAt(AFTER_MIDNIGHT).slice(0, 10)).toBe(toBusinessDate(AFTER_MIDNIGHT));
  });
});
