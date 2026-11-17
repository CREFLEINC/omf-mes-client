import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import type { PopScreen } from './pop-screen-catalog';
import { runRequest } from './request';

const t = messages.popChrome.workSteps;

/** 주소의 `workOrderId`. 없거나 숫자가 아니면 `null`. */
export const workOrderIdOf = (search: string): number | null => {
  const raw = new URLSearchParams(search).get('workOrderId');
  const id = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** 단계 줄 오른쪽에 보일 W/O 번호. 못 받으면 `null` — 그때는 번호(#id)로 적는다. */
const useWorkOrderNo = (workOrderId: number | null): string | null => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['pop-work-steps', 'work-order', workOrderId],
    enabled: workOrderId !== null,
    staleTime: 60_000,
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/work-orders/{workOrderId}', {
          params: { path: { workOrderId: workOrderId ?? 0 } },
        }),
      ),
  });
  return query.data?.workOrderNo ?? null;
};

/**
 * 작업 단계 줄(#291 · 사용자 승인 2026-11-17) — 「작업 지시 목록」 탭 아래에 ① 작업지시 선택 › ② 자재 투입 ›
 * ③ 생산 작업 › ④ 생산 포장 을 차례로 보이고, 오른쪽에 고른 W/O 와 작업 중 화면(작업 중단 등) 버튼을 둔다.
 *
 * ⭐ 작업지시를 고르기 전(주소에 `workOrderId` 가 없다)에는 ② 이후와 작업 중 버튼을 잠근다 — 그 화면들은
 *    작업지시 없이 열면 안내만 서고 할 일이 없다. 고른 뒤에는 어느 단계로든 가고 W/O 를 함께 싣는다.
 * ⛔ 각 화면의 [작업 시작]·[다음] 흐름은 바꾸지 않는다 — 이 줄은 «어디쯤인가»와 바로 가는 길만 더한다.
 */
export const PopWorkSteps = ({
  entry,
  steps,
  during,
  pathname,
  search,
  go,
}: {
  /** ① 작업지시 선택 화면(작업 지시 목록). 이 단말이 못 가면 `null`. */
  entry: PopScreen | null;
  steps: readonly PopScreen[];
  during: readonly PopScreen[];
  pathname: string;
  search: string;
  go: (screen: PopScreen) => void;
}) => {
  const workOrderId = workOrderIdOf(search);
  const workOrderNo = useWorkOrderNo(workOrderId);
  const all = entry === null ? steps : [entry, ...steps];
  const hasWorkOrder = workOrderId !== null;

  return (
    <div className="pop-work-steps">
      <ol className="pop-work-steps__list" aria-label={t.label}>
        {all.map((screen, index) => {
          const on = screen.path === pathname;
          const isEntry = screen === entry;
          const locked = !isEntry && !hasWorkOrder;
          return (
            <li key={screen.path} className="pop-work-steps__item">
              {index > 0 && (
                <span className="pop-work-steps__sep" aria-hidden="true">
                  ›
                </span>
              )}
              <button
                type="button"
                className="pop-work-step"
                aria-current={on ? 'step' : undefined}
                data-on={on ? 'true' : undefined}
                disabled={locked}
                onClick={() => {
                  if (!on) go(screen);
                }}
              >
                <span className="pop-work-step__no" aria-hidden="true">
                  {index + 1}
                </span>
                {isEntry ? t.pickWorkOrder : screen.name}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="pop-work-steps__side">
        {hasWorkOrder && (
          <span className="pop-work-steps__wo">{workOrderNo ?? `#${String(workOrderId)}`}</span>
        )}
        {during.map((screen) => (
          <button
            key={screen.path}
            type="button"
            className="pop-work-steps__during"
            aria-current={screen.path === pathname ? 'page' : undefined}
            data-on={screen.path === pathname ? 'true' : undefined}
            disabled={!hasWorkOrder}
            onClick={() => {
              go(screen);
            }}
          >
            {t.during[screen.path] ?? screen.name}
          </button>
        ))}
      </div>
    </div>
  );
};
