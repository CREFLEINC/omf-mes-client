import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';
import { serverReasonOf } from '../../patterns/server-reason';

/**
 * 건별 기록이 서버에서 거부된 까닭을 한 줄로 옮긴다. 권한 없음은 서버가 집행한 것이라 단말 판정과
 * 다른 자리다. BOM 불일치처럼 서버가 판정한 거부는 서버 문구를 그대로 옮긴다(§6).
 */
export const describeRecordError = (error: unknown): string => {
  const apiError = toApiError(error);

  switch (apiError.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (apiError.status === 403) return messages.httpError.forbidden;
      /* 단말 권한(401) 거부는 서버 문구가 켜는 곳을 말한다. 그 밖의 몸체는 보일 말이 아니다. */
      return serverReasonOf(apiError) ?? messages.httpError.description;
    case 'conflict':
      return apiError.message === '' ? messages.httpError.description : apiError.message;
    case 'stateLocked':
    case 'validation': {
      const lines = apiError.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};
