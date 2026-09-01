import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { MATERIAL_INPUT_PATH, PRODUCTION_RESULT_PATH, toWorkOrderHref } from './destinations';
import { dateTimeText, hasNoAssignment, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

export interface DetailPaneProps {
  /** 고른 W/O. 아직 고르지 않았으면 `null`. */
  workOrder: WorkOrder | null;
  uomLabel: (uomId: number | undefined) => string;
}

/**
 * 고른 긴급 W/O 의 상세와 **이탈 버튼 둘** — 2단 배치의 **우 칸**.
 *
 * ⭐ **구획의 제목이 곧 W/O 번호다.** 스펙이 이 자리에 「W/O 상세」 같은 이름표가 아니라
 * **번호 자체**를 두었다 — 현장에서 확인해야 하는 것은 「지금 무엇을 들고 있는가」이고,
 * 그것은 손에 든 지시서의 번호와 눈으로 맞춰진다.
 *
 * ⭐ **이 화면은 저장하지 않는다.** 투입과 실적은 정상 경로 화면의 일이고, 여기서 하는 것은
 * 「어느 W/O 로 그 화면에 들어가는가」를 정하는 것뿐이다.
 *
 * ⛔ **고르지 않았을 때 버튼을 감추지 않는다** — 무엇을 하면 열리는지를 사유와 함께 보인다
 * (공유계약 G-2·G-3 의 원리: 「할 수 없다」는 감추지 않고 푸는 방법과 함께 적는다).
 */
export const DetailPane = ({ workOrder, uomLabel }: DetailPaneProps) => {
  const t = messages.emergencyWorkOrderField.detail;
  const handoff = messages.emergencyWorkOrderField.handoff;

  return (
    <section className="pane" aria-label={workOrder === null ? t.title : workOrder.workOrderNo}>
      <h2>
        {workOrder === null ? (
          t.title
        ) : (
          <>
            <Chip status="error" size="sm">
              {messages.emergencyWorkOrderField.list.emergencyBadge}
            </Chip>{' '}
            {workOrder.workOrderNo}
          </>
        )}
      </h2>

      {workOrder === null ? (
        <div className="banner-slot">
          <AlertBanner variant="info">{t.notSelected}</AlertBanner>
        </div>
      ) : (
        <>
          <dl className="pop-detail-list">
            <dt>{t.item}</dt>
            <dd>{itemText(workOrder)}</dd>
            <dt>{t.orderQty}</dt>
            <dd>{`${qtyText(workOrder.orderQty)} ${uomLabel(workOrder.uomId)}`}</dd>
            <dt>{t.releasedAt}</dt>
            <dd>{dateTimeText(workOrder.releasedAt)}</dd>
          </dl>

          {/* 스펙이 값 목록과 경고 사이에 선을 둔다 — 「지시가 무엇인가」와 「어떻게 진행되는가」의 경계다. */}
          <hr />

          {/*
           * ⭐ 통제 우회는 «긴급이면 언제나»다 — 판정은 서버가 유형을 보고 하고 화면은
           *    그 사실을 알린다. 배정 유무와는 다른 축이라 문장을 이어 붙인다.
           */}
          <div className="banner-slot">
            <AlertBanner variant="warning">
              {hasNoAssignment(workOrder)
                ? `${t.noAssignment} ${t.controlBypass}`
                : t.controlBypass}
            </AlertBanner>
          </div>

          {/* 자재가 부족할 때 갈 곳. 이 화면은 안내만 하고 요청을 만들지 않는다. */}
          <p>{t.shortageGuide}</p>
        </>
      )}

      <p>{workOrder === null ? handoff.locked : handoff.lead}</p>

      <div className="pop-handoff">
        {workOrder === null ? (
          <>
            {/*
             * 고르지 않은 동안에도 무엇이 있는지는 보인다 — 잠긴 사유는 바로 위 한 곳에서만
             * 말한다. 구획마다 되풀이하면 한쪽만 고쳐질 때 화면이 스스로와 어긋난다.
             */}
            <Button size="2xl" variant="filled" disabled>
              {handoff.materialInput}
            </Button>
            <Button size="2xl" variant="tonal" disabled>
              {handoff.productionResult}
            </Button>
          </>
        ) : (
          <>
            <Link to={toWorkOrderHref(MATERIAL_INPUT_PATH, workOrder.workOrderId)}>
              <Button size="2xl" variant="filled">
                {handoff.materialInput}
              </Button>
            </Link>
            <Link to={toWorkOrderHref(PRODUCTION_RESULT_PATH, workOrder.workOrderId)}>
              <Button size="2xl" variant="tonal">
                {handoff.productionResult}
              </Button>
            </Link>
          </>
        )}
      </div>
    </section>
  );
};
