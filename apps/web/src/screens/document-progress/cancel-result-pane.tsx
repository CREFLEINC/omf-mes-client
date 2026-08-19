import { messages } from '@omf-mes/i18n';

import { describeLedgerRef, readLedgerRef } from './ledger-ref';
import type { CancelExecutionView } from './types';

const t = messages.documentProgress;

export interface CancelResultPaneProps {
  result: CancelExecutionView;
}

/**
 * 취소 실행 결과 — **`reversed`가 두 문면을 가른다**(완료 조건 C4-12).
 *
 * | `reversed` | 무엇이 사실인가 | 화면이 내는 것 |
 * | :-: | --- | --- |
 * | 참 | 전기된 문서였다 | 「원장에 역트랜잭션이 생겼습니다」 + **번호와 영업일** |
 * | 거짓 | 전기 전이었다 | 「원장에는 아무것도 생기지 않았습니다」 |
 *
 * ⭐ **전기 여부를 화면이 판정하지 않는다.** 서버가 실행하며 함께 내려 준 값이고, 화면이 상태
 * 코드나 수량으로 다시 세면 조용히 틀린다.
 *
 * ⭐ **역트랜잭션 번호는 영업일과 함께 낸다.** 원장 조회는 영업일이 키의 일부라(계약 경로)
 * 번호만 내면 **찾을 수 있는 것처럼 보이는** 값이 화면에 남는다. 짝 판정은 처리 경과의 원장
 * 칸과 **같은 한 곳**(`ledger-ref.ts`)이 한다 — 두 자리가 갈리면 같은 화면이 원장 참조를
 * 두 규칙으로 그린다.
 *
 * ⛔ **원장 진입을 만들지 않는다.** 원장 조회 화면이 이 저장소에 없다(라우트 실측).
 *
 * 기존 디자인 시스템 컴포넌트 없이 배치 클래스만 쓰므로 이 화면 슬라이스가 소유한다.
 */
export const CancelResultPane = ({ result }: CancelResultPaneProps) => (
  <div role="group" aria-label={t.executionResult.label}>
    {/*
     * ⭐ **결과가 성공 배너가 아니다.** 되돌릴 수 없는 조작의 결과라 「저장했습니다」류 한 줄로
     * 지나가면 무엇이 일어났는지 사용자가 다시 볼 수 없다 — 상태와 원장 자취가 화면에 남는다.
     */}
    <p>{result.reversed ? t.executionResult.reversedTitle : t.executionResult.notReversedTitle}</p>

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.executionResult.status}</dt>
        {/* 상태 코드를 **그대로** 낸다 — 값 목록이 공통코드 소관이다. */}
        <dd>{result.statusCode}</dd>
      </div>

      {result.reversed && (
        <div className="field-cell">
          <dt className="field-label">{t.executionResult.ledger}</dt>
          <dd>
            {describeLedgerRef(
              readLedgerRef({
                inventoryTransactionNo: result.reversalTransactionNo,
                businessDate: result.reversalBusinessDate,
              }),
            )}
          </dd>
        </div>
      )}
    </dl>

    {/*
     * 전기 전이었다는 사실을 한 줄 더 밝힌다 — 「아무것도 생기지 않았습니다」만 있으면 실행이
     * 덜 된 것으로 읽힐 수 있는데, 문서 상태는 실제로 바뀌었다.
     */}
    {!result.reversed && <p className="field-note">{t.executionResult.notReversedDescription}</p>}
  </div>
);
