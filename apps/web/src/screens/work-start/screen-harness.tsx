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
