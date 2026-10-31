/**
 * W-02-09 LOT 생산 이력 조회(종전 이름 「LOT 추적」)
 * 유형: T-W-A 조회형 — 이력 줄 하나의 목록과 상세 창, 탭 없음. 자재 입고, 투입, 제품입고, 포장, 제품 출하 줄을 기간과
 *       조건으로 보고 구분 칩으로 거른다. 상세는 고른 LOT을 가운데 두고 투입 자재와 사용처, 제품입고, 포장, 출하를
 *       함께 보인다(정방향과 역방향 추적, 단계 진행). 조건은 주소에 남는다. 탭이 있던 때의 주소(`tab=`)도 연다.
 * 이탈: C-10 목록에는 품목명 열만 두고 품목 코드는 마우스를 올리면 보인다(좌우 배치의 목록 창 폭). LOT 번호는 목록에서 빼고
 *       상세 머리와 내려받은 파일에 둔다. 일시는 줄이 모두 한 해이면 해를 뺀다(「MM-DD HH:mm」).
 *       C-12 기간 칸의 「시작일부터」 적용은 DS 기간 선택이 지원하지 않아 미구현(W-02-01과 같다).
 */
import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import { migrateLegacyParams } from './filters';
import { PermissionMenuContext } from './load-failure';
import { LotHistory } from './movements-tab';

const t = messages.lotTrace;

export interface LotTraceScreenProps {
  /** 권한 안내가 가리킬 메뉴 경로. 라우트가 사이드바 자료로 만든다. */
  permissionMenuPath: string | null;
}

export const LotTraceScreen = ({ permissionMenuPath }: LotTraceScreenProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  /* 탭이 있던 때의 주소(`tab=`)로 오면 지금 조건으로 옮긴다. 옮긴 뒤에 본문을 그린다. */
  const legacy = migrateLegacyParams(searchParams);
  useEffect(() => {
    if (legacy !== null) setSearchParams(legacy, { replace: true });
  }, [legacy, setSearchParams]);

  return (
    <PermissionMenuContext value={permissionMenuPath}>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      {legacy === null && <LotHistory />}
    </PermissionMenuContext>
  );
};
