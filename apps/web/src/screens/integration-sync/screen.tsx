import { AlertBanner, Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { MessageFilterBar } from './message-filter-bar';
import { MessageTable } from './message-table';
import { defaultPeriod, toPeriodQuery, validatePeriod, type PeriodInput } from './period';
import { useMessageList } from './queries';

const t = messages.integrationSync;

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 저장 실패와 달리 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
 *
 * 다른 화면 슬라이스에도 같은 함수가 있으나 가져다 쓰지 않는다 —
 * 화면 슬라이스끼리 참조하면 한쪽의 사정이 다른 쪽 화면을 바꾼다.
 */
const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      // 서버가 빈 message를 주는 일이 실제로 있다. ??는 빈 문자열을 통과시켜 본문을 지운다.
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/** 조회 실패 배너. 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매를 붙인다. */
const LoadErrorBanner = ({ error, onRetry }: LoadErrorBannerProps) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

/**
 * W-06-10 컨테이너 — 이 저장소의 **첫 조회 형 화면**이다.
 *
 * 목록을 읽는 것이 주 동작이라 2단 배치를 쓰지 않는다. 표가 창 폭을 다 쓰고
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 */
export const IntegrationSyncScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const period: PeriodInput = {
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  };
  const hasPeriodParams = searchParams.has('from') || searchParams.has('to');

  /*
   * 빈 화면으로 시작하지 않는다 — 매번 날짜를 고르는 비용이 크다.
   * 주소에 기간이 아예 없을 때만 채운다. 비운 채로 들어온 주소(`?from=&to=`)는 사용자의 뜻이므로
   * 덮지 않고 「기간을 고르고 조회하세요」로 안내한다.
   * replace로 바꿔 뒤로가기가 빈 주소로 되돌아가지 않게 한다.
   */
  useEffect(() => {
    if (hasPeriodParams) return;

    const seeded = defaultPeriod(new Date());
    setSearchParams(new URLSearchParams({ from: seeded.from, to: seeded.to }), { replace: true });
  }, [hasPeriodParams, setSearchParams]);

  /*
   * 실행 환경의 시간대를 한 번만 읽어 넘긴다. 변환 함수 안에서 읽으면
   * 그 함수가 환경에 따라 다른 값을 내어 테스트가 환경을 검사하게 된다.
   */
  const offsetMinutes = -new Date().getTimezoneOffset();
  const now = new Date();

  const periodReason = validatePeriod(period);
  const listQuery = periodReason === null ? toPeriodQuery(period, offsetMinutes) : null;

  const list = useMessageList(listQuery);
  const rows = list.data?.items ?? [];

  const applyPeriod = (next: PeriodInput) => {
    setSearchParams(new URLSearchParams({ from: next.from, to: next.to }));
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {list.isError && <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />}

      <section className="pane" aria-label={t.title}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <MessageFilterBar
          appliedPeriod={period}
          onSearch={applyPeriod}
          onReset={() => {
            applyPeriod(defaultPeriod(new Date()));
          }}
        />

        {/* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「기록이 없습니다」로 보이면 안 된다. */}
        {!list.isError && (
          <MessageTable
            rows={rows}
            isLoading={listQuery !== null && list.isPending}
            hasPeriod={listQuery !== null}
            now={now}
          />
        )}
      </section>
    </>
  );
};
