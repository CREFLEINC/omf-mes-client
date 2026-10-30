import { describe, expect, it } from 'vitest';

import { HANDOVER_ALERT_ORDER } from '../../patterns/handover-alert-types';
import { HANDOVER_TEMPLATE_PARAMS, TEMPLATE_PARAMS, handoverParamsOf } from './template-params';

/**
 * 고객사에 전달한 영문 템플릿 10종의 파라미터 이름 — `specs/002-terminal-task-alerts/zalo-templates.md`
 * 표의 「파라미터」 칸을 그대로 옮겼다. 고객사는 이 이름으로 템플릿을 등록한다.
 */
const ZALO_TEMPLATES_MD: Record<string, string> = {
  PUTAWAY_REQUESTED: 'receipt_no, warehouse, task_count, event_time, actor',
  MATERIAL_PICKING_REQUESTED: 'picking_no, wo_no, item_count, warehouse, required_at, event_time',
  STOCK_TRANSFER_ARRIVAL_PENDING:
    'transfer_no, from_warehouse, to_warehouse, item_count, event_time, actor',
  SHIPMENT_PICKING_REQUESTED: 'request_no, customer, item_count, ship_date, event_time',
  SHIPMENT_PACKING_REQUESTED: 'shipment_no, warehouse, ship_date, event_time, actor',
  WORK_ORDER_RELEASED: 'wo_no, item, plan_qty, process, equipment, event_time',
  EMERGENCY_WORK_ORDER_RELEASED: 'wo_no, item, plan_qty, process, equipment, event_time',
  OQC_INSPECTION_REQUESTED: 'request_no, request_count, ship_date, event_time',
  REWORK_WORK_ORDER_CREATED: 'wo_no, item, qty, ncr_no, process, event_time, actor',
  IQC_INSPECTION_REQUESTED: 'receipt_no, lot_count, supplier, event_time',
};

describe('인계 템플릿 파라미터 — SC-006 클라이언트 쪽', () => {
  it('SC-006 10종 파라미터 이름이 zalo-templates.md 와 100% 같다', () => {
    expect(Object.keys(HANDOVER_TEMPLATE_PARAMS).sort()).toEqual(
      Object.keys(ZALO_TEMPLATES_MD).sort(),
    );
    for (const [code, params] of Object.entries(ZALO_TEMPLATES_MD)) {
      expect(handoverParamsOf(code), code).toBe(params);
    }
  });

  it('SC-006 화면이 세우는 10종 차례와 파라미터 표의 종류가 같다', () => {
    expect([...HANDOVER_ALERT_ORDER].sort()).toEqual(Object.keys(HANDOVER_TEMPLATE_PARAMS).sort());
  });

  it('FR-022 기존 6종 표에는 인계 종류가 섞이지 않는다', () => {
    expect(Object.keys(TEMPLATE_PARAMS)).toHaveLength(6);
    for (const code of HANDOVER_ALERT_ORDER) expect(code in TEMPLATE_PARAMS).toBe(false);
  });
});
