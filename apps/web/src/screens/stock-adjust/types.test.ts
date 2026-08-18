import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  adjustmentDetailBody,
  countResponse,
  countVarianceLineResponse,
  postedAdjustmentBody,
} from './fixtures';
import {
  emptyHeaderDraft,
  formatDateTime,
  isHeaderEdited,
  readableName,
  toCountOptionView,
  toCountVarianceLineView,
  toCreatedAdjustmentResult,
  toCreatedAdjustmentView,
  toPostedAdjustmentView,
} from './types';

/**
 * 응답을 화면 타입으로 옮기는 **유일한 지점**들.
 *
 * **화면이 쓰는 값만 옮긴다.** 자리를 두지 않은 값은 화면으로 샐 경로도 없다(`omf-mes#44`).
 */

describe('toCountOptionView', () => {
  it('선택칸이 쓰는 값만 옮긴다', () => {
    expect(toCountOptionView(countResponse())).toEqual({
      inventoryCountId: 9101,
      inventoryCountNo: 'SAMPLE-IC-9101',
      warehouseId: 9201,
      plannedDate: '2026-08-17',
    });
  });

  /**
   * **창고를 함께 옮기는 것이 요점이다.** 실사를 고르면 그 창고가 위치 이름 풀이의 축이 된다 —
   * 계약이 위치 조회에 창고를 필수로 요구하기 때문이다.
   */
  it('실사가 정한 창고를 옮긴다', () => {
    expect(toCountOptionView(countResponse({ warehouseId: 9202 })).warehouseId).toBe(9202);
  });

  /**
   * **상태 코드를 옮기지 않는다.** 이 화면은 실사 상태로 분기하지 않고(공유계약 G-2)
   * 선택칸에 그리지도 않는다 — 자리를 두면 값으로 거르고 싶어지는 자리가 생긴다.
   */
  it('상태 코드를 담지 않는다', () => {
    expect(toCountOptionView(countResponse())).not.toHaveProperty('statusCode');
  });
});

describe('toCountVarianceLineView', () => {
  it('세 열의 값이 전부 계약에서 온다', () => {
    const view = toCountVarianceLineView(
      countVarianceLineResponse({ systemQty: 100, countedQty: 98, varianceQty: -2 }),
    );

    expect(view.systemQty).toBe(100);
    expect(view.varianceQty).toBe(-2);
  });

  /**
   * **실물을 옮기지 않는다**(D-5). 실물은 「장부 + 차이」로 파생하는 값이라, 응답 값을 따로
   * 들고 있으면 사용자가 차이를 고친 뒤 두 값이 갈린다 — 그때 어느 쪽이 참인지 화면이 알 수 없다.
   */
  it('실물 수량을 담지 않는다 — 파생으로만 낸다', () => {
    expect(toCountVarianceLineView(countVarianceLineResponse())).not.toHaveProperty('countedQty');
  });

  it('LOT이 없는 줄은 비운 채로 옮긴다', () => {
    expect(toCountVarianceLineView(countVarianceLineResponse({ lotId: null })).lotId).toBeNull();
  });

  it('실사에서 적은 사유를 옮긴다 — 읽기 전용 표기의 원천이다', () => {
    expect(
      toCountVarianceLineView(countVarianceLineResponse({ varianceReasonCode: 'SAMPLE_VR_A' }))
        .varianceReasonCode,
    ).toBe('SAMPLE_VR_A');
  });

  it('사유가 없으면 비운 채로 옮긴다', () => {
    expect(
      toCountVarianceLineView(countVarianceLineResponse({ varianceReasonCode: null }))
        .varianceReasonCode,
    ).toBeNull();
  });

  /**
   * ⭐ **블라인드 실사는 장부를 내려보내지 않는다**(계약 설명 · 생성 타입은 필수라 타입 검사가
   * 잡지 못한다).
   *
   * 그대로 믿으면 장부 칸에 `undefined`가, 실물 칸에 `NaN`이 선다 — 이 슬라이스가 다른 자리마다
   * 「수를 지어내지 않는다」로 막아 둔 바로 그 사고다. **값의 유무를 이 옮김 지점에서 한 번에
   * 가른다.**
   */
  it('장부가 없이 오면 비운 채로 옮긴다 — 값을 지어내지 않는다', () => {
    const blind = countVarianceLineResponse();

    /* 계약 설명대로 값을 내려보내지 않은 응답. 생성 타입이 필수라 지우는 것으로 만든다. */
    delete (blind as { systemQty?: number }).systemQty;

    expect(toCountVarianceLineView(blind).systemQty).toBeNull();
  });

  /** 짝 방향 — 값이 오면 그대로 옮긴다. 「늘 비운다」로 통과하지 않게 한다. */
  it('장부가 오면 그 값을 옮긴다', () => {
    expect(toCountVarianceLineView(countVarianceLineResponse({ systemQty: 100 })).systemQty).toBe(
      100,
    );
  });
});

/**
 * 조정 머리의 초안 — **계약이 등록에서 받는 두 값**이다.
 */
