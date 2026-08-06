import type { ApiClient, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { WriteHeaders } from '../../patterns/master';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import {
  causeToHierarchyCode,
  defectToHierarchyCode,
  toWritePayload,
  type CodeWritePayload,
} from './mappers';
import type {
  CodeDetailResult,
  CodeFilters,
  CodeFormValues,
  CodeKind,
  CodeListResult,
  HierarchyCode,
  ServerFieldNames,
} from './types';

/**
 * 탭 어댑터 — **리소스 이름이 사는 유일한 자리**다.
 *
 * 불량 코드와 원인 코드는 계약 구조가 같고 경로·필드 이름만 다르다. 화면 부품을 한 벌만 만들고
 * 그 차이를 여기에 담는다. 화면 코드에 `kind === 'defect' ? … : …` 같은 분기를 두지 않는다 —
 * 두면 탭이 늘 때마다 분기를 빠뜨릴 자리가 생긴다.
 *
 * 요청을 어댑터 안에 **함수로** 두는 이유는 `openapi-fetch`가 경로를 리터럴 타입으로 요구하기
 * 때문이다. 경로를 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

/** 캐시 키. `all`이 나머지 키의 접두라 한 번의 무효화로 목록·상세·선택지가 함께 다시 조회된다. */
export interface CodeCacheKeys {
  all: readonly unknown[];
  list: (filters: CodeFilters) => readonly unknown[];
  detail: (id: number) => readonly unknown[];
  options: readonly unknown[];
}

export interface CodeLabels {
  tab: string;
  code: string;
  name: string;
  parent: string;
  searchLabel: string;
  searchPlaceholder: string;
}

export interface CodeAdapter {
  kind: CodeKind;
  /**
   * ETag가 보관된 상세 경로. 쓰기의 `If-Match`는 **언제나 여기서** 꺼낸다.
   * 보관 키가 요청 경로라 `…:deactivate` 같은 액션 경로로 꺼내면 항상 비어 있다.
   */
  detailPath: (id: number) => string;
  keys: CodeCacheKeys;
  /** 서버가 쓰는 필드 이름. 400 응답의 `field`를 폼 입력칸에 잇는 기준이다. */
  serverFields: ServerFieldNames;
  labels: CodeLabels;
  fetchList: (client: Client, filters: CodeFilters) => Promise<CodeListResult>;
  /** 계층 판정과 상위 선택지 전용 목록. 화면의 조회 조건과 무관하게 미사용까지 받는다. */
  fetchAllForOptions: (client: Client) => Promise<CodeListResult>;
  /** 잠금 토큰(ETag)과 코드 편집 가능 여부가 이 응답으로 온다 — 목록 행만으로는 저장을 시작할 수 없다. */
  fetchDetail: (client: Client, id: number) => Promise<CodeDetailResult>;
  create: (
    client: Client,
    values: CodeFormValues,
    headers: WriteHeaders,
  ) => Promise<ApiCallResult<HierarchyCode>>;
  update: (
    client: Client,
    id: number,
    values: CodeFormValues,
    /** 상세 응답에서 받은 공정 번호. 화면에 입력칸이 없어 그대로 되돌려 보낸다. */
    preservedProcessId: number | null,
    headers: WriteHeaders,
  ) => Promise<ApiCallResult<HierarchyCode>>;
  deactivate: (
    client: Client,
    id: number,
    headers: WriteHeaders,
  ) => Promise<ApiCallResult<HierarchyCode>>;
}

const t = messages.defectCauseCode;

type DefectCodeCreate = components['schemas']['DefectCodeCreate'];
type CauseCodeCreate = components['schemas']['CauseCodeCreate'];
type DefectCodeUpdate = components['schemas']['DefectCodeUpdate'];
type CauseCodeUpdate = components['schemas']['CauseCodeUpdate'];

/**
 * 쓰기 응답의 계약 표현을 화면 표현으로 옮긴다.
 * 실패 응답(`error`)과 원본 `response`는 그대로 넘겨 `runRequest`의 오류 정규화를 건드리지 않는다.
 */
const toWriteResult = <TRaw>(
  result: { data?: TRaw; error?: unknown; response: Response },
  toCode: (raw: TRaw) => HierarchyCode,
): ApiCallResult<HierarchyCode> => ({
  data: result.data === undefined ? undefined : toCode(result.data),
  error: result.error,
  response: result.response,
});

/**
 * 등록 본문. **공정 번호를 싣지 않는다** — 화면에 입력 수단이 없으므로 만들 값이 없다.
 * 상위가 없으면 키 자체를 싣지 않는다. 새로 만드는 행이라 「없음」이 곧 대분류다.
 */
const toDefectCreate = (payload: CodeWritePayload): DefectCodeCreate => ({
  defectCode: payload.code,
  defectName: payload.name,
  ...(payload.parentId === null ? {} : { parentDefectCodeId: payload.parentId }),
});

const toCauseCreate = (payload: CodeWritePayload): CauseCodeCreate => ({
  causeCode: payload.code,
  causeName: payload.name,
  ...(payload.parentId === null ? {} : { parentCauseCodeId: payload.parentId }),
});

/**
 * 수정 본문. 수정은 전체 치환이므로 화면이 아는 값을 모두 실어 보낸다.
 *
 * - 상위는 **`null`도 명시해** 보낸다. 키를 빼면 서버가 이전 값을 남길 수 있어
 *   상세 코드를 대분류로 되돌릴 수 없다. 등록과 달리 「없음」을 뜻이 있는 값으로 보내야 한다
 * - 공정 번호는 상세 응답에서 받은 값이 숫자일 때만 싣는다. 화면에 입력칸이 없는 값이라
 *   빠뜨리면 서버에 저장돼 있던 값이 조용히 지워진다
 */
const toDefectUpdate = (payload: CodeWritePayload): DefectCodeUpdate => ({
  defectCode: payload.code,
  defectName: payload.name,
  parentDefectCodeId: payload.parentId,
  ...(payload.processId === null ? {} : { processId: payload.processId }),
});

const toCauseUpdate = (payload: CodeWritePayload): CauseCodeUpdate => ({
  causeCode: payload.code,
  causeName: payload.name,
  parentCauseCodeId: payload.parentId,
  ...(payload.processId === null ? {} : { processId: payload.processId }),
});

/**
 * 목록 조회 조건. **비어 있거나 꺼진 조건은 키 자체를 싣지 않는다** —
 * `includeInactive=false`를 실어 보내는 것과 싣지 않는 것은 서버에서 같은 뜻이지만,
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 */
const listQuery = (filters: CodeFilters): { q?: string; includeInactive?: boolean } => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...(filters.includeInactive ? { includeInactive: true } : {}),
});

