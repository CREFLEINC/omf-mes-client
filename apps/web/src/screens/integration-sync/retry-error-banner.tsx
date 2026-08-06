import { AlertBanner, Button } from '@crefle/web-ui';
import type { ApiError, ConflictCause } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatTime } from './message-status';

const t = messages.integrationSync;

/** 상태가 실패가 아니라 다시 보낼 수 없는 건. 계약이 정한 코드다. */
const NOT_RETRYABLE = 'NOT_RETRYABLE';

export interface RetryErrorBannerProps {
  /** null이면 아무것도 렌더하지 않는다. */
  error: ApiError | null;
  /** 다시 조회하면 풀리는 오류에만 낸다. 풀리지 않는 오류에 내면 헛수고를 시킨다. */
  onReload?: () => void;
  /**
   * 워커 점유 안내에 붙일 시작 시각(목록 행의 `lockedAt`).
   * 409 응답에는 시각이 없다 — 없으면 시각 없이 안내한다.
   */
  lockedAt?: string | null;
}

interface BannerContent {
  lines: string[];
  /** 다시 조회하면 풀리는가. 액션을 낼지 정한다. */
  canReload: boolean;
}

/** 여러 줄일 때만 목록으로 낸다. 한 줄을 목록으로 내면 없는 항목 구분이 생긴다. */
const BannerLines = ({ lines }: { lines: string[] }): ReactNode => {
  if (lines.length <= 1) return lines[0] ?? null;

  return (
    <ul>
      {lines.map((line, index) => (
        <li key={`${String(index)}-${line}`}>{line}</li>
      ))}
    </ul>
  );
};

const describeConflict = (cause: ConflictCause, lockedAt: string | null | undefined): string => {
  switch (cause) {
    case 'workerLease': {
      const at = formatTime(lockedAt);

      return at === null ? t.retryError.workerLease : t.retryError.workerLeaseAt(at);
    }
    case 'user':
      return t.retryError.user;
    case 'erpSync':
      return t.retryError.erpSync;
  }
};

/**
 * 서버가 준 문구를 그대로 나열한다. **삼키지 않는다** — 화면이 모르는 필드 이름이 와도
 * 그 문구가 사용자에게 남은 유일한 단서다.
 *
 * `NOT_RETRYABLE`만 화면 문구로 바꿔 준다. 서버 문구가 비어 있어도 무엇을 하라는 안내가
 * 남아야 하기 때문이다. 서버가 함께 준 문구가 있으면 그것도 덧붙인다.
 */
const describeValidation = (error: { errors: { code: string; message: string }[] }): string[] => {
  const lines: string[] = [];

  for (const item of error.errors) {
    if (item.code === NOT_RETRYABLE) lines.push(t.retryError.notRetryable);
    if (item.message !== '') lines.push(item.message);
  }

  return lines;
};

const describeError = (error: ApiError, lockedAt: string | null | undefined): BannerContent => {
  switch (error.kind) {
    case 'conflict':
      // 셋 다 다시 조회하면 풀린다 — 워커가 놓거나, 이미 처리된 결과가 목록에 반영된다.
      return { lines: [describeConflict(error.cause, lockedAt)], canReload: true };
    case 'validation': {
      const lines = describeValidation(error);
      const isNotRetryable = error.errors.some((item) => item.code === NOT_RETRYABLE);

      return {
        lines: lines.length > 0 ? lines : [messages.httpError.description],
        // 상태가 달라져 있을 수 있다. 다시 조회해 지금 상태를 확인하는 것이 다음 행동이다.
        canReload: isNotRetryable,
      };
    }
    case 'stateLocked': {
      const serverLines = error.errors
        .map((item) => item.message)
        .filter((message) => message !== '');

      return {
        lines: [messages.stateLocked.description, ...serverLines],
        canReload: false,
      };
    }
    case 'http': {
      if (error.status === 403) {
        return { lines: [messages.httpError.forbidden], canReload: false };
      }

      // 서버 문구는 있을 때만 덧붙인다. 빈 문자열을 그대로 실으면 빈 줄이 생긴다.
      const serverLines =
        error.message === undefined || error.message === '' ? [] : [error.message];

      return { lines: [messages.httpError.description, ...serverLines], canReload: false };
    }
    case 'network':
      return { lines: [messages.httpError.offline], canReload: false };
  }
};

/**
 * 재처리 실패 배너.
 *
 * 공통 저장 배너(`patterns/master`)를 쓰지 않는다 — 그 문구가 「…다시 **저장**하세요」로
 * 고정돼 있는데 이 화면의 쓰기는 저장이 아니라 재처리 요청이라, 사용자에게 무엇을 하라는
 * 것인지 알 수 없는 안내가 된다. 공통 문구를 고치면 화면 셋이 함께 바뀐다.
 */
export const RetryErrorBanner = ({ error, onReload, lockedAt }: RetryErrorBannerProps) => {
  if (error === null) return null;

  const { lines, canReload } = describeError(error, lockedAt);

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="error"
        title={t.retryError.title}
        action={
          canReload && onReload !== undefined ? (
            <Button variant="outlined" size="sm" onClick={onReload}>
              {t.actions.reload}
            </Button>
          ) : undefined
        }
      >
        <BannerLines lines={lines} />
      </AlertBanner>
    </div>
  );
};
