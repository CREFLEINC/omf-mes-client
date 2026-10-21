import type {
  InspectionSheet,
  InspectionSheetHeaderUpdate,
  InspectionSheetNgWrite,
  InspectionSheetStepCode,
  InspectionSheetStepWrite,
} from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite } from '../../patterns/master';
import { runRequest } from '../../patterns/request';

export const sheetKeys = {
  all: ['inspection-sheet'] as const,
  detail: (id: number) => ['inspection-sheet', 'detail', id] as const,
};

/** 상세 GET 의 주소 — 응답 ETag 가 이 주소로 기억되고, 머리·단계 쓰기의 If-Match 가 여기서 나온다. */
export const sheetDetailPath = (id: number): string => `/quality/inspection-sheets/${id}`;

/** ⭐ POP 은 사번을 싣는다 — 단말 요청은 서버가 그 사번의 작업자를 작성자·검사자로 정한다. 관리웹은 계정이다. */
const workerHeaders = (workerNo: string | undefined) =>
  workerNo === undefined ? {} : { headers: { 'X-Worker-No': workerNo } };

export const useSheet = (id: number | null, workerNo?: string) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: sheetKeys.detail(id ?? 0),
    enabled: id !== null,
    queryFn: (): Promise<InspectionSheet> =>
      runRequest(() =>
        client.GET('/quality/inspection-sheets/{inspectionSheetId}', {
          params: { path: { inspectionSheetId: id ?? 0 } },
          ...workerHeaders(workerNo),
        }),
      ),
  });
};

/** 시리얼로 열기 — 없으면 서버가 만든다. 성공하면 검사표 id 를 넘긴다(상세는 GET 이 다시 받아 ETag 를 남긴다). */
export const useOpenSheet = (onOpened: (sheet: InspectionSheet) => void, workerNo?: string) => {
  const { client } = useApiClient();

  return useMasterWrite<{ serialNo: string }, InspectionSheet>({
    request: ({ serialNo }, headers) =>
      client.POST('/quality/inspection-sheets:open-by-serial', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        ...workerHeaders(workerNo),
        body: { serialNo },
      }),
    etagPath: null,
    invalidateKeys: [sheetKeys.all],
    knownFields: ['serialNo'],
    onSuccess: onOpened,
  });
};

export const useSaveHeader = (id: number | null, onSaved: () => void, workerNo?: string) => {
  const { client } = useApiClient();

  return useMasterWrite<InspectionSheetHeaderUpdate, InspectionSheet>({
    request: (body, headers) =>
      client.PUT('/quality/inspection-sheets/{inspectionSheetId}/header', {
        params: {
          path: { inspectionSheetId: id ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        ...workerHeaders(workerNo),
        body,
      }),
    etagPath: id === null ? null : sheetDetailPath(id),
    invalidateKeys: [sheetKeys.all],
    knownFields: [],
    onSuccess: onSaved,
  });
};

export interface StepWriteVariables {
  stepCode: InspectionSheetStepCode;
  body: InspectionSheetStepWrite;
}

export const useSaveStep = (id: number | null, onSaved: () => void, workerNo?: string) => {
  const { client } = useApiClient();

  return useMasterWrite<StepWriteVariables, InspectionSheet>({
    request: ({ stepCode, body }, headers) =>
      client.PUT('/quality/inspection-sheets/{inspectionSheetId}/steps/{stepCode}', {
        params: {
          path: { inspectionSheetId: id ?? 0, stepCode },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        ...workerHeaders(workerNo),
        body,
      }),
    etagPath: id === null ? null : sheetDetailPath(id),
    invalidateKeys: [sheetKeys.all],
    knownFields: [],
    onSuccess: onSaved,
  });
};

/** NG 블록 통째로 — 배열 순서가 순번이다. 작업자는 사번으로 보낸다. */
export const useSaveNgs = (id: number | null, onSaved: () => void, workerNo?: string) => {
  const { client } = useApiClient();

  return useMasterWrite<InspectionSheetNgWrite[], InspectionSheet>({
    request: (ngs, headers) =>
      client.PUT('/quality/inspection-sheets/{inspectionSheetId}/ngs', {
        params: {
          path: { inspectionSheetId: id ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        ...workerHeaders(workerNo),
        body: { ngs },
      }),
    etagPath: id === null ? null : sheetDetailPath(id),
    invalidateKeys: [sheetKeys.all],
    knownFields: [],
    onSuccess: onSaved,
  });
};