export const defectCodeAdapter: CodeAdapter = {
  kind: 'defect',
  detailPath: (id) => `/quality/defect-codes/${String(id)}`,
  keys: {
    all: ['defect-codes'],
    list: (filters) => ['defect-codes', 'list', filters],
    detail: (id) => ['defect-codes', 'detail', id],
    options: ['defect-codes', 'options'],
  },
  serverFields: { code: 'defectCode', name: 'defectName', parentId: 'parentDefectCodeId' },
  labels: {
    tab: t.tabs.defect,
    code: t.fields.code,
    name: t.fields.name,
    parent: t.fields.parent,
    searchLabel: t.filters.defectSearchLabel,
    searchPlaceholder: t.filters.defectSearchPlaceholder,
  },
  fetchList: async (client, filters) => {
    const data = await runRequest(() =>
      client.GET('/quality/defect-codes', { params: { query: listQuery(filters) } }),
    );

    return { items: data.items.map(defectToHierarchyCode), page: data.page };
  },
  fetchAllForOptions: async (client) => {
    const data = await runRequest(() =>
      client.GET('/quality/defect-codes', { params: { query: { includeInactive: true } } }),
    );

    return { items: data.items.map(defectToHierarchyCode), page: data.page };
  },
  fetchDetail: async (client, id) => {
    const data = await runRequest(() =>
      client.GET('/quality/defect-codes/{defectCodeId}', {
        params: { path: { defectCodeId: id } },
      }),
    );

    return {
      code: defectToHierarchyCode(data.defectCode),
      editability: data.editability,
      processId: data.defectCode.processId ?? null,
    };
  },
  create: async (client, values, headers) =>
    toWriteResult(
      await client.POST('/quality/defect-codes', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toDefectCreate(toWritePayload(values, null)),
      }),
      defectToHierarchyCode,
    ),
  update: async (client, id, values, preservedProcessId, headers) =>
    toWriteResult(
      await client.PUT('/quality/defect-codes/{defectCodeId}', {
        params: {
          path: { defectCodeId: id },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toDefectUpdate(toWritePayload(values, preservedProcessId)),
      }),
      defectToHierarchyCode,
    ),
  deactivate: async (client, id, headers) =>
    toWriteResult(
      await client.POST('/quality/defect-codes/{defectCodeId}:deactivate', {
        params: {
          path: { defectCodeId: id },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
      defectToHierarchyCode,
    ),
};

export const causeCodeAdapter: CodeAdapter = {
  kind: 'cause',
  detailPath: (id) => `/quality/cause-codes/${String(id)}`,
  keys: {
    all: ['cause-codes'],
    list: (filters) => ['cause-codes', 'list', filters],
    detail: (id) => ['cause-codes', 'detail', id],
    options: ['cause-codes', 'options'],
  },
  serverFields: { code: 'causeCode', name: 'causeName', parentId: 'parentCauseCodeId' },
  labels: {
    tab: t.tabs.cause,
    code: t.fields.code,
    name: t.fields.name,
    parent: t.fields.parent,
    searchLabel: t.filters.causeSearchLabel,
    searchPlaceholder: t.filters.causeSearchPlaceholder,
  },
  fetchList: async (client, filters) => {
    const data = await runRequest(() =>
      client.GET('/quality/cause-codes', { params: { query: listQuery(filters) } }),
    );

    return { items: data.items.map(causeToHierarchyCode), page: data.page };
  },
  fetchAllForOptions: async (client) => {
    const data = await runRequest(() =>
      client.GET('/quality/cause-codes', { params: { query: { includeInactive: true } } }),
    );

    return { items: data.items.map(causeToHierarchyCode), page: data.page };
  },
  fetchDetail: async (client, id) => {
    const data = await runRequest(() =>
      client.GET('/quality/cause-codes/{causeCodeId}', { params: { path: { causeCodeId: id } } }),
    );

    return {
      code: causeToHierarchyCode(data.causeCode),
      editability: data.editability,
      processId: data.causeCode.processId ?? null,
    };
  },
  create: async (client, values, headers) =>
    toWriteResult(
      await client.POST('/quality/cause-codes', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toCauseCreate(toWritePayload(values, null)),
      }),
      causeToHierarchyCode,
    ),
  update: async (client, id, values, preservedProcessId, headers) =>
    toWriteResult(
      await client.PUT('/quality/cause-codes/{causeCodeId}', {
        params: {
          path: { causeCodeId: id },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toCauseUpdate(toWritePayload(values, preservedProcessId)),
      }),
      causeToHierarchyCode,
    ),
  deactivate: async (client, id, headers) =>
    toWriteResult(
      await client.POST('/quality/cause-codes/{causeCodeId}:deactivate', {
        params: {
          path: { causeCodeId: id },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
      causeToHierarchyCode,
    ),
};
