/**
 * W-06-04 판정유형 코드 마스터.
 *
 * 이 화면은 공통코드 화면의 **코드값 편집기를 판정유형 코드 그룹으로 고정해 여는 진입점**이라,
 * 편집기 안의 문구(「코드값 추가」·「코드값 정보」)는 `commonCode.codeValue`가 그대로 쓴다.
 * 그 묶음을 여기서 다시 만들지 않는다 — 고치면 공통코드 화면의 같은 자리가 함께 바뀐다.
 *
 * 그래서 이 묶음에는 **편집기 바깥의 문구만** 있다 — 페이지 머리 · 그룹 해석 결과 · 안내 셋.
 *
 * **판정유형 값의 이름을 여기 적지 않는다.** 값 목록의 정본은 서버이고, 문구에 적으면
 * 화면이 서버와 다른 답을 낸다.
 */
export const judgmentCode = {
  title: '판정유형 코드',
  breadcrumbRoot: '품질 관리',
  loading: {
    group: '판정유형 코드 그룹을 확인하는 중',
  },
  /**
   * 그룹을 찾지 못한 것은 **오류가 아니라 정상 상태의 하나**다 —
   * 설명이 **찾던 그룹코드를 밝힌다.** 밝히지 않으면 무엇을 등록해야 하는지 알 수 없다.
   */
  empty: {
    groupNotFoundTitle: '판정유형 코드 그룹을 찾지 못했습니다',
    groupNotFoundDescription: (groupCode: string): string =>
      `그룹코드가 「${groupCode}」인 코드그룹이 없습니다. 공통코드 화면에서 이 코드그룹을 먼저 등록하세요.`,
  },
  notices: {
    /** 판정유형 목록이 확정되기 전까지 낸다. 값을 지어내지 않으므로 그 한계를 문구가 밝힌다. */
    provisionalList:
      '판정유형은 아직 확정되지 않은 임시 목록입니다. 지금 보이는 값이 전부가 아닐 수 있고, 확정되면 달라질 수 있습니다.',
    /* 그룹이 꺼져 있어도 값은 그대로 있다 — 편집을 막지 않고 사실과 조치할 곳을 함께 밝힌다. */
    groupInactive:
      '이 코드그룹은 미사용 상태입니다. 값은 그대로 고칠 수 있으나, 사용을 다시 열려면 공통코드 화면에서 코드그룹을 확인하세요.',
    /*
     * 값 추가 경고. **등록 폼이 열려 있는 동안에만** 낸다 —
     * 늘 보이는 경고는 읽히지 않아 정작 값을 늘릴 때 효력이 없다.
     */
    addAffectsOtherScreens:
      '여기서 추가한 판정유형은 판정유형을 쓰는 다른 화면에도 함께 나타납니다. 여러 업무가 같은 목록을 보므로 값을 늘리기 전에 담당자와 확인하세요.',
    /* 편집기 문구가 「코드값」으로 남는 이유를 밝힌다 — 화면 이름과 편집기 어휘가 다르다. */
    editorScope: '이 화면은 판정유형 코드 그룹의 코드값을 편집합니다.',
  },
  /**
   * 판정 유형 코드 탭 전용 편집기(#209) — 불량코드 탭과 같은 짜임(조회 카드 · 목록 표 · 상세 카드 · 창).
   * 공통코드 화면의 코드값 편집기는 그대로 두고 이 탭에서만 쓴다.
   */
  editor: {
    fields: {
      code: '판정 유형 코드',
      name: '판정 유형명',
      displayOrder: '정렬 순서',
      effectiveFrom: '적용 시작일',
      effectiveTo: '적용 종료일',
      period: '적용 기간',
      isActive: '사용 여부',
      nameKo: '한국어명',
      nameVi: '베트남어명',
    },
    values: {
      empty: '—',
      periodAlways: '기간 제한 없음',
      period: (from: string, to: string): string => `${from} ~ ${to}`,
      chipActive: '사용',
      chipInactive: '미사용',
    },
    placeholders: {
      code: '판정 유형 코드를 입력하세요',
      name: '판정 유형명을 입력하세요',
      displayOrder: '정렬 순서를 입력하세요',
    },
    actions: {
      add: '판정 유형 추가',
      edit: '수정',
    },
    list: '판정 유형 목록',
    detailTitle: '판정 유형 코드 상세',
    createTitle: '판정 유형 추가',
    editTitle: '판정 유형 수정',
    empty: {
      noneTitle: '등록된 판정 유형이 없습니다',
      noneDescription: '「판정 유형 추가」로 첫 판정 유형을 등록하세요.',
      notSelectedTitle: '판정 유형을 선택하세요',
      notSelectedDescription: '목록에서 선택하면 상세 정보가 표시됩니다.',
    },
    loading: {
      list: '판정 유형 목록을 불러오는 중',
      detail: '판정 유형 정보를 불러오는 중',
    },
    deactivate: {
      title: '사용 중지할까요?',
      description:
        '사용 중지하면 새 작업에서 이 판정 유형을 선택할 수 없습니다. 기존 데이터는 유지됩니다.',
      alreadyInactive: '이미 사용 중지된 판정 유형입니다.',
    },
  },
} as const;
