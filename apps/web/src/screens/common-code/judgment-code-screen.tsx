import { Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { useCodeGroupList } from './code-group-queries';
import { CodeValueSection } from './code-value-section';
import { readPage, readSelectedId } from './filters';
import { JUDGMENT_TYPE_GROUP_CODE, findJudgmentTypeGroup } from './judgment-group';
import { LoadErrorBanner } from './load-error-banner';
import type { CodeGroupFilters } from './types';

const t = messages.judgmentCode;

/**
 * W-06-04 판정유형 코드 마스터 — **진입점 하나**다(omf-mes-client#16).
 *
 * 편집기를 만들지 않는다. 공통코드 화면이 격리해 둔 **코드값 편집 한 벌을 판정유형 코드 그룹으로
 * 고정해 연다** — 그 한 벌은 이번에 한 줄도 고치지 않는다. 판정유형은 아직 값 하나짜리 문자열이라
 * 통제 속성을 담을 자리가 계약에 없고, 전용 화면을 지금 만들면 자리가 생길 때 버리게 된다.
 *
 * 그래서 이 파일이 소유하는 것은 셋뿐이다 — **주소** · **그룹 해석** · **편집기 바깥의 안내**.
 * 목록·폼·쓰기·쪽 이동은 전부 한 벌의 것이다.
 */

/** 켜짐을 나타내는 유일한 값. 다른 값은 꺼진 것으로 본다 — 주소는 사람이 고치는 자리다. */
const ON = '1';

/**
 * 이 화면의 주소 키. 공통코드 화면의 키(`val`·`vpage`·`vinactive`·`new=value`)와 이름이 달라도
 * **주소가 달라** 섞이지 않는다. 그쪽은 한 화면에 목록이 둘이라 접두가 필요했고 여기는 하나다.
 */
const URL_KEYS = {
  selected: 'sel',
  page: 'page',
  includeInactive: 'inactive',
  creating: 'new',
} as const;

/**
 * 판정유형 코드 그룹을 찾기 위한 조회 조건. **모듈 수준 상수다.**
 *
 * 렌더 안에서 객체 리터럴로 만들면 렌더마다 참조가 달라져, 이 값을 조회 열쇠로 삼는 자리가
 * 흔들린다. 값이 바뀔 일이 없는 조건이라 아예 한 번만 만든다.
 *
 * **미사용 그룹도 받는다** — 끄면 미사용 그룹이 「그룹 없음」으로 보여 사실과 다른 안내가 된다.
 * 그룹이 꺼져 있다는 사실은 담당자가 알아야 조치할 수 있다.
 */
const GROUP_LOOKUP_FILTERS: CodeGroupFilters = {
  q: JUDGMENT_TYPE_GROUP_CODE,
  includeInactive: true,
};

/** 그룹 조회는 첫 쪽만 본다. 그룹코드로 좁힌 조회라 다음 쪽까지 갈 결과가 나오지 않는다. */
const GROUP_LOOKUP_PAGE = 1;

export const JudgmentCodeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const groupList = useCodeGroupList(GROUP_LOOKUP_FILTERS, GROUP_LOOKUP_PAGE, true);

  /**
   * 판정유형 코드 그룹. 받은 목록에서 **정확히 일치하는 것만** 고른다(`judgment-group.ts`).
   * 못 찾았으면 `null`이고, 그때 편집기를 렌더하지 않는 것이 이 화면의 핵심 규칙이다.
   */
  const judgmentGroup =
    groupList.data === undefined ? null : findJudgmentTypeGroup(groupList.data.items);

  const selectedCodeValueId = readSelectedId(searchParams, URL_KEYS.selected);
  const page = readPage(searchParams, URL_KEYS.page);
  const includeInactive = searchParams.get(URL_KEYS.includeInactive) === ON;

  /**
   * 등록 폼이 열려 있는가. **그룹을 찾은 뒤에만 성립한다** —
   * 계약이 등록에 코드그룹 번호를 요구해 그룹 없이는 만들 자리 자체가 없다.
   */
  const isCreating = searchParams.get(URL_KEYS.creating) === ON && judgmentGroup !== null;

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 선택이 풀리는데 쪽을 옮기면 안 풀리는 식).
   *
   * | # | 조작 | `sel` | `page` | `inactive` | `new` |
   * | :-: | --- | --- | --- | --- | --- |
   * | 1 | 코드값을 고른다 | **설정** | 유지 | 유지 | **지움** |
   * | 2 | 등록 폼을 연다 | **지움** | 유지 | 유지 | **설정** |
   * | 3 | 등록 폼을 닫는다 | 유지 | 유지 | 유지 | **지움** |
   * | 4 | 「미사용 포함」을 바꾼다 | **지움** | **지움** | 설정/지움 | **지움** |
   * | 5 | 쪽을 옮긴다 | **지움** | 설정/지움 | 유지 | **지움** |
   *
   * 1이 `new`를 지우는 것은 등록 성공 경로 때문이다 — 한 벌은 등록에 성공하면 **고르기 콜백만
   * 한 번** 부른다. 그 한 번으로 「등록을 끝내고 새 값을 고른 상태」가 되어야 뒤로가기가
   * 사용자가 본 적 없는 중간 상태로 떨어지지 않는다.
   *
   * 4·5가 선택을 비우는 것은 보이는 행이 통째로 달라지기 때문이다 — 목록에 없는 코드값의 폼이
   * 아래 칸에 남으면 그것이 어디서 왔는지 알 수 없다.
   *
   * **비우는 자리는 이 다섯뿐이다.** 여섯째가 생기면 이 표에 행을 먼저 더한다.
   * 그룹을 찾지 못한 경우에도 **주소를 정리하지 않는다** — 그 키들은 아무것도 가리키지 않아
   * 해가 없고, 지우면 그룹이 생겼을 때 공유받은 딥링크가 이미 사라진 뒤다.
   */
  const patchSearchParams = (patch: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    patch(next);

    // 같은 주소로 다시 옮기면 뒤로가기가 제자리에서 한 번 헛돈다.
    if (next.toString() === searchParams.toString()) return;

    setSearchParams(next);
  };

  const selectCodeValue = (codeValueId: number) => {
    patchSearchParams((next) => {
      next.set(URL_KEYS.selected, String(codeValueId));
      next.delete(URL_KEYS.creating);
    });
  };

  const openCreate = () => {
    patchSearchParams((next) => {
      next.set(URL_KEYS.creating, ON);
      // 등록 폼과 고른 값의 폼이 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete(URL_KEYS.selected);
    });
  };

  const closeCreate = () => {
    patchSearchParams((next) => {
      next.delete(URL_KEYS.creating);
    });
  };

  const changeIncludeInactive = (nextIncludeInactive: boolean) => {
    patchSearchParams((next) => {
      if (nextIncludeInactive) {
        next.set(URL_KEYS.includeInactive, ON);
      } else {
        // 계약의 기본값이 꺼짐이다 — 끈 상태를 값으로 실으면 주소가 두 갈래로 갈린다.
        next.delete(URL_KEYS.includeInactive);
      }

      next.delete(URL_KEYS.selected);
      next.delete(URL_KEYS.page);
      next.delete(URL_KEYS.creating);
    });
  };

  const changePage = (nextPage: number) => {
    patchSearchParams((next) => {
      if (nextPage > 1) {
        next.set(URL_KEYS.page, String(nextPage));
      } else {
        next.delete(URL_KEYS.page);
      }

      next.delete(URL_KEYS.selected);
      next.delete(URL_KEYS.creating);
    });
  };

  /**
   * 본문 — 그룹 해석의 **네 갈래**다. 넷을 뭉치면 사실과 다른 안내가 된다.
   *
   * 편집기는 **찾은 갈래에서만** 선다. 나머지 셋에서 코드값 요청이 한 번도 나가지 않는 것이
   * 이 구조의 목적이다 — 계약이 코드그룹 번호를 필수 쿼리로 두어, 없는 번호를 지어내 부르면 422다.
   * 한 벌이 갖고 있는 「좌측에서 코드그룹을 먼저 고르세요」도 여기서는 사실이 아니다.
   * 이 화면에는 좌측 그룹 목록이 없다.
   */
  const renderBody = (): ReactNode => {
    /* 실패를 「그룹이 없습니다」로 뭉개면 사용자가 있지도 않은 등록을 하러 간다. */
    if (groupList.isError) {
      return (
        <section className="pane" aria-label={t.title}>
          <LoadErrorBanner error={groupList.error} onRetry={() => void groupList.refetch()} />
        </section>
      );
    }

    if (groupList.isPending) {
      return (
        <section className="pane" aria-label={t.title}>
          <div role="status" aria-label={t.loading.group}>
            <SkeletonText lines={3} />
          </div>
        </section>
      );
    }

    if (judgmentGroup === null) {
      return (
        <section className="pane" aria-label={t.title}>
          {/* 설명이 찾던 그룹코드를 밝힌다 — 밝히지 않으면 무엇을 등록해야 하는지 알 수 없다. */}
          <EmptyState
            live
            title={t.empty.groupNotFoundTitle}
            description={t.empty.groupNotFoundDescription(JUDGMENT_TYPE_GROUP_CODE)}
          />
        </section>
      );
    }

    return (
      <div className="pane-stack">
        <CodeValueSection
          codeGroupId={judgmentGroup.codeGroupId}
          selectedCodeValueId={selectedCodeValueId}
          onSelectCodeValue={selectCodeValue}
          isCreating={isCreating}
          onOpenCreate={openCreate}
          onCloseCreate={closeCreate}
          includeInactive={includeInactive}
          onIncludeInactiveChange={changeIncludeInactive}
          page={page}
          onPageChange={changePage}
        />
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {renderBody()}
    </>
  );
};
