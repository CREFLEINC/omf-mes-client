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
