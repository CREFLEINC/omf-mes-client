/**
 * 이벤트별 Zalo 템플릿 파라미터 이름 — **고정이다**(data-model §6, research R-4). 고객사는 이
 * 이름 그대로 템플릿을 등록하고 관리자는 템플릿 ID 만 넣는다. 서버가 같은 이름으로 보낸다.
 */
const COMMON = ['event_time', 'actor'];
const WORK = ['wo_no', 'item', 'process', 'line'];

export const TEMPLATE_PARAMS: Record<string, readonly string[]> = {
  WORK_SESSION_STARTED: [...WORK, ...COMMON],
  WORK_SESSION_STOPPED: [...WORK, 'reason', ...COMMON],
  WORK_SESSION_ENDED: [...WORK, 'plan_qty', 'good_qty', ...COMMON],
  WORK_ORDER_CLOSED: [...WORK, 'plan_qty', 'good_qty', ...COMMON],
  EQUIPMENT_BREAKDOWN_OCCURRED: ['equipment', 'location', 'line', 'symptom', ...COMMON],
  APPROVAL_ACTION_REQUIRED: [
    'approval_type',
    'request_no',
    'requester',
    'reason',
    'step',
    ...COMMON,
  ],
};

export const paramsOf = (eventCode: string): string =>
  (TEMPLATE_PARAMS[eventCode] ?? COMMON).join(', ');

/**
 * 인계 작업 10종의 템플릿 파라미터 이름(피처 002) — `specs/002-terminal-task-alerts/zalo-templates.md` 표와
 * 같고, 서버 `HANDOVER_PARAMS` 와도 같아야 한다(SC-006). 기존 6종 표와 섞지 않는다.
 */
export const HANDOVER_TEMPLATE_PARAMS: Record<string, readonly string[]> = {
  PUTAWAY_REQUESTED: ['receipt_no', 'warehouse', 'task_count', 'event_time', 'actor'],
  MATERIAL_PICKING_REQUESTED: [
    'picking_no',
    'wo_no',
    'item_count',
    'warehouse',
    'required_at',
    'event_time',
  ],
  STOCK_TRANSFER_ARRIVAL_PENDING: [
    'transfer_no',
    'from_warehouse',
    'to_warehouse',
    'item_count',
    'event_time',
    'actor',
  ],
  SHIPMENT_PICKING_REQUESTED: ['request_no', 'customer', 'item_count', 'ship_date', 'event_time'],
  SHIPMENT_PACKING_REQUESTED: ['shipment_no', 'warehouse', 'ship_date', 'event_time', 'actor'],
  WORK_ORDER_RELEASED: ['wo_no', 'item', 'plan_qty', 'process', 'equipment', 'event_time'],
  EMERGENCY_WORK_ORDER_RELEASED: [
    'wo_no',
    'item',
    'plan_qty',
    'process',
    'equipment',
    'event_time',
  ],
  OQC_INSPECTION_REQUESTED: ['request_no', 'request_count', 'ship_date', 'event_time'],
  REWORK_WORK_ORDER_CREATED: ['wo_no', 'item', 'qty', 'ncr_no', 'process', 'event_time', 'actor'],
  IQC_INSPECTION_REQUESTED: ['receipt_no', 'lot_count', 'supplier', 'event_time'],
};

export const handoverParamsOf = (alertTypeCode: string): string =>
  (HANDOVER_TEMPLATE_PARAMS[alertTypeCode] ?? ['event_time']).join(', ');
