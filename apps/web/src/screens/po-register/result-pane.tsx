import { AlertBanner, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { CreatedPoView } from './types';

const t = messages.poRegister;

export interface ResultPaneProps {
  created: CreatedPoView;
}

/**
 * 등록 결과 — **화면이 확인한 것만 말한다.**
 *
 * | 말한다 | 말하지 않는다 |
 * | --- | --- |
 * | 「발주 전표 `SAMPLE-PO-…`를 만들었습니다」 · 서버가 준 **상태 코드 그대로** · 서버가 저장한 줄 수 | 「발주가 확정됐습니다」 — 상태의 뜻을 화면이 옮겨 적지 않는다(공유계약 G-2) |
 * | ERP 발주번호가 **비어 있다는 사실**과 언제 채워지는지 | 「ERP 연계에 실패했습니다」 — 아직 매칭 시점이 아닌 것과 실패는 다른 사실이다(`omf-mes#72`) |
 * | — | **승인 요청 버튼** — 등록과 상신은 별개 동작이고 상신은 뒤따르는 회차가 붙인다(계획 결정 9) |
 * | — | **결재 대기 목록·진행 단계** — 결재함이 정본이다(계획 결정 11) |
 *
 * **사라지는 알림으로 내지 않는다.** 전표번호는 적어 두거나 옮겨 적는 값이라 몇 초 뒤에
 * 없어지면 안 된다 — 배너가 살아 있는 영역으로 알리되(디자인 시스템이 `success`에 `status`를
 * 준다) 글자는 화면에 남는다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResultPane = ({ created }: ResultPaneProps) => (
  <section className="pane" aria-label={t.result.label}>
    <AlertBanner variant="success" title={t.result.createdTitle(created.purchaseOrderNo)}>
      {t.result.createdDescription}
    </AlertBanner>

    {/*
     * **이름 하나에 값 하나로 짝을 맞춘다.** `<dt>` 하나 뒤의 `<dd>`는 전부 그 이름의 값이라,
     * 상태 칩을 전표번호 아래에 그대로 두면 보조기술이 「전표번호: SAMPLE-PO-…, SAMPLE_…」로
     * 읽는다 — 이름 없는 값이 아니라 **틀린 이름이 붙은 값**이 된다.
     */}
    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.result.purchaseOrderNo}</dt>
        <dd>{created.purchaseOrderNo}</dd>
      </div>
      <div className="field-cell">
        {/*
         * **어느 시점의 값인지를 라벨이 밝힌다.** 이 코드는 전표를 만들 때 서버가 준 것이고
         * 그 뒤 상신·승인으로 달라진다 — 지금 상태를 여기서 다시 읽어 오지 않는 이유는
         * 그러면 이 구획이 상세 조회에 매여 **치던 값이 사라지는 축**(`omf-mes#43`)이 하나 늘기
         * 때문이다.
         */}
        <dt className="field-label">{t.result.createdStatusCode}</dt>
        <dd>
          <Chip variant="status" size="sm">
            {created.statusCode}
          </Chip>
        </dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.result.erpPurchaseOrderNo}</dt>
        <dd>
          {created.erpPurchaseOrderNo === null ? (
            <Chip variant="status" status="warning" size="sm">
              {t.result.erpUnmatched}
            </Chip>
          ) : (
            created.erpPurchaseOrderNo
          )}
        </dd>
      </div>
    </dl>

    {/* 비어 있는 사정은 **비어 있을 때만** 적는다 — 채워진 뒤에도 남기면 값이 의심스러워 보인다. */}
    {created.erpPurchaseOrderNo === null && (
      <p className="field-note">{t.result.erpUnmatchedNote}</p>
    )}

    <p>{t.result.lineCount(created.lineCount)}</p>
  </section>
);
