import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ActivationAction, ActivationIntent } from './activation-guard';
import { DisabledAction } from './disabled-action';

const t = messages.putawayRule;

export interface ActivationPaneProps {
  /**
   * 손잡이의 지금 상태 — **막힘과 사유가 한 값으로 온다**(`activation-guard.ts`).
   *
   * 「어느 전환인가」와 「막혔는가」를 따로 받지 않는다: 따로 받으면 이 구획이 사유를 한 벌 더
   * 갖게 되고, 그 사본은 판정이 바뀌는 날 조용히 갈린다. `intent`가 `null`인 `blocked`가
   * **상세 미도착**이며 그때 중립 이름이 선다.
   */
  action: ActivationAction;
  /**
   * 전환 실패 표시 슬롯. **창이 닫혀 있을 때만 값이 온다**(자리 배타 — `screen.tsx`).
   *
   * ⭐ 이 자리가 없으면 **전송 중 창이 닫힌 뒤 도착한 실패가 화면 어디에도 서지 않는다.**
   * Escape는 막을 수 없으므로 그 갈래는 실재하고, 그때 사용자가 다음에 하는 조작이 정확히
   * 금지된 조작(같은 버튼 다시 누르기 → 새 멱등 키로 이중 전송)이다.
   */
  banner: ReactNode;
  /** 활성 중복을 판정하지 못했다는 안내(켜기 갈래). **막지 않는다** — 계약이 다시 검사한다. */
  duplicateUnknownNote: string | null;
  /**
   * **막을 것 — 전역이다**(공유계약 G-30). 어느 요청이든 나가는 중이면 새 전환을 시작할 수 없다.
   */
  isLocked: boolean;
  /**
   * **가릴 것 — 지금 이 대상의 전환인가.** 진행 표시는 자기 요청에만 돈다 —
   * 남의 요청으로 스피너를 돌리면 화면이 손댄 적 없는 규칙을 「전환 중」이라고 말한다.
   */
  isSaving: boolean;
  /** 그리고 있던 갈래를 그대로 돌려준다 — 버튼이 말한 것과 창이 여는 것이 갈리지 않는다. */
  onStart: (intent: ActivationIntent) => void;
}

/**
 * 손잡이의 이름. **상태를 모를 때는 중립 이름이다** — 사용 여부를 모르는데 「다시 사용」을
 * 세우면 화면이 확인하지 않은 상태를 단언하고, 그대로 누르면 이미 켜진 규칙에 `:activate`가
 * 나가 400이 된다.
 */
const labelOf = (intent: ActivationIntent | null): string => {
  if (intent === null) return t.actions.activation;

  return intent === 'deactivate' ? messages.common.deactivate : t.actions.activate;
};

/**
 * 사용 전환 구획 — **끄기·켜기 손잡이 하나가 사는 자리.**
 *
 * ## 왜 폼 구획 안이 아닌가
 *
 * 1. **초안이 서기 전에도 자리가 있어야 한다.** 잠금 토큰은 상세 응답에서만 오므로(위험 R2)
 *    상세가 도착하기 전에는 전환을 낼 수 없는데, 그 사실을 말할 자리가 폼 안에만 있으면
 *    **폼이 서기 전까지 화면이 아무 말도 하지 못한다.** 사용자는 손잡이를 찾다 만다.
 * 2. **전환은 폼 저장과 다른 오퍼레이션이다.** 폼은 다섯 필드를 통째로 교체하고, 전환은
 *    본문 없이 사용 여부만 뒤집는다 — 겨누는 값도 다르다(폼 초안이 아니라 **서버 값**).
 * 3. 폼은 대상이 풀리면 닫히지만 전환의 잠금은 요청이 끝날 때까지 남는다.
 *
 * ## 지금 상태에서 할 수 있는 쪽 **하나만** 낸다
 *
 * 둘을 함께 두면 지금 켜져 있는지 꺼져 있는지가 버튼에서 읽히지 않는다. 상태를 아직 모를
 * 때(`intent === null`)만 중립 이름이 서고, 그것도 **비활성으로만** 선다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ActivationPane = ({
  action,
  banner,
  duplicateUnknownNote,
  isLocked,
  isSaving,
  onStart,
}: ActivationPaneProps) => {
  const label = labelOf(action.intent);

  /**
   * 액션 자리의 네 상태. **잠금에서 오는 비활성에는 반드시 사유가 붙는다**(배치 규범 4).
   *
   * 순서가 뜻을 정한다 — **내 요청(진행 표시) → 남의 요청(잠금 사유) → 막힌 사유 → 열림**.
   * 내 요청을 앞에 두지 않으면 버튼을 누른 순간 「앞선 요청을 기다리는 중」이라는, 자기 자신을
   * 가리키는 사유가 선다. 잠금을 막힌 사유보다 앞에 두지 않으면 고칠 수 없는 것을 고치라고 시킨다.
   */
  const actionSlot = (): ReactNode => {
    if (isSaving) {
      return (
        <Button variant="outlined" disabled loading>
          {label}
        </Button>
      );
    }

    if (isLocked) {
      return <DisabledAction label={label} reason={t.actionReasons.activationLockedByOtherSave} />;
    }

    if (action.kind === 'blocked') {
      return <DisabledAction label={label} reason={action.reason} />;
    }

    return (
      <Button
        variant="outlined"
        onClick={() => {
          onStart(action.intent);
        }}
      >
        {label}
      </Button>
    );
  };

  return (
    <section className="pane" aria-label={t.panes.activation}>
      {banner}
      <div className="form-actions">{actionSlot()}</div>
      {duplicateUnknownNote !== null && <p className="field-note">{duplicateUnknownNote}</p>}
    </section>
  );
};
