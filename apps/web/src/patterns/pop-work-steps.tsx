import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useApiClient } from './api-context';
import type { PopScreen } from './pop-screen-catalog';
import { ApiRequestError, runRequest } from './request';

const t = messages.popChrome.workSteps;

/** 주소의 `workOrderId`. 없거나 숫자가 아니면 `null`. */
export const workOrderIdOf = (search: string): number | null => {
  const raw = new URLSearchParams(search).get('workOrderId');
  const id = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** 박스 제목에 W/O 를 이미 보이는 화면 — 단계 줄에는 번호를 겹쳐 적지 않는다(사용자 지시 2026-11-17). */
const WO_IN_PANE: ReadonlySet<string> = new Set(['/pop/material-input', '/pop/production-result']);

/** 작업 중 화면을 열 수 없는 W/O 상태 — 생산 작업 화면이 마감 W/O 에 [작업 중단]을 두지 않던 것과 같다. */
const ENDED_STATUSES: ReadonlySet<string> = new Set(['CLOSED', 'CANCELLED']);

/**
 * W/O 상세를 «거절·없음»으로 답한 상태 코드. 서버는 POP 단말에 열린(배포됨·미완료·미마감·미취소) W/O 상세만
 * 보인다(단말 읽기 규칙) — 마감된 W/O 는 상태값 대신 이 답이 온다. 작업 중 화면도 그 W/O 를 다룰 수 없다.
 */
const NOT_OPEN_HTTP: ReadonlySet<number> = new Set([401, 403, 404]);

interface StepWorkOrder {
  /** 단계 줄 오른쪽에 보일 W/O 번호. 못 받으면 `null` — 그때는 번호(#id)로 적는다. */
  workOrderNo: string | null;
  /** 마감·취소됐거나 서버가 열린 W/O 로 보이지 않는가. 연결이 안 돼 모르면(오프라인 등) `false` — 모른다고 막지 않는다. */
  isEnded: boolean;
}

const useStepWorkOrder = (workOrderId: number | null): StepWorkOrder => {
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
  return {
    workOrderNo: query.data?.workOrderNo ?? null,
    isEnded:
      ENDED_STATUSES.has(query.data?.statusCode ?? '') ||
      (query.error instanceof ApiRequestError && NOT_OPEN_HTTP.has(query.error.httpStatus ?? 0)),
  };
};

/**
 * 작업 단계 줄(#291 · 사용자 승인 2026-11-17) — 「작업 지시 목록」 탭 아래에 ① 작업지시 선택 › ② 자재 투입 ›
 * ③ 생산 작업 을 차례로 보이고(④ 생산 포장은 omf-all-around#293 에서 없앴다), 오른쪽에 고른 W/O 와 작업 중 화면(작업 중단 등) 버튼을 둔다.
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
}): ReactNode => {
  const workOrderId = workOrderIdOf(search);
  const showWorkOrder = workOrderId !== null && !WO_IN_PANE.has(pathname);
  const { workOrderNo, isEnded } = useStepWorkOrder(workOrderId);
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
        {showWorkOrder && (
          <span className="pop-work-steps__wo">{workOrderNo ?? `#${String(workOrderId)}`}</span>
        )}
        {during.map((screen) => (
          <button
            key={screen.path}
            type="button"
            className="pop-work-steps__during"
            aria-current={screen.path === pathname ? 'page' : undefined}
            data-on={screen.path === pathname ? 'true' : undefined}
            disabled={!hasWorkOrder || isEnded}
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
