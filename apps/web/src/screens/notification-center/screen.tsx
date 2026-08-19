import { Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { withPeriod } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { NotificationCard } from './notification-card';
import {
  defaultPeriod,
  hasPeriodKeys,
  readPeriod,
  resolvePeriod,
  type NotificationPeriod,
} from './period';
import { useNotificationList } from './queries';
import type { NotificationView } from './types';

const t = messages.notificationCenter;

/**
 * 결과가 없을 때 쓰는 고정 참조.
 *
 * ⚠ **이 회차에는 막는 것이 없다** — `rows`의 소비처가 `listPane()` 안의 `length`·`map` 둘뿐이라
 * 매 렌더 새 배열을 만들어도 관측되는 차이가 없다. 자리를 미리 고정해 두는 것은 **T2** 때문이다.
 * 그 회차가 `rows`를 쪽 표기(`toPageView`)와 조건 줄에 넘기면 그때부터 참조가 실제로 의미를 갖는다.
 */
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
 * | # | 주소의 기간 | `from`·`to` | 왜 |
 * | :-: | --- | --- | --- |
 * | 1 | **키가 없다**(첫 진입) | **기본 7일을 심는다** | 사용자가 기간에 대해 아직 아무 말도 하지 않았다. 기간이 없으면 조회 자체가 되지 않는다 |
 * | 2 | **키는 있고 값이 비었다**(`?from=&to=`) | **그대로 둔다** | 비운 것이 사용자의 뜻이다. 덮으면 기간을 비울 수단이 아예 사라진다 |
 * | 3 | 손으로 고친 깨진 기간 | **그대로 둔다** | 조용히 덮으면 무엇이 왜 달라졌는지 화면 어디에도 없다. 사유를 보이고 조회하지 않는다 |
 *
 * ⭐ **1행과 2행을 가르는 것이 `hasPeriodKeys`다.** 값만 보면 둘이 같은 빈 문자열이라 구분되지
 * 않는다 — 전례 둘(`master-change/screen.tsx`·`integration-sync/screen.tsx`)이 같은 자리를
 * `searchParams.has()`로 갈라 두었다. 2·3행은 조회하지 않고 사유를 보이며, 사유는 **갈래마다
 * 다르다**(비었다 ↔ 날짜가 아니다 ↔ 뒤집혔다 — 공유계약 G-9).
 *
 * **비우는 자리가 하나도 없다** — 기간은 이 화면에서 풀 수 없는 조건이다. 조건이 늘어나는
 * 회차(안 읽음·유형·쪽)가 이 표에 행을 먼저 더한다.
 *
 * ⛔ **자동 갱신을 두지 않는다**(공유계약 L-6). ⚠ L-6의 각주는 **이 화면을 실시간 예외로
 * 지목**하지만, 나중 판(화면 스펙 §8-4와 계약)이 「화면은 자동 갱신 없음 · 셸 배지만 화면 전환
 * 시 갱신」으로 정리했고 그쪽을 따랐다. 두 문서의 어긋남 자체는 질문 `omf-mes#164`로 추적 중이다.
 * 상단 바의 종 배지는 셸의 책임이라 이 화면이 만들지 않는다.
 */
export const NotificationCenterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * **주소가 바뀔 때만 새 참조를 만든다.**
   *
   * ⚠ **이 회차에는 막는 것이 없다** — 유일한 소비처인 `resolvePeriod`가 메모되지 않아 어차피
   * 매 렌더 돈다. 여기 두는 것은 **T2** 때문이다. 그 회차의 조건 줄이 이 값을 되돌림 기준으로
   * 받는데, 렌더마다 새 객체면 내용이 같아도 참조가 달라 **부모가 다시 그려질 때마다 치던 날짜를
   * 덮어쓴다**(조회 응답이 도착하는 순간이 실제로 그 자리다 — 전례 `inbound-schedule` #43).
   */
  const period = useMemo<NotificationPeriod>(() => readPeriod(searchParams), [searchParams]);

  /*
   * ⭐ **「키가 없다」와 「키는 있고 값이 비었다」를 가른다**(주소 키 수명 표 1·2행).
   * 값만 보면 둘이 같은 빈 문자열이라, 이 한 줄이 없으면 사용자가 비운 기간을 화면이 덮어쓴다.
   */
  const hasKeys = hasPeriodKeys(searchParams);

  /*
   * 실행 환경의 「지금」을 한 번만 읽어 넘긴다. 판정 함수 안에서 읽으면 그 함수가 환경에 따라
   * 다른 값을 내어 테스트가 코드가 아니라 환경을 검사하게 된다.
   */
  const periodState = resolvePeriod(period, hasKeys, new Date());
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