describe('emptyHeaderDraft · isHeaderEdited', () => {
  /** **기본값이 켬이다**(D-11) — 계약 기본값과 같다. 화면이 따로 정하면 두 곳이 갈린다. */
  it('ERP 송신은 켠 채로 시작한다', () => {
    expect(emptyHeaderDraft()).toEqual({ reasonCode: '', sendToErp: true });
  });

  it('아무것도 고르지 않았으면 버릴 것이 없다', () => {
    expect(isHeaderEdited(emptyHeaderDraft())).toBe(false);
  });

  it('사유를 고르면 버릴 것이 생긴다', () => {
    expect(isHeaderEdited({ reasonCode: 'SAMPLE_AR_A', sendToErp: true })).toBe(true);
  });

  /** ERP 송신을 끈 것도 사용자가 정한 값이다 — 되돌리면 잃는 것이 있다. */
  it('ERP 송신을 끄면 버릴 것이 생긴다', () => {
    expect(isHeaderEdited({ reasonCode: '', sendToErp: false })).toBe(true);
  });
});

/**
 * 등록 201을 화면 타입으로 옮기는 **유일한 지점**.
 *
 * **내부 번호를 옮기지 않는다**(`omf-mes#44`) — 자리를 두지 않으면 화면으로 샐 경로도 없다.
 */
describe('toCreatedAdjustmentView', () => {
  it('전표번호와 등록 시점의 상태를 옮긴다', () => {
    const view = toCreatedAdjustmentView(adjustmentDetailBody());

    expect(view.inventoryAdjustmentNo).toBe('SAMPLE-IA-9301');
    expect(view.statusCode).toBe('SAMPLE_IA_STATUS_A');
  });

  /** **서버가 저장한 줄을 센다** — 화면이 보낸 줄 수가 아니라 응답 배열의 길이다. */
  it('서버가 되돌려 준 줄 수를 센다', () => {
    expect(toCreatedAdjustmentView(adjustmentDetailBody({ lineCount: 3 })).lineCount).toBe(3);
  });

  it('내부 번호를 담지 않는다', () => {
    const view = toCreatedAdjustmentView(adjustmentDetailBody());

    /* 짝 양성 — 업무 번호는 실제로 옮겨진다. 「아무것도 안 옮긴다」로 통과하지 않게 한다. */
    expect(view.inventoryAdjustmentNo).toBe('SAMPLE-IA-9301');
    expect(view).not.toHaveProperty('inventoryAdjustmentId');
  });

  /**
   * ⭐ **ERP 적재 여부는 세 갈래다**(C23). 계약이 선택으로 두어 오지 않는 갈래가 실재하고,
   * `?? false`로 접으면 아무 근거 없이 「적재되지 않았다」로 읽힌다.
   */
  it.each([
    [true, true],
    [false, false],
  ])('ERP 적재 여부 %o를 그대로 옮긴다', (queued, expected) => {
    expect(
      toCreatedAdjustmentView(adjustmentDetailBody({ erpMessageQueued: queued })).erpMessageQueued,
    ).toBe(expected);
  });

  it('ERP 적재 여부가 오지 않으면 비운 채로 옮긴다 — 거짓으로 접지 않는다', () => {
    expect(
      toCreatedAdjustmentView(adjustmentDetailBody({ erpMessageQueued: null })).erpMessageQueued,
    ).toBeNull();
  });
});

/**
 * 등록 응답 하나가 낳는 **두 값**(T2 인계 ①).
 *
 * 상신이 필요로 하는 것은 **내부 번호**이고 결과 구획이 필요로 하는 것은 **표시 타입**이다.
 * 한 타입에 뭉개면 내부 번호가 그리는 자리까지 따라간다(`omf-mes#44`).
 */
describe('toCreatedAdjustmentResult', () => {
  it('내부 번호와 표시 타입을 갈라 낸다', () => {
    const result = toCreatedAdjustmentResult(adjustmentDetailBody());

    expect(result.inventoryAdjustmentId).toBe(9301);
    expect(result.created.inventoryAdjustmentNo).toBe('SAMPLE-IA-9301');
  });

  /** 갈라 두는 것이 요점이다 — 표시 타입 쪽에는 그 번호가 없다. */
  it('표시 타입에는 내부 번호가 없다', () => {
    const result = toCreatedAdjustmentResult(adjustmentDetailBody());

    expect(result.created).not.toHaveProperty('inventoryAdjustmentId');
  });

  /**
   * ⛔ **목이 채워 주는 값을 옮기지 않는다**(계획 §5.2.5 실측).
   *
   * 목은 등록 응답에 승인 요청 번호와 전기 시각을 채워 준다 — 그것을 옮겨 「상신됨」·「전기됨」을
   * 그리면 **화면이 확인하지 않은 사실**을 말하게 된다. 상신 여부는 이 화면이 받은 **202**가
   * 정한다.
   */
  it('응답에 승인 요청 번호가 실려 와도 옮기지 않는다', () => {
    const result = toCreatedAdjustmentResult(
      adjustmentDetailBody({ approvalRequestId: 9801, adjustedAt: '2026-08-18T09:12:00+09:00' }),
    );

    /* 짝 양성 — 옮길 것은 실제로 옮긴다. 「아무것도 안 옮긴다」로 통과하지 않게 한다. */
    expect(result.inventoryAdjustmentId).toBe(9301);
    expect(result.created).not.toHaveProperty('approvalRequestId');
    expect(result.created).not.toHaveProperty('adjustedAt');
  });
});

