import type { ApiClient } from '@omf-mes/api-client';

import type { OutboxEntry, OutboxFile, OutboxTransport } from '../patterns/outbox';
import { runRequest, type ApiCallResult } from '../patterns/request';

type Call = (path: string, init: Record<string, unknown>) => Promise<ApiCallResult<unknown>>;

/** base64 로 담아 둔 파일을 보낼 수 있는 몸으로 되돌린다. */
const toFormData = (file: OutboxFile): FormData => {
  const binary = atob(file.data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: file.mimeType }), file.fileName);

  return form;
};

/**
 * 큐에 담긴 건을 실제로 보낸다.
 *
 * 경로와 방식이 담길 때 정해지므로 계약 타입으로 좁힐 수 없다. 담는 쪽이 계약에 있는 경로를
 * 넣는 것을 전제로 하고, 여기서는 그것을 그대로 흘려보낸다.
 *
 * 낙관적 잠금 토큰을 싣지 않는다. 큐에 담긴 건의 토큰은 이미 낡았고, 충돌 화면을 볼 작업자가
 * 그 자리에 없다. 중복은 멱등키가 막고 상태 전이는 서버가 판정한다.
 */
export const createOutboxTransport = (api: ApiClient): OutboxTransport => {
  return async (entry: OutboxEntry) => {
    const call = (api.client as unknown as Record<string, Call>)[entry.method];

    if (call === undefined) {
      throw new Error(`보낼 수 없는 방식입니다: ${entry.method}`);
    }

    /*
     * 파일은 몸을 통째로 바꾼다. 내용 유형은 브라우저가 경계 문자열과 함께 정해야 해서
     * 우리가 적지 않는다 — 적으면 경계가 빠져 서버가 몸을 가르지 못한다.
     */
    const body = entry.file === undefined ? entry.body : toFormData(entry.file);

    return runRequest(() =>
      call(entry.path, {
        body,
        headers: { 'Idempotency-Key': entry.idempotencyKey },
      }),
    );
  };
};
