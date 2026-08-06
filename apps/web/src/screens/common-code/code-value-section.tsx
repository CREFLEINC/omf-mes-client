import { CodeValueListPane } from './code-value-list-pane';
import { useCodeValueList } from './code-value-queries';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';

export interface CodeValueSectionProps {
  /**
   * 이 한 벌이 아는 유일한 바깥 사실.
   * 코드값만 다루는 화면은 여기에 자기 코드그룹 번호를 고정으로 넘긴다.
   */
  codeGroupId: number | null;
  selectedCodeValueId: number | null;
  onSelectCodeValue: (codeValueId: number | null) => void;
  includeInactive: boolean;
  onIncludeInactiveChange: (includeInactive: boolean) => void;
  page: number;
  onPageChange: (page: number) => void;
}

/**
 * **코드값 편집 한 벌의 조립부.** 이 한 벌의 부품과 조회를 묶는다.
 *
 * **주소를 읽지 않는다.** 조회 조건·선택·쪽은 전부 props로 들어오고, 주소는 이 한 벌을
 * 소비하는 화면이 소유한다 — 그래야 코드값만 다루는 다른 화면이 자기 주소 규약으로 쓸 수 있다.
 *
 * **다른 자원(코드그룹·부서·작업자·자격)과 탭 정의를 참조하지 않는다.** 참조하면 한 벌을
 * 통째로 옮길 수 없다(omf-mes#13 §5).
 *
 * `codeGroupId`가 `null`이면 빈 상태를 내고 **조회 요청을 보내지 않는다** —
 * 계약이 그 값을 필수 쿼리로 두어 빼고 부르면 422다.
 */
export const CodeValueSection = ({
  codeGroupId,
  selectedCodeValueId,
  onSelectCodeValue,
  includeInactive,
  onIncludeInactiveChange,
  page,
  onPageChange,
}: CodeValueSectionProps) => {
  const list = useCodeValueList(codeGroupId, includeInactive, page);
  const codeValues = list.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, codeValues.length);

  return (
    <CodeValueListPane
      codeValues={codeValues}
      // 그룹을 고르기 전에는 아무것도 기다리지 않는다 — 조회가 나가지도 않았다.
      isLoading={codeGroupId !== null && list.isPending}
      isGroupSelected={codeGroupId !== null}
      includeInactive={includeInactive}
      onIncludeInactiveChange={onIncludeInactiveChange}
      pageView={pageView}
      onChangePage={onPageChange}
      selectedCodeValueId={selectedCodeValueId}
      onSelect={onSelectCodeValue}
      loadError={
        list.isError ? (
          <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
        ) : null
      }
    />
  );
};
