import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

const t = messages.shippingPackingLabel.error;

/** 출력 권한이 없으면 서버가 막는다 — 화면 선차단이 아니라 서버의 403 이 집행이다(스펙 §6). */
const FORBIDDEN = 403;
/** 재발행 사유 없이 재발행하면 여기 걸린다 — 화면이 먼저 막지만 마지막 방어선은 서버다. */
const UNPROCESSABLE = 422;
/** 같은 회차가 두 번 저장되면 유일 제약(`uq_document_issue_log`)에 걸린다. */
const CONFLICT = 409;

/**
 * 실패를 사람 말로 푼다.
 *
 * ⛔ **서버가 준 사유를 삼키지 않는다** — 다음 행동을 정하는 유일한 단서일 때가 있다.
 * 화면이 「발행하지 못했습니다」로 덮으면 사용자는 무엇을 고쳐야 할지 모른다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다. 같은 상태
 * 코드라도 화면마다 「사용자가 할 일」이 다르기 때문이다.
 */
export const describeError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'validation':
    case 'stateLocked': {
      const lines = error.errors.map((item) => item.message).filter((one) => one.trim() !== '');

      return lines.length === 0 ? t.rejected : lines.join(' ');
    }
    case 'conflict':
      return t.duplicate;
    case 'http': {
      if (error.status === FORBIDDEN) return t.forbidden;
      if (error.status === CONFLICT) return t.duplicate;
      if (error.status === UNPROCESSABLE) return error.message ?? t.unprocessable;

      return error.message ?? messages.httpError.description;
    }
  }
};
