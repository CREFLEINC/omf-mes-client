import { messages } from '@omf-mes/i18n';

import type { BatchResult } from './types';

/**
 * 일괄 재처리 결과를 화면 표시로 옮긴다.
 *
 * 계약이 **부분 실패를 허용한다** — 전체를 되돌리지 않으므로 성공 건수와 실패 건별 사유를
 * 함께 내야 한다. 성공한 것만 알리면 사용자는 실패한 건을 영영 모른다.
 *
 * `failed[].index`는 **보낸 배열에서의 위치**다. 응답 순서로 매기면 엉뚱한 건에 사유가 붙는다.
 * `failed[].key`는 표시의 정본으로 쓰지 않는다 — 우리 리소스에서 무엇이 올지 확정할 수 없다.
 */

const t = messages.integrationSync;

/** 보낸 건 하나. 위치 번호를 되짚는 정본이라 **보낸 순서 그대로** 보관해야 한다. */
export interface RequestedMessage {
  id: number;
  messageKey: string;
}

export interface BatchFailureView {
  /** 표시용 이름. 되짚지 못했으면 그 사실을 밝히는 문구다. */
  label: string;
  /** 건별 사유. 서버가 주지 않았으면 그 사실을 밝히는 문구 하나가 들어 있다. */
  reasons: string[];
}

export interface BatchResultView {
  /** 성공 안내. 성공이 하나도 없으면 null — 전건 실패에 성공 안내를 내면 안 된다. */
  summary: string | null;
  failed: BatchFailureView[];
  /** 창을 닫아도 되는 유일한 경우. 실패가 하나라도 있으면 창에 남겨 사유를 보인다. */
  isAllSucceeded: boolean;
}

const toFailureView = (
  failure: BatchResult['failed'][number],
  requested: readonly RequestedMessage[],
): BatchFailureView => {
  /*
   * ⚠ 목 서버가 실제로 범위 밖 번호를 내려준다(한 건만 보내도 index: 1).
   * 되짚지 못했다고 이 항목을 버리면 실패한 건이 사용자에게 보이지 않는다 — 밝히고 남긴다.
   */
  const target = requested[failure.index];

  const reasons = failure.errors.map((item) => item.message).filter((message) => message !== '');

  return {
    label: target === undefined ? t.batch.unknownItem : target.messageKey,
    reasons: reasons.length > 0 ? reasons : [t.batch.noReason],
  };
};

export const toBatchResultView = (
  result: BatchResult,
  requested: readonly RequestedMessage[],
): BatchResultView => {
  const failed = result.failed.map((failure) => toFailureView(failure, requested));

  const summary = (): string | null => {
    if (result.succeeded === 0) return null;

    return failed.length === 0
      ? t.batch.allSucceeded(result.succeeded)
      : t.batch.partial(result.succeeded, failed.length);
  };

  return { summary: summary(), failed, isAllSucceeded: failed.length === 0 };
};
