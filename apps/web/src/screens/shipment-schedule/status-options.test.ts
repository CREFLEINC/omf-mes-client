import { describe, expect, it } from 'vitest';

import { messages } from '@omf-mes/i18n';

import { progressLabel, SHIPMENT_PROGRESS_CODES } from './status-options';

describe('SHIPMENT_PROGRESS_CODES', () => {
  it('고정 계약의 6개 진행 상태를 순서와 손실 없이 담는다', () => {
    expect(SHIPMENT_PROGRESS_CODES).toEqual([
      'NOT_ALLOCATED',
      'PARTIALLY_ALLOCATED',
      'PICKING',
      'PICKED',
      'PARTIALLY_SHIPPED',
      'SHIPPED',
    ]);
  });
});

describe('progressLabel', () => {
  it('계약이 정한 6개 코드를 표시명으로 옮긴다', () => {
    for (const code of SHIPMENT_PROGRESS_CODES) {
      expect(progressLabel(code)).toBe(messages.shipmentSchedule.progressCodes[code]);
    }
  });

  /*
   * ⛔ 모르는 값을 빈 문자열로 만들지 않는다 — 계약에 값이 늘면 「진행 상태가 비었다」로
   * 잘못 보고된다. 코드를 그대로 남겨 담당자에게 전할 단서를 둔다(공유계약 G-9).
   */
  it('표시명을 모르는 코드는 코드를 그대로 돌려준다', () => {
    expect(progressLabel('SAMPLE_FUTURE_CODE')).toBe('SAMPLE_FUTURE_CODE');
  });
});
