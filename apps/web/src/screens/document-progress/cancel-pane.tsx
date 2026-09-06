import { Button, EmptyState, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { describeCancelBlockReason, type CancelAvailability } from './cancel-availability';
import { describeLoadError } from './load-error-banner';
import { isCancelResourceForbidden, isCancelResourceNotFound } from './queries';
import { toApiError } from '../../patterns/request';

const t = messages.documentProgress;

/**
 * 잠금 토큰이 어디까지 왔는가 — **세 갈래다.**
 *
 * | 갈래 | 무엇이 사실인가 | 요청 버튼 |
 * | --- | --- | :-: |
 * | `preparing` | 리소스 상세를 부르는 중 | 잠긴다 |
 * | `ready` | 200이 왔고 토큰이 앉았다 | **열린다**(서버 판정이 허락할 때) |
 * | `failed` | 못 읽었다 | 잠긴다 |
 *
 * ⭐ **이 축은 「서버가 취소를 허락하는가」와 다른 축이다.** 토큰이 준비돼도 서버가 막았으면 못
 * 올리고, 서버가 허락해도 토큰이 없으면 요청이 나가지 않는다 — 그래서 둘을 한 값으로 뭉개지 않고
 * 사유도 각각 낸다(풀 수 있는 사람이 다르다: 서버 판정은 업무가, 토큰 실패는 권한·연결이 푼다).
 */
export type CancelLock =
  { kind: 'preparing' } | { kind: 'ready' } | { kind: 'failed'; error: unknown };

export interface CancelPaneProps {
  /**
   * 이 유형에 취소 경로가 있는가. **판정은 유형 표가 한다**(`cancelTargetOf`) — 부품은 결과만
   * 받는다. 리소스 값 자체를 넘기지 않는 이유는 부품이 그 값으로 분기할 길을 아예 두지 않기
   * 위해서다(리소스를 고르는 자리는 `queries.ts` 한 곳이다).
   */
  hasCancelResource: boolean;
  /** 서버가 판정한 취소 요청 가능 여부. **목록 열과 같은 자리**에서 나온다. */
  availability: CancelAvailability;
  lock: CancelLock;
  reason: string;
  /** 사유 칸 아래 서는 오류. 화면이 잡은 것과 서버가 준 것이 **같은 칸에** 붙는다. */
  reasonError?: string;
  /**
   * ⭐ **진행 표시의 축 — 이 대상의 요청이 나가는 중인가.** 대상 매임을 지난 값이라 **다른
   * 대상에 보낸 요청의 진행은 여기 오지 않는다.** 잠금 축과 갈라 두는 이유는, 진행 표시를
   * 전역 잠금으로 재면 **손대지도 않은 문서가 「요청 중」이라고 말하기** 때문이다.
   */
  isSaving: boolean;
  /**
   * ⭐ **잠금의 축 — 어느 대상이든 취소 요청이 나가는 중인가.** 전역이다. 화면 바깥의 주소 이동
   * (뒤로가기·주소 직접 편집)은 화면의 잠금 문을 지나지 않아 **나가는 중에도 대상이 바뀔 수
   * 있는데**, 그때 이 축이 없으면 앞 요청이 끝나기 전에 **둘째 요청이 나간다**.
   */
  isLocked: boolean;
  /** 실패 배너가 설 자리. **창이 열려 있으면 창이 갖는다** — 자리 배타는 화면이 정한다. */
  banner: ReactNode;
  onChangeReason: (value: string) => void;
  onOpenConfirm: () => void;
  onRetryLock: () => void;
}

interface LockFailureProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * 잠금 토큰을 못 읽었을 때 — **세 갈래다.**
 *
 * | 갈래 | 화면이 하는 말 | 「다시 시도」 |
 * | :-: | --- | :-: |
 * | **403** | 「취소를 준비할 권한이 없습니다」 | **없다** |
 * | **404** | 「취소할 문서를 찾지 못했습니다」 | 있다 |
 * | 그 밖(네트워크·5xx) | 「준비하지 못했습니다」 + 서버 문구 | 있다 |
 *
 * ⭐ **어느 갈래에서도 화면 배너를 세우지 않는다.** 이 구획 안에서만 말한다 — 취소를 준비하지
 * 못한 것과 진행현황을 읽지 못한 것은 다른 일이고, 실패한 것은 취소 축 하나뿐이다. 화면 전체를
 * 덮으면 사용자가 읽을 수 있는 경과·후속까지 잃는다(전례 `disposal-issue/approval-progress-pane`).
 *
 * **403에만 「다시 시도」를 내지 않는다.** 같은 권한으로 다시 불러도 같은 답이 온다 — 누를 수
 * 있는 조치를 주면 사용자를 헛돌게 하고 해야 할 일(담당자 문의)을 가린다.
 */
const LockFailure = ({ error, onRetry }: LockFailureProps) => {
  const forbidden = isCancelResourceForbidden(error);
  const notFound = isCancelResourceNotFound(error);

  const title = ((): string => {
    if (forbidden) return t.cancelRequest.lockForbiddenTitle;

    return notFound ? t.cancelRequest.lockNotFoundTitle : t.cancelRequest.lockFailedTitle;
  })();

  const description = ((): string => {
    if (forbidden) return t.cancelRequest.lockForbiddenDescription;

    return notFound
      ? t.cancelRequest.lockNotFoundDescription
      : describeLoadError(toApiError(error));
  })();

  return (
    <>
      <EmptyState
        size="sm"
        live
        title={title}
        description={description}
        action={
          forbidden ? undefined : (
            <Button variant="outlined" onClick={onRetry}>
              {messages.common.retry}
            </Button>
          )
        }
      />
      {/* 못 읽어도 이 문서로 할 수 있는 다른 일은 달라지지 않는다. */}
      <p className="field-note">{t.cancelRequest.lockFailedNote}</p>
    </>
  );
};

/**
 * 취소 요청 구획 — **취소를 승인에 올리는 자리다.**
 *
 * ## 이 구획이 지는 세 규율
 *
 * 1. ⛔ **취소 경로가 없는 유형에는 조작을 그리지 않는다**(완료 조건 C3-1). 잠긴 버튼도 두지
 *    않는다 — 어떤 문서로도 풀리지 않는 잠금이라 사용자가 눌러 보다 만다. 대신 **왜 없는지**를
 *    글자로 밝힌다: 값이 정해지면 이 자리에 취소가 선다.
 * 2. ⭐ **잠금 토큰이 200으로 오기 전에는 요청 버튼이 열리지 않는다**(C3-3). 계약이 `If-Match`를
 *    필수로 두어, 토큰 없이 열면 눌러도 아무 일이 없는 자리가 된다.
 * 3. ⭐ **막힌 사유를 화면이 다시 판정하지 않는다**(C3-2). 「지금 취소 요청을 낼 수 있는가」는
 *    서버가 후속·전기·진행 중 요청을 함께 보고 내린 값이고, 문면을 고르는 자리는 목록 열과
 *    **같은 하나**다(`cancel-availability.ts`).
 *
 * ## 사유 칸을 언제 잠그는가 — **잠금 축이 아니라 「이 문서로 보낼 수 있는가」로 가른다**
 *
 * | 상태 | 칸 | 왜 |
 * | --- | :-: | --- |
 * | 서버가 막았다(`blocked`) | **잠근다** | **이 문서로는 못 보낸다.** 칠 수 있는데 보낼 수 없는 칸은 사용자가 쓴 글을 버리게 만든다 |
 * | 토큰을 기다린다(`preparing`) | 연다 | 곧 풀린다 — 그 사이에 쳐 두는 것이 이롭다 |
 * | 토큰을 못 읽었다(`failed`) | **연다** | 화면이 아직 준비하지 못한 것이지 **이 문서로 못 보내는 것이 아니다.** 다시 시도·권한 부여·대상 재선택으로 풀리면 **적어 둔 글을 그대로** 보낸다 — 그때 칸을 잠갔다면 사용자는 같은 글을 다시 친다. 보낼 수 없다는 사실은 **버튼 잠금과 실패 구획**이 이미 말한다 |
 *
 * ⛔ **`isLocked`(나가는 중)와 섞지 않는다.** 그쪽은 **잠깐** 지나가는 사실이고 위 표는 **이 문서의
 * 성질**이다 — 한 값으로 뭉개면 잠깐 잠긴 것과 영영 못 보내는 것이 같은 모양이 된다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const CancelPane = ({
  hasCancelResource,
  availability,
  lock,
  reason,
  reasonError,
  isSaving,
  isLocked,
  banner,
  onChangeReason,
  onOpenConfirm,
  onRetryLock,
}: CancelPaneProps) => {
  const reasonId = useId();
  const blockNoteId = `${reasonId}-block`;

  if (!hasCancelResource) {
    return (
      <section className="pane" aria-label={t.cancelRequest.label}>
        <EmptyState
          size="sm"
          title={t.cancelRequest.unsupportedTitle}
          description={t.cancelRequest.unsupportedDescription}
        />
      </section>
    );
  }

  const isBlocked = availability.kind === 'blocked';
  const canRequest = !isBlocked && lock.kind === 'ready';

  /**
   * 버튼이 왜 잠겼는지 한 줄.
   *
   * **서버 판정을 먼저 낸다** — 그것이 참이면 토큰이 준비돼도 올릴 수 없어, 사용자가 기다려서
   * 풀리는 일이 아니다. 토큰 실패는 이 줄이 아니라 **자기 구획**(`LockFailure`)이 말한다:
   * 거기에는 「다시 시도」가 붙고 이 줄에는 붙일 수 없다.
   */
  const blockNote = ((): string | null => {
    if (isBlocked) return t.cancelRequest.blocked(describeCancelBlockReason(availability));

    return lock.kind === 'preparing' ? t.cancelRequest.preparing : null;
  })();

  return (
    <section className="pane" aria-label={t.cancelRequest.label}>
      <p>{t.cancelRequest.lead}</p>

      {banner}

      {lock.kind === 'failed' && <LockFailure error={lock.error} onRetry={onRetryLock} />}

      <div className="field-cell">
        <TextField
          fullWidth
          label={t.cancelRequest.reason}
          value={reason}
          placeholder={t.cancelRequest.reasonPlaceholder}
          helperText={t.cancelRequest.reasonHelper}
          disabled={isBlocked || isLocked}
          error={reasonError}
          onChange={(event) => {
            onChangeReason(event.target.value);
          }}
        />
      </div>

      <div className="form-actions">
        <div className="field-cell">
          <Button
            disabled={!canRequest || isLocked}
            loading={isSaving}
            aria-describedby={blockNote === null ? undefined : blockNoteId}
            onClick={onOpenConfirm}
          >
            {t.cancelRequest.label}
          </Button>
          {blockNote !== null && (
            <span id={blockNoteId} className="field-note">
              {blockNote}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
