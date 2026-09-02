import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { dateTimeText, itemText, qtyText } from './row-view';
import type { WorkOrder } from './types';
import { isHeld } from './work-order-status';
import { isEmergency } from './work-order-type';

const t = messages.workStart.list;

export interface WorkOrderListProps {
  /** 못 받았으면 `undefined` — 빈 배열과 다른 사실이다. */
  workOrders: WorkOrder[] | undefined;
  /** 목록을 물었는가. 설비를 몰라 조회를 열지 않은 상태와 「없다」를 가른다. */
  isAsked: boolean;
  isLoading: boolean;
  isError: boolean;
  /** 필터 전체 건수. 목록이 잘렸는지는 이 값으로만 알 수 있다. */
  total: number | undefined;
  /** 전체 보기인가 — 빈 상태 문구가 갈린다. */
  isShowingAll: boolean;
  /** 설비를 몰라 기본 목록을 세우지 못했는가. */
  isEquipmentUnknown: boolean;
  /** 사번 확인 전에는 고를 수 없다. */
  canSelect: boolean;
  selectedId: number | null;
  onSelect: (workOrder: WorkOrder) => void;
  onToggleScope: () => void;
  onRetry: () => void;
}

/**
 * ② 작업지시 목록 구획(스펙 §4 ② · 328px) — **이 화면에서 유일하게 스크롤하는 자리**다(E-4).
 *
 * ⭐ **표가 아니라 카드다**(§7 「`Table` 아님 — 터치 타겟 64px↑」). 장갑 낀 손이 누르는
 * 화면이라 **줄 전체가 하나의 누를 자리**여야 한다.
 *
 * ⛔ **빈 목록을 오류로 다루지 않는다.** 이 설비에 배포된 지시가 없는 것은 정상이고, 그때
 * 문구가 「전체 보기」라는 다음 행동까지 말한다.
 *
 * ⛔ **「없다」와 「모른다」를 같은 화면으로 말하지 않는다.** 받는 중이거나 묻지 못한 동안
 * 「없습니다」를 세우면, 그 몇 초 사이에 작업자가 지시가 없다고 읽고 자리를 뜬다.
 */
