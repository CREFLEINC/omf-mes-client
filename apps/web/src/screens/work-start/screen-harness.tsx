/**
 * 이 화면의 감지기 전용 발판. 런타임 코드는 이 모듈을 참조하지 않는다 — 참조하면 예시 값이
 * 배포 번들에 들어간다.
 *
 * 감지기가 여럿으로 나뉘어도 **한 스텁을 함께 쓴다.** 스텁이 갈리면 두 파일이 다른 서버를
 * 상대로 같은 화면을 검사하게 된다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 접두).
 */
import userEvent from '@testing-library/user-event';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { WorkStartScreen } from './screen';

export const TERMINAL_ID = 9101;
export const PROCESS_ID = 7201;
export const EQUIPMENT_ID = 6301;

export const IDENTITY: PopIdentity = {
  terminalId: TERMINAL_ID,
  processId: PROCESS_ID,
  workerNo: null,
};

export const TERMINAL = {
  terminalId: TERMINAL_ID,
  terminalCode: 'SYN-TRM-01',
  plantId: 1,
  terminalTypeCode: 'SYN_STATION',
  statusCode: 'SYN_ACTIVE',
  isActive: true,
  equipmentId: EQUIPMENT_ID,
  equipmentCode: 'SYN-PRS-01',
  equipmentName: '합성 프레스 1호기',
};

/** 이 단말·공정에서 작업 시작이 열린 행. */
export const OPEN_PROCESS = { processId: PROCESS_ID, processName: '합성 사출', canStartWork: true };

export const WORK_ORDER = {
  workOrderId: 8101,
  workOrderNo: 'SYN-WO-0101',
  productionPlanId: 4001,
  routingOperationId: 3001,
  itemId: 5001,
  itemCode: 'SYN-ITEM-0101',
  orderQty: 500,
  uomId: 11,
  workOrderTypeCode: 'NORMAL',
  statusCode: 'SYN_UNKNOWN_STATUS',
  priorityNo: 100,
  plannedEquipmentId: EQUIPMENT_ID,
  plannedMoldId: 6401,
  plannedStartAt: '2026-09-02T08:00:00+09:00',
};

/** 이 설비에 부여된 일상 점검 — 하루 주기라 창이 오늘 하루다. */
export const DAILY_ASSIGNMENT = {
  equipmentInspectionItemId: 5501,
  itemCode: 'SYN-DAILY-01',
  itemName: '합성 일상 점검',
  inspectionTypeCode: 'DAILY',
  judgmentMethodCode: 'VISUAL',
  requiredFlag: true,
  sequenceNo: 1,
  cycleTypeCode: 'DAY',
  cycleInterval: 1,
  cycleBaseDate: '2026-01-01',
  isActive: true,
};

/** 오늘 합격한 점검 한 건. ⚠ 시각은 감지기가 `decidedAt` 을 고정해 넣는다. */
export const PASSED_INSPECTION = {
  inspectionId: 6601,
  equipmentId: EQUIPMENT_ID,
  inspectionTypeCode: 'DAILY',
  overallResultCode: 'PASS',
  inspectedAt: '2026-09-02T08:00:00+09:00',
  inspectorWorkerNo: '3391',
};

/** ⚠ `workerNo` 는 숫자 칸이라 `SYN-` 접두를 붙일 수 없다 — **지어낸 값**이다. */
export const WORKER = {
  workerId: 2101,
  workerNo: '3391',
  workerName: '합성 작업자',
  businessUnitId: 1,
  plantId: 1,
  statusCode: 'SYN_ACTIVE',
  isActive: true,
};

export interface StubOptions {
  /** 단말 기능 구성 응답의 행들. 기본은 「이 공정이 열림」. */
  processes?: Record<string, unknown>[];
  processesStatus?: number;
  terminalStatus?: number;
  workOrders?: Record<string, unknown>[];
  listStatus?: number;
  /** 고른 작업지시의 열린 세션. 기본은 없음. */
  openSessions?: Record<string, unknown>[];
  workers?: Record<string, unknown>[];
  workersStatus?: number;
  /** 사번 조회를 «첫 번째만» 실패시킨다 — 「다시 시도」가 실제로 푸는지 재려면 필요하다. */
  workersFailFirst?: boolean;
  /** 세션 열기 응답 상태. 기본 201. */
  startStatus?: number;

  /*
   * 작업 전 점검 통제 게이트(`P-02-02`)가 부르는 것들. **기본은 통과**다 — 게이트를 재는
   * 감지기가 아니면 시작이 그대로 이어져야 한다.
   */
  /** 통제 수준 정책. 기본은 차단(BLOCK)이고, 점검이 합격이라 통과한다. */
  controlLevel?: string;
  /** 적용 정책이 없다고 답한다 — 화면이 경고로 다뤄야 한다. */
  policyUnresolved?: boolean;
  policyStatus?: number;
  /** 이 설비에 부여된 점검 항목. 기본은 일상 점검 하나. */
  assignments?: Record<string, unknown>[];
  /** 부여가 어느 층에서 왔는가. `NONE` 이면 점검 대상이 아니다. */
  resolvedFromLevelCode?: string;
  assignmentsStatus?: number;
  /** 주기 내 점검 이력. 기본은 오늘 합격 한 건. */
  inspections?: Record<string, unknown>[];
  inspectionsStatus?: number;
  /** 열린 고장 건수. 기본 0. */
  openBreakdownCount?: number;
  /** 판정 기록 응답 상태. 기본 201. */
  decisionStatus?: number;
  /** 점검 유형의 표시 이름(코드 사전). 기본은 일상·정기 두 값. */
  inspectionTypeNames?: Record<string, unknown>[];
}

