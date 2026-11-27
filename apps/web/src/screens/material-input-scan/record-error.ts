import { isForbidden } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { forbiddenLines } from '../../patterns/forbidden-lines';
import { toApiError } from '../../patterns/request';
import { serverReasonOf } from '../../patterns/server-reason';

/** 반제품 투입이 남은 수량을 넘었다(서버 409 코드 · 피처 016). */
const WIP_QTY_EXCEEDED = 'WIP_QTY_EXCEEDED';

/**
 * 건별 기록이 서버에서 거부된 까닭을 한 줄로 옮긴다. 권한 없음은 서버가 집행한 것이라 단말 판정과
 * 다른 자리다. BOM 불일치처럼 서버가 판정한 거부는 서버 문구를 그대로 옮긴다(§6).
 */
export const describeRecordError = (error: unknown, uom = ''): string => {
  const apiError = toApiError(error);

  /*
   * 반제품 남은 수량 초과(409 `WIP_QTY_EXCEEDED` · 피처 016) — 서버 문구 대신 시안 문구로 근거를 함께 말한다.
   * 수량은 서버가 잠금 안에서 다시 센 `meta` 다(이미 투입 = 실적 − 남은). 단위는 그 투입 본문의 단위.
   */
  if (
    apiError.kind === 'validation' &&
    apiError.wipQty !== undefined &&
    apiError.errors.some((item) => item.code === WIP_QTY_EXCEEDED)
  ) {
    const { remainingQty, producedQty } = apiError.wipQty;

    return messages.materialInputScan.wip.exceeded(
      uom === '' ? String(remainingQty) : `${String(remainingQty)} ${uom}`,
      String(producedQty),
      String(Number((producedQty - remainingQty).toFixed(6))),
    );
  }

  /* 403 은 봉투에 담겨 `validation` 으로 오므로 갈래보다 먼저 본다(#242). */
  if (isForbidden(apiError)) return forbiddenLines(apiError).join(' ');
  switch (apiError.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
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
