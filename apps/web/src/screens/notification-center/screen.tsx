import { Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { withPeriod } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { NotificationCard } from './notification-card';
import { defaultPeriod, readPeriod, resolvePeriod, type NotificationPeriod } from './period';
import { useNotificationList } from './queries';
import type { NotificationView } from './types';

const t = messages.notificationCenter;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: NotificationView[] = [];

/**
 * W-CO-03 알림센터 — 사용자가 **자기가 받은 알림을 기간으로 찾아 보는** 자리.
 *
 * ⭐ **이 화면이 다른 조회 화면과 가장 크게 갈리는 자리는 기간이다.** 계약이 기간을 필수로
 * 두어(공유계약 L-3) 「조건 없이 일단 조회한다」가 성립하지 않는다. 그래서 저장소의 조회형
 * 골격이 규율로 세운 **「기본 기간을 심지 않는다」가 여기서는 거짓**이고, 심지 않으면 첫
 * 진입이 곧 400이다. 무엇을 왜 뒤집었는지는 `period.ts` 머리의 표에 있다.
 *
 * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
 *
 * | # | 조작 | `from`·`to` | 왜 |
 * | :-: | --- | --- | --- |
 * | 1 | 첫 진입(주소에 기간 없음) | **기본 7일을 심는다** | 기간이 없으면 조회 자체가 되지 않는다. 사용자가 잘못한 것이 없다 |
 * | 2 | 손으로 고친 깨진 기간 | **그대로 둔다** | 조용히 덮으면 무엇이 왜 달라졌는지 화면 어디에도 없다. 사유를 보이고 조회하지 않는다 |
 *
 * **비우는 자리가 하나도 없다** — 기간은 이 화면에서 풀 수 없는 조건이다. 조건이 늘어나는
 * 회차(안 읽음·유형·쪽)가 이 표에 행을 먼저 더한다.
 *
 * ⛔ **자동 갱신을 두지 않는다**(공유계약 L-6). 상단 바의 종 배지는 셸의 책임이라 이 화면이
 * 만들지 않는다.
 */
export const NotificationCenterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가
   * 달라, 이 값을 의존성에 둔 계산이 부모가 다시 그려질 때마다 다시 돈다.
   */
  const period = useMemo<NotificationPeriod>(() => readPeriod(searchParams), [searchParams]);

  /*
   * 실행 환경의 「지금」을 한 번만 읽어 넘긴다. 판정 함수 안에서 읽으면 그 함수가 환경에 따라
   * 다른 값을 내어 테스트가 코드가 아니라 환경을 검사하게 된다.
   */
  const periodState = resolvePeriod(period, new Date());
  const isSeeding = periodState.kind === 'empty';

  /*
   * 빈 화면으로 시작하지 않는다 — 기간이 필수라 심지 않으면 아무것도 조회할 수 없다.
   *
   * ⭐ **`replace`로 바꾼다.** 밀어 넣으면 기본값을 채운 것이 뒤로가기 기록에 칸을 쌓고,
   * 사용자가 뒤로 누르면 기간 없는 주소로 돌아가 **같은 채우기가 다시 돌아 그 자리에 갇힌다.**
   *
   * ⭐ **기존 주소를 통째로 갈아 끼우지 않는다**(`withPeriod`) — 기간을 채우는 김에 사용자가
   * 걸어 둔 다른 조건이 함께 사라지면 안 된다.
   */
  useEffect(() => {
    if (!isSeeding) return;

    const seeded = defaultPeriod(new Date());

    setSearchParams((prev) => withPeriod(prev, seeded), { replace: true });
  }, [isSeeding, setSearchParams]);

  const listQuery = periodState.kind === 'ready' ? periodState.query : null;
  const list = useNotificationList(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;

  /** 목록 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다. */
  const listPane = (): ReactNode => {
    if (periodState.kind === 'blocked') {
      return <EmptyState size="sm" title={t.empty.blockedTitle} description={periodState.reason} />;
    }

    /* 기간을 심는 동안에도 조회를 기다리는 것과 같은 모양이다 — 한 순간 뒤 요청이 나간다. */
    if (isSeeding || list.isPending) {
      return (
        <div role="status" aria-label={t.loading.list}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.noneTitle}
          description={t.empty.noneDescription}
        />
      );
    }

    /*
     * **카드의 key는 알림 번호다.** 인덱스로 두면 앞 카드가 목록에서 빠질 때 뒤 카드가 앞
     * 카드의 DOM 자리로 옮겨 붙어, 그 자리에 있던 포커스와 상태가 다른 알림의 것이 된다.
     * 뒤따르는 회차의 「모두 읽음」이 정확히 그 경로를 만든다.
     */
    return (
      <ul className="notification-list">
        {rows.map((view) => (
          <li key={view.notificationId}>
            <NotificationCard view={view} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 알림이 없는 줄 안다. */}
      {list.isError ? (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      ) : (
        <section className="pane" aria-label={t.panes.list}>
          {listPane()}
        </section>
      )}
    </>
  );
};
