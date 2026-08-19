import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { DocumentSuccessorView } from './types';

const t = messages.documentProgress;

export interface BlockedExecutionPaneProps {
  /**
   * **다시 부른** 진행현황 상세의 후속 목록. 화면이 세지 않고 서버가 준 배열을 그대로 받는다 —
   * 어느 문서가 후속인지는 서버가 판정한다(공유계약 A-10 보강 · 이 화면의 첫째 금지).
   */
  successors: readonly DocumentSuccessorView[];
}

/**
 * 실행 400 중 **후속 때문에 막힌** 갈래 전용 구획 (완료 조건 C4-13 · 계획 §3 ⓔ).
 *
 * ## 이 구획이 지는 두 규율
 *
 * 1. ⭐ **승인은 그대로 유효하다고 말한다.** 계약이 그렇게 적었다(공유계약 J-8) — 막힌 것은
 *    실행이고 요청은 살아 있다. 이것을 말하지 않으면 사용자는 요청이 무산된 줄 안다.
 * 2. ⛔ **「다시 요청하세요」류 권유를 하지 않는다.** 화면이 새 요청을 권하면 사용자가 **같은
 *    승인을 두 번** 받게 되고, 그 사이 원본 요청은 진행 중인 채 남는다. 할 일은 하나뿐이다 —
 *    **후속을 먼저 취소한다.**
 *
 * ## 왜 후속을 여기서 다시 보이는가
 *
 * 위 후속 목록 표는 실패한 뒤 **다시 불린** 값을 그린다(화면이 진행현황을 무효화한다). 그러나
 * 그 표는 화면 위쪽이라, 실패한 자리에서 「무엇이 걸렸는지」를 보려면 사용자가 되돌아가 찾아야
 * 한다. 그래서 **걸린 문서번호만** 이 자리에 한 줄씩 적는다 — 표를 다시 그리지 않는 이유는
 * 같은 자료를 두 표로 그리면 어느 것이 최신인지 화면이 스스로 흐리기 때문이다.
 *
 * ⚠ **다시 부른 목록이 비어 있는 갈래를 감추지 않는다.** 서버는 후속 때문이라 했는데 목록에는
 * 아직 없을 수 있다(두 조회의 시점이 다르다). 목록을 지어내지 않고 **어긋났다는 사실 자체를**
 * 적는다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const BlockedExecutionPane = ({ successors }: BlockedExecutionPaneProps) => (
  <div className="banner-slot">
    <AlertBanner variant="error" title={t.blockedExecution.title}>
      <p>{t.blockedExecution.description}</p>

      {successors.length === 0 ? (
        <p>{t.blockedExecution.successorsEmpty}</p>
      ) : (
        <>
          <p>{t.blockedExecution.successorsLabel}</p>
          <ul>
            {successors.map((successor) => (
              /*
               * **키가 내부 번호다** — 후속 문서번호가 유일하다는 보장이 계약에 없다. 이 값은
               * React key로만 쓰이고 화면에 나오지 않는다.
               */
              <li key={successor.successorId}>
                {t.blockedExecution.successorLine(
                  successor.successorNo,
                  successor.successorTypeCode,
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </AlertBanner>
  </div>
);