/**
 * 전기 200을 화면 타입으로 옮기는 **유일한 지점**.
 *
 * **모양이 등록·상세와 다르다** — 전기 응답은 머리뿐이고 라인이 없다(계약 실측).
 */
describe('toPostedAdjustmentView', () => {
  it('전기 시각과 상태 코드를 그대로 옮긴다', () => {
    expect(toPostedAdjustmentView(postedAdjustmentBody())).toEqual({
      adjustedAt: '2026-08-18T14:05:00+09:00',
      statusCode: 'SAMPLE_IA_STATUS_B',
    });
  });

  /**
   * ⭐ **없이 오는 길이 실재한다**(계약이 `adjustedAt`을 nullable로 두었다).
   *
   * 값의 유무를 여기서 한 번에 갈라 둔다 — 자리마다 따로 접으면 어디서는 빈 글자가,
   * 어디서는 `undefined`가 그려진다.
   */
  it('전기 시각이 실려 오지 않으면 값의 없음으로 옮긴다', () => {
    expect(
      toPostedAdjustmentView(postedAdjustmentBody({ adjustedAt: null })).adjustedAt,
    ).toBeNull();
  });

  /**
   * ⛔ **전표번호를 옮기지 않는다.** 화면이 보이는 번호는 **매임이 든 것**이라야 한다 —
   * 응답이 준 번호를 그리면 매임이 끊긴 전기의 번호가 지금 보고 있는 전표 자리에 선다.
   *
   * ⛔ **승인 요청 번호도 옮기지 않는다** — 목이 채워 준다(계획 §5.2.5).
   */
  it('전표번호와 승인 요청 번호를 옮기지 않는다', () => {
    const posted = toPostedAdjustmentView(
      postedAdjustmentBody({ inventoryAdjustmentNo: 'SAMPLE-IA-9999', approvalRequestId: 9801 }),
    );

    /* 짝 양성 — 옮길 것은 실제로 옮긴다. */
    expect(posted.statusCode).toBe('SAMPLE_IA_STATUS_B');
    expect(posted).not.toHaveProperty('inventoryAdjustmentNo');
    expect(posted).not.toHaveProperty('approvalRequestId');
  });
});

/**
 * 이름 자리가 **전부 이 판정 하나를 지난다.**
 *
 * 상신자·승인자 이름은 계약이 필수로 두었으나 **빈 문자열도 공백만인 값도 스키마를 통과한다.**
 * 그때 화면은 번호를 대신 내지 않고 그 사실을 적는다(`omf-mes#44`).
 */
describe('readableName', () => {
  it('이름이 있으면 그대로 낸다', () => {
    expect(readableName('합성 상신자 가', messages.stockAdjust.values.unknown)).toBe(
      '합성 상신자 가',
    );
  });

  it.each(['', '   '])('이름이 %j이면 그 사실을 적는다 — 번호를 대신 내지 않는다', (raw) => {
    expect(readableName(raw, messages.stockAdjust.values.unknown)).toBe(
      messages.stockAdjust.values.unknown,
    );
  });

  /** 이름 안의 공백은 건드리지 않는다 — 판정에만 다듬기를 쓴다. */
  it('이름 가운데 공백을 줄이지 않는다', () => {
    expect(readableName('합성  상신자', messages.stockAdjust.values.unknown)).toBe('합성  상신자');
  });
});

/**
 * 계약의 date-time을 표기용으로 옮긴다.
 *
 * **실행 환경 시간대로 옮기지 않는다** — 문자열에 실려 온 offset이 그 일이 일어난 곳의 시각이고,
 * 보는 사람의 시간대로 옮기면 같은 요청이 사람마다 다른 시각으로 보인다.
 */
describe('formatDateTime', () => {
  it('날짜와 분까지만 낸다', () => {
    expect(formatDateTime('2026-08-18T14:35:00+09:00')).toBe('2026-08-18 14:35');
  });

  /** 시간대를 옮기지 않는다 — 실려 온 시각 그대로다. */
  it('다른 offset이 와도 시각을 옮기지 않는다', () => {
    expect(formatDateTime('2026-08-18T14:35:00Z')).toBe('2026-08-18 14:35');
  });

  /** **형식이 아니면 원문을 그대로 낸다** — 「—」로 바꾸면 없는 것과 못 알아본 것이 같아진다. */
  it('알아보지 못하는 값은 원문 그대로 낸다', () => {
    expect(formatDateTime('알 수 없는 값')).toBe('알 수 없는 값');
  });
});