export interface Recorded {
  urls: string[];
  bodies: { url: string; body: unknown; headers: Record<string, string> }[];
}

const stub = (options: StubOptions = {}): { recorded: Recorded; fetch: StubFetch } => {
  const recorded: Recorded = { urls: [], bodies: [] };
  let workerCalls = 0;

  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    const path = `${url.pathname}${url.search}`;
    recorded.urls.push(path);

    if (request.method === 'POST') {
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });
      recorded.bodies.push({ url: url.pathname, body: await request.clone().json(), headers });
    }

    if (url.pathname === `/mdm/terminals/${String(TERMINAL_ID)}`) {
      if (options.terminalStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.terminalStatus });
      }

      return jsonResponse(TERMINAL);
    }

    if (url.pathname === `/mdm/terminals/${String(TERMINAL_ID)}/processes`) {
      if (options.processesStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.processesStatus });
      }

      return jsonResponse({ items: options.processes ?? [OPEN_PROCESS] });
    }

    if (url.pathname === '/production/work-orders') {
      if (options.listStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.listStatus });
      }

      const items = options.workOrders ?? [WORK_ORDER];

      return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
    }

    if (url.pathname === '/production/work-sessions' && request.method === 'GET') {
      const items = options.openSessions ?? [];

      return jsonResponse({ items, page: { page: 1, size: 2, total: items.length } });
    }

    if (url.pathname === '/production/work-sessions' && request.method === 'POST') {
      if (options.startStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.startStatus });
      }

      return jsonResponse(
        {
          workSessionId: 9901,
          workOrderId: WORK_ORDER.workOrderId,
          sessionNo: 1,
          terminalId: TERMINAL_ID,
          startedAt: '2026-09-02T09:00:00+09:00',
          statusCode: 'SYN_RUNNING',
        },
        { status: 201 },
      );
    }

    if (url.pathname === '/app/operation-policies/effective') {
      if (options.policyStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.policyStatus });
      }

      return jsonResponse({
        policyCode: 'PRECHECK_CONTROL_LEVEL',
        resolved: options.policyUnresolved !== true,
        valueText: options.controlLevel ?? 'BLOCK',
        matchedScopeCode: 'PROCESS',
      });
    }

    if (url.pathname === `/mdm/equipments/${String(EQUIPMENT_ID)}/inspection-items`) {
      if (options.assignmentsStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.assignmentsStatus });
      }

      const effective = options.assignments ?? [DAILY_ASSIGNMENT];

      return jsonResponse({
        assigned: effective,
        effective,
        resolvedFromLevelCode: options.resolvedFromLevelCode ?? 'EQUIPMENT',
      });
    }

    if (url.pathname === '/maintenance/inspections') {
      if (options.inspectionsStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.inspectionsStatus });
      }

      const items = options.inspections ?? [PASSED_INSPECTION];

      return jsonResponse({ items, page: { page: 1, size: 1, total: items.length } });
    }

    if (url.pathname === '/maintenance/breakdowns') {
      const total = options.openBreakdownCount ?? 0;

      return jsonResponse({ items: [], page: { page: 1, size: 1, total } });
    }

    if (url.pathname === '/production/precheck-decisions') {
      if (options.decisionStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.decisionStatus });
      }

      return jsonResponse(
        {
          precheckDecisionId: 7701,
          workOrderId: WORK_ORDER.workOrderId,
          equipmentId: EQUIPMENT_ID,
          decidedAt: '2026-09-02T09:00:00+09:00',
          controlLevelCode: options.controlLevel ?? 'BLOCK',
          decisionCode: 'PASSED',
        },
        { status: 201 },
      );
    }

    if (url.pathname === '/mdm/code-values') {
      return jsonResponse({
        items: options.inspectionTypeNames ?? [
          {
            codeValueId: 5901,
            codeGroupId: 5900,
            code: 'DAILY',
            codeName: '일상(Daily)',
            nameKo: '일상(Daily)',
            displayOrder: 1,
            isActive: true,
          },
          {
            codeValueId: 5902,
            codeGroupId: 5900,
            code: 'MONTHLY',
            codeName: '정기(Monthly)',
            nameKo: '정기(Monthly)',
            displayOrder: 2,
            isActive: true,
          },
        ],
        page: { page: 1, size: 20, total: 2 },
      });
    }

    if (url.pathname === '/mdm/workers') {
      if (options.workersFailFirst === true && workerCalls === 0) {
        workerCalls += 1;

        return jsonResponse({ message: '실패' }, { status: 500 });
      }

      workerCalls += 1;

      if (options.workersStatus !== undefined) {
        return jsonResponse({ message: '실패' }, { status: options.workersStatus });
      }

      const items = options.workers ?? [WORKER];

      return jsonResponse({ items, page: { page: 1, size: 2, total: items.length } });
    }

    throw new Error(`스텁에 없는 요청입니다: ${request.method} ${url.pathname}`);
  };

  return { recorded, fetch };
};

export const renderScreen = (options: StubOptions & { identity?: PopIdentity } = {}) => {
  const { identity = IDENTITY, ...stubOptions } = options;
  const stubbed = stub(stubOptions);
  const rendered = renderWithProviders(
    <PopIdentityProvider value={identity}>
      <WorkStartScreen />
    </PopIdentityProvider>,
    { fetch: stubbed.fetch, route: '/pop/work-start' },
  );

  return { ...rendered, recorded: stubbed.recorded, user: userEvent.setup() };
};

export const listUrls = (urls: string[]): string[] =>
  urls.filter((url) => url.startsWith('/production/work-orders'));
