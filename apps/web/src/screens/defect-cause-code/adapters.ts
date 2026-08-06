import type { ApiClient } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { runRequest } from '../../patterns/request';
import { causeToHierarchyCode, defectToHierarchyCode } from './mappers';
import type { CodeFilters, CodeKind, CodeListResult, ServerFieldNames } from './types';

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
  keys: CodeCacheKeys;
  /** 서버가 쓰는 필드 이름. 400 응답의 `field`를 폼 입력칸에 잇는 기준이다. */
  serverFields: ServerFieldNames;
  labels: CodeLabels;
  fetchList: (client: Client, filters: CodeFilters) => Promise<CodeListResult>;
}

const t = messages.defectCauseCode;

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
};

export const causeCodeAdapter: CodeAdapter = {
  kind: 'cause',
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
};
