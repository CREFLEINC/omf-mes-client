import { describe, expect, it } from 'vitest';

import { countResponse, countVarianceLineResponse } from './fixtures';
import { toCountOptionView, toCountVarianceLineView } from './types';

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
