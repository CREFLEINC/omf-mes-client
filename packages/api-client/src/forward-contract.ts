import type { paths } from './generated/api';

/** P-7/P-10 선행 계약: 공식 설계 사본이 갱신될 때 동등성을 대조하고 제거한다. */
export type TerminalRegistrationStatusCode = 'UNREGISTERED' | 'REGISTERED';

/**
 * 생산라인(설비 그룹)의 기본 위치 셋 — 서버가 계약보다 먼저 연 칸이라 생성 타입에 없다. 계약 사본에
 * 실려 `gen:api` 가 만들면 이 타입과 덧댄 자리를 지운다. 본문에서 생략 = 유지, null = 비움.
 */
export interface LineDefaultLocations {
  defaultWipLocationId?: number | null;
  defaultFgLocationId?: number | null;
  defaultScrapLocationId?: number | null;
}

export interface TerminalRegistrationConfirmation {
  terminalId: number;
  tokenVersion: number;
  registrationStatusCode: 'REGISTERED';
  registrationConfirmedAt: string;
}

/** 서버 선행 P-38(omf-all-around#104) — 계정에 연결된 작업자. 연결이 없으면 세 칸이 모두 null. */
export interface AppUserWorker {
  workerId: number | null;
  workerNo: string | null;
  workerName: string | null;
}

/** 서버 선행 P-38 — `Session.worker`. 서버가 «언제나» 싣고 연결이 없으면 null 이다. */
export interface SessionWorker {
  workerId: number;
  workerNo: string;
  workerName: string;
}

interface AppUserWorkerPath {
  parameters: {
    query?: never;
    header?: never;
    path?: never;
    cookie?: never;
  };
  get: {
    parameters: {
      query?: never;
      header?: never;
      path: { appUserId: number };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: { [name: string]: unknown };
        content: { 'application/json': AppUserWorker };
      };
    };
  };
  put: {
    parameters: {
      query?: never;
      header: { 'Idempotency-Key': string };
      path: { appUserId: number };
      cookie?: never;
    };
    requestBody: { content: { 'application/json': { workerId: number | null } } };
    responses: {
      200: {
        headers: { [name: string]: unknown };
        content: { 'application/json': AppUserWorker };
      };
    };
  };
  post?: never;
  delete?: never;
  options?: never;
  head?: never;
  patch?: never;
  trace?: never;
}

/** 서버 선행 P-57(omf-all-around#58) — 첨부 대상에 검사 문서(LOT·검사 결과)를 더한다. */
export type AttachmentTargetType =
  'WAREHOUSE' | 'NOTICE' | 'BREAKDOWN' | 'LOT' | 'INSPECTION_RESULT';

type AttachmentsPath = paths['/app/attachments'];
type AttachmentsListQuery = NonNullable<AttachmentsPath['get']['parameters']['query']>;

export interface ForwardPaths {
  '/app/attachments': Omit<AttachmentsPath, 'get'> & {
    get: Omit<AttachmentsPath['get'], 'parameters'> & {
      parameters: Omit<AttachmentsPath['get']['parameters'], 'query'> & {
        query?: Omit<AttachmentsListQuery, 'targetTypeCode'> & {
          targetTypeCode?: AttachmentTargetType;
        };
      };
    };
  };
  '/app/users/{appUserId}/worker': AppUserWorkerPath;
  '/mdm/terminals/{terminalId}/accessible-screens': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: { terminalId: number };
        cookie?: never;
      };
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': { screenCodes: string[] } };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/mdm/terminals/{terminalId}:confirm-registration': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header: { 'Idempotency-Key': string };
        path: { terminalId: number };
        cookie?: never;
      };
      requestBody: { content: { 'application/json': Record<string, never> } };
      responses: {
        200: {
          headers: { [name: string]: unknown };
          content: { 'application/json': TerminalRegistrationConfirmation };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}

/** 같은 경로를 forward 가 다시 적으면 그쪽이 이긴다 — 교집합이면 좁은 쪽 enum 이 남는다(omf-all-around#58 첨부 대상). */
export type ApiPaths = Omit<paths, keyof ForwardPaths> & ForwardPaths;