export const WorkOrderList = ({
  workOrders,
  isAsked,
  isLoading,
  isError,
  total,
  isShowingAll,
  isEquipmentUnknown,
  canSelect,
  selectedId,
  onSelect,
  onToggleScope,
  onRetry,
}: WorkOrderListProps) => {
  const rows = workOrders ?? [];
  const isTruncated = total !== undefined && total > rows.length;

  return (
    <section className="pane work-start-list" aria-label={t.title}>
      <div className="work-start-list-head">
        <h2 className="pane-title">
          {t.title} · {isShowingAll ? t.scopeAll : t.scopeEquipment}
        </h2>

        {/* 「전체 보기」는 조회 축 하나를 뺄 뿐이다 — 다른 조건은 그대로다(§5-5). */}
        <Button type="button" variant="outlined" size="xl" onClick={onToggleScope}>
          {isShowingAll ? t.showEquipmentOnly : t.showAll}
        </Button>
      </div>

      {/*
       * ⚠ **버튼 이름만으로는 무엇이 열리는지 읽히지 않는다**(사용자 확인 실측). 지금 무엇이
       *    보이고 있고 누르면 무엇이 늘어나는지를 한 줄로 말한다 — 배너가 아니라 보조 문구다:
       *    경고가 아니라 «현재 상태»라서 배너로 세우면 세로 예산을 먹고 경고와 섞인다.
       */}
      <p className="field-note work-start-scope-note">
        {isShowingAll ? t.scopeNoteAll : t.scopeNoteEquipment}
      </p>

      {/*
       * ⚠ 설비를 몰라 기본 목록을 못 세운 상태는 **빈 목록이 아니다.** 사유와 다음 행동을
       *    함께 보인다 — 그러지 않으면 「이 설비에 지시가 없다」로 읽힌다.
       */}
      {isEquipmentUnknown && !isShowingAll && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.equipmentUnknown}</AlertBanner>
        </div>
      )}

      {!canSelect && (
        <div className="banner-slot">
          <AlertBanner variant="info">{messages.workStart.worker.required}</AlertBanner>
        </div>
      )}

      {isError ? (
        <div className="banner-slot">
          <AlertBanner variant="error">
            {t.loadError}{' '}
            <Button type="button" variant="text" size="lg" onClick={onRetry}>
              {t.retry}
            </Button>
          </AlertBanner>
        </div>
      ) : (
        <>
          {rows.length === 0 ? (
            /* ⛔ 「받는 중」과 「없다」를 같은 화면으로 말하지 않는다 — 네 갈래를 다 적는다. */
            isLoading ? (
              <div className="banner-slot">
                <AlertBanner variant="info">{t.loading}</AlertBanner>
              </div>
            ) : isAsked ? (
              <div className="banner-slot">
                <AlertBanner variant="info">{isShowingAll ? t.emptyAll : t.empty}</AlertBanner>
              </div>
            ) : null
          ) : (
            <ul className="pop-card-list" aria-label={t.caption}>
              {rows.map((row) => {
                const isHeldRow = isHeld(row);

                return (
                  <li key={String(row.workOrderId)}>
                    <Card
                      interactive
                      bordered
                      surface={selectedId === row.workOrderId ? 'high' : 'low'}
                      aria-label={`${t.select} ${row.workOrderNo}`}
                      aria-pressed={selectedId === row.workOrderId}
                      /*
                       * ⛔ **`aria-disabled` 로 두지 않는다.** 디자인 시스템의 `Card` 는
                       *    `interactive` 일 때 자기 `aria-disabled` 를 «나중에» 얹어 밖에서
                       *    넘긴 값을 지운다 — 잠긴 카드가 스크린리더에 평범한 버튼으로
                       *    읽히고 탭 순서에도 남는다. 사유 배너는 눈으로 보는 사람에게만
                       *    닿으므로, 못 누른다는 사실이 컨트롤 자신에도 있어야 한다.
                       *    `disabled` 를 넘기면 `Card` 가 스스로 `aria-disabled="true"` 와
                       *    `tabindex="-1"` 을 얹는다 — `interactive` 인 `Card` 는 `button` 이
                       *    아니라 `div[role="button"]` 이라 그 길로만 잠긴다.
                       */
                      disabled={!canSelect}
                      onClick={() => {
                        /* 눌릴 수 없지만 남겨 둔다 — 카드가 비-interactive 가 되면 이 가드만 남는다. */
                        if (!canSelect) return;

                        onSelect(row);
                      }}
                    >
                      <Card.Body>
                        <p>
                          {isEmergency(row) && (
                            <>
                              <Chip status="error" size="sm">
                                {t.emergencyBadge}
                              </Chip>{' '}
                            </>
                          )}
                          {/*
                           * ⏸ 중단 배지. ⚠ **상태 코드 문자열이 확정되기 전에는 서지 않는다** —
                           *    판정은 `work-order-status.ts` 한 곳이 하고, 값이 통지되면 그
                           *    파일만 고치면 이 배지와 [재개] 가 함께 켜진다.
                           */}
                          {isHeldRow && (
                            <>
                              <Chip status="warning" size="sm">
                                {t.heldBadge}
                              </Chip>{' '}
                            </>
                          )}
                          {row.workOrderNo} · {itemText(row)}
                        </p>
                        <p className="field-note">
                          {`${qtyText(row.orderQty)} · ${t.columns.plannedStart} ${dateTimeText(
                            row.plannedStartAt,
                          )} · ${t.columns.priority} ${String(row.priorityNo)}`}
                        </p>
                      </Card.Body>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          {isTruncated && <p className="field-note">{t.truncated(rows.length, total)}</p>}
        </>
      )}
    </section>
  );
};
