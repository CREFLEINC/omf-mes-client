import { describe, expect, it } from 'vitest';

import { MATERIAL_INPUT_PATH, PRODUCTION_RESULT_PATH, toWorkOrderHref } from './destinations';

describe('이탈 주소', () => {
  it('고른 W/O 를 주소에 싣는다', () => {
    expect(toWorkOrderHref(MATERIAL_INPUT_PATH, 8001)).toBe('/pop/material-input?workOrderId=8001');
    expect(toWorkOrderHref(PRODUCTION_RESULT_PATH, 8001)).toBe(
      '/pop/production-result?workOrderId=8001',
    );
  });

  it('긴급 여부를 주소에 싣지 않는다 — 유형은 W/O 가 갖는다', () => {
    expect(toWorkOrderHref(MATERIAL_INPUT_PATH, 1)).not.toContain('EMERGENCY');
  });
});
