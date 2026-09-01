import { AlertBanner, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { dateTimeText, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';

export interface WorkOrderListProps {
  /** 못 받았으면 `undefined` — 빈 배열과 다른 사실이다. */
  workOrders: WorkOrder[] | undefined;
  /** 목록을 물었는가. 유형 값을 몰라 조회를 열지 않은 상태와 「없다」를 가른다. */
  isAsked: boolean;
  /** 물었고 아직 답이 오지 않았는가. */
  isLoading: boolean;
  /** 필터 전체 건수. 목록이 잘렸는지는 이 값으로만 알 수 있다. */
  total: number | undefined;
  isError: boolean;
  selectedId: number | null;
  uomLabel: (uomId: number | undefined) => string;
  onSelect: (workOrder: WorkOrder) => void;
}

/**
 * 긴급 W/O 목록 구획 — 2단 배치의 **좌 칸**.
 *
 * ⭐ **표가 아니라 카드다.** 좌 칸이 좁아 열 다섯을 세우면 열 이름이 접히고 누를 자리가
 * 잘게 쪼개진다. 장갑 낀 손이 누르는 화면이라 **줄 전체가 하나의 누를 자리**여야 한다.
 *
 * ⛔ **빈 목록을 오류로 다루지 않는다.** 긴급 W/O 는 없는 것이 정상이고, 발행은 관리웹의
 * 몫이다 — 그래서 빈 상태 문구가 「어디서 만들어지는지」까지 말한다.
 *
 * ⛔ **받지 못한 것은 다르다.** 「없다」와 「모른다」를 같은 화면으로 말하면, 조회가 실패한
 * 사이에 긴급 지시가 밀려도 화면이 조용하다.
 *
 * ⛔ **아직 답이 안 온 것과 묻지 않은 것도 「없다」가 아니다.** 값이 비었다는 사실만 보고
 * 「없습니다」를 세우면, 받는 중인 몇 초 동안 현장 작업자가 **긴급 지시가 없다고 읽고 자리를
 * 뜬다.** 유형 값을 몰라 아예 묻지 못한 경우는 더 나쁘다 — 그 단언이 영구히 남는다.
 */
export const WorkOrderList = ({
  workOrders,
  isAsked,
  isLoading,
  total,
  isError,
  selectedId,
  uomLabel,
  onSelect,
}: WorkOrderListProps) => {
  const t = messages.emergencyWorkOrderField.list;

  const rows = workOrders ?? [];
  const isTruncated = total !== undefined && total > rows.length;

  return (
    <section className="pane" aria-label={t.title}>
      <h2>{t.title}</h2>

      {isError ? (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.loadError}</AlertBanner>
        </div>
      ) : (
        <>
          {/*
           * ⛔ 「없다」는 **묻고 답을 받은 뒤에만** 말할 수 있다. 받는 중이거나 묻지 않은
           *    동안에는 아무것도 단언하지 않는다.
           */}
          {rows.length === 0 ? (
            isAsked && !isLoading ? (
              <div className="banner-slot">
                <AlertBanner variant="info">{t.empty}</AlertBanner>
              </div>
            ) : null
          ) : (
            <ul className="pop-card-list" aria-label={t.caption}>
              {rows.map((row) => (
                <li key={String(row.workOrderId)}>
                  <Card
                    interactive
                    bordered
                    surface={selectedId === row.workOrderId ? 'high' : 'low'}
                    aria-label={`${t.select} ${row.workOrderNo}`}
                    aria-pressed={selectedId === row.workOrderId}
                    onClick={() => {
                      onSelect(row);
                    }}
                  >
                    <Card.Body>
                      <p>
                        <Chip status="error" size="sm">
                          {t.emergencyBadge}
                        </Chip>{' '}
                        {row.workOrderNo} · {itemText(row)}
                      </p>
                      <p className="field-note">
                        {`${qtyText(row.orderQty)} ${uomLabel(row.uomId)} · ${t.columns.releasedAt} ${dateTimeText(row.releasedAt)}`}
                      </p>
                    </Card.Body>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {isTruncated && <p>{t.truncated(rows.length, total)}</p>}

          {/*
           * 발행 자리를 여기서 찾지 않게 한다 — 이 화면에는 만드는 액션이 없다.
           * ⭐ 스펙이 ⓘ 를 붙인 자리라 안내 배너로 세운다.
           */}
          {rows.length > 0 && (
            <div className="banner-slot">
              <AlertBanner variant="info">{t.issuedElsewhere}</AlertBanner>
            </div>
          )}
        </>
      )}
    </section>
  );
};
