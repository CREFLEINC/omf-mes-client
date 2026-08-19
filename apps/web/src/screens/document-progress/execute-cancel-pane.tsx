import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CancelLock } from './cancel-pane';
import { CancelResultPane } from './cancel-result-pane';
import type { CancelExecutionView } from './types';

const t = messages.documentProgress;

export interface ExecuteCancelPaneProps {
  /**
   * ⭐ **실행 버튼이 설 근거 — 「취소 요청이 있는가」다**(계획 §5-2 · 완료 조건 C4-7).
   *
   * 판정은 `approval-progress.ts`의 `hasCancelRequest`가 하고 부품은 결과만 받는다.
   * ⛔ **`cancellable`을 받지 않는다** — 취소 요청이 진행 중이면 서버가 그 값을 거짓으로
   * 내리므로(`CANCEL_IN_PROGRESS`) 그것으로 버튼을 세우면 **실행 버튼이 영영 서지 않는다.**
   * 값을 아예 받지 않는 것이 그 결함을 타입 수준에서 막는다.
   *
   * ⛔ **승인이 끝났는가도 받지 않는다**(완료 조건 C4-8). 잠금의 정본은 서버다.
   */
  hasCancelRequest: boolean;
  /** 잠금 토큰이 어디까지 왔는가. **`ready`가 아니면 `If-Match`가 없어 요청이 나가지 않는다.** */
  lock: CancelLock;
  /**
   * ⭐ **진행 표시의 축 — 이 대상의 실행이 나가는 중인가.** 대상 매임을 지난 값이라 **다른
   * 대상에 보낸 실행의 진행은 여기 오지 않는다**(완료 조건 C4-16).
   */
  isSaving: boolean;
  /** ⭐ **잠금의 축 — 어느 대상이든 취소 조작이 나가는 중인가.** 전역이다. */
  isLocked: boolean;
  /** 실패 배너가 설 자리. **창이 열려 있으면 창이 갖는다** — 자리 배타는 화면이 정한다. */
  banner: ReactNode;
  /** 방금 이 대상에서 끝난 실행의 결과. 없으면 `null`이다. */
  result: CancelExecutionView | null;
  onOpenConfirm: () => void;
}

/**
 * 취소 **실행** 구획 — ⛔ **이 화면에서 되돌릴 수 없는 정도가 가장 큰 조작의 자리다.**
 *
 * ## 이 구획이 지는 세 규율
 *
 * 1. ⭐ **버튼의 근거가 `cancellable`이 아니다**(계획 §5-2). 취소 요청이 진행 중이면 서버가
 *    `cancellable`을 거짓으로 내린다 — 그 값으로 세우면 실행 버튼이 영영 서지 않는다.
 * 2. ⛔ **승인 완료로 잠그지 않는다**(완료 조건 C4-8). 어떤 코드가 승인인지 화면이 모르고
 *    (omf-mes#64), 모르는 것을 「아니다」로 접으면 승인된 건까지 실행할 수 없어진다. 계약이
 *    「승인 전이면 400」이라 적었으므로 **막는 것은 서버다.**
 * 3. ⭐ **잠금 토큰이 200으로 오기 전에는 열리지 않는다.** 계약이 `If-Match`를 필수로 두어,
 *    토큰 없이 열면 눌러도 아무 일이 없는 자리가 된다.
 *
 * ## 요청이 없으면 **잠긴 버튼도 두지 않는다**
 *
 * 이 자리에서 풀 수 있는 잠금이 아니라 위 구획에서 취소 요청을 올려야 풀린다 — 잠긴 버튼을
 * 두면 사용자가 눌러 보다 만다(취소 경로가 없는 유형에 조작을 그리지 않는 것과 같은 규율).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ExecuteCancelPane = ({
  hasCancelRequest,
  lock,
  isSaving,
  isLocked,
  banner,
  result,
  onOpenConfirm,
}: ExecuteCancelPaneProps) => {
  const noteId = useId();

  /**
   * 버튼이 왜 잠겼는지 한 줄.
   *
   * **요청이 없을 때는 `null`이다** — 그 갈래에는 버튼 자체가 없고, 대신 아래에서 무엇을 해야
   * 하는지 문장으로 말한다. 잠긴 손잡이에 붙는 설명과 없는 손잡이를 대신하는 설명은 다른 글이다.
   */
  const blockNote = ((): string | null => {
    if (!hasCancelRequest) return null;
    if (lock.kind === 'preparing') return t.executeCancel.preparing;

    return lock.kind === 'failed' ? t.executeCancel.lockFailedNote : null;
  })();

  return (
    <section className="pane" aria-label={t.executeCancel.label}>
      <p>{t.executeCancel.lead}</p>

      {banner}

      {/*
       * ⭐ **결과가 구획에 남는다.** 되돌릴 수 없는 조작이라 안내 한 줄로 지나가면 무엇이
       * 일어났는지 다시 볼 수 없다 — 원장에 무엇이 생겼는지가 특히 그렇다.
       */}
      {result !== null && <CancelResultPane result={result} />}

      {hasCancelRequest ? (
        <div className="form-actions">
          <div className="field-cell">
            {/*
             * ⚠ **버튼의 생김새로 위험을 말하지 않는다.** 디자인 시스템 `Button`에 파괴적
             * 조작용 변형이 없고(인벤토리 실측 — `filled`·`outlined`·`text`), 색만으로 말하는
             * 것은 어차피 색을 구분하지 못하는 사용자에게 아무 말도 하지 않는다. 무게는
             * **확인 창의 문장**이 진다.
             */}
            <Button
              disabled={lock.kind !== 'ready' || isLocked}
              loading={isSaving}
              aria-describedby={blockNote === null ? undefined : noteId}
              onClick={onOpenConfirm}
            >
              {t.executeCancel.label}
            </Button>
            {blockNote !== null && (
              <span id={noteId} className="field-note">
                {blockNote}
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="field-note">{t.executeCancel.notRequestedNote}</p>
      )}
    </section>
  );
};
