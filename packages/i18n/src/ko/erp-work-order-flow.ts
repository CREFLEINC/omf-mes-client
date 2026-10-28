/**
 * W-02-01 작업지시 목록. 작업함(받은 ERP W/O 목록)과 처리 화면(마스터 점검, 생산계획, 4M 배정, 배포 확인).
 *
 * 화면 구성 규범 T-W-C와 C-17에 따라 W-02-02(W/O 전개, 편성), W-02-03(4M 자원배정),
 * W-02-04(W/O 확정, 배포)를 이 화면의 단계와 일괄 동작으로 합쳤다.
 * 조사가 붙는 자리는 부르는 쪽이 `patterns/josa`로 붙여 넘긴다(C-5).
 */

/**
 * 화면 이름. 제목, 돌아가기 링크, 완료 화면 버튼, 안내용 메뉴 경로(`production-order.ts`)가 이 값을 쓴다.
 * 사이드바 이름은 `nav-tree.ts`에 따로 적고, `nav-menu-path.test.ts`가 둘이 같은지 잰다.
 */
const SCREEN_NAME = '작업지시 목록';

/**
 * 처리 상태 이름. 조건 칩, 행 상태 칩이 같은 이름을 쓴다(C-17 잠정 규칙: 서버 자동 계획 결과, omf-all-around#204).
 * 칩 이름은 여기만 고치면 바뀐다. 빈 목록 제목(`list.emptyNeedsReviewTitle`)은 문장이라 따로 적었으니 함께 고친다.
 * 「배포 대기」는 계획을 채운 건이다. 그중 W/O 생산 라인이 없어 배포할 수 없는 건은 사유 칩이 따로 말한다.
 */
const status = {
  NOT_PLANNED: '계획 전',
  NEEDS_REVIEW: '조치 필요',
  DONE: '배포 대기',
  RELEASED: '배포 완료',
} as const;

/** 처리 화면 단계 이름. 사유 칩 도움말이 고칠 단계를 이 이름으로 말한다. */
const steps = {
  master: '마스터 점검',
  plan: '생산계획',
  assign: '4M 배정',
  release: '배포 확인',
} as const;

/** 사유 칩 이름. 무엇을 해야 하는지로 짓는다. */
const reasons = {
  BOM_MISSING: '기본 BOM 지정 필요',
  ROUTING_MISSING: '공정(Routing) 등록 필요',
  ROUTING_AMBIGUOUS: '기본 공정(Routing) 지정 필요',
  LINE_UNKNOWN: '생산 라인 지정 필요',
  PLAN_NOT_CONFIRMED: '생산계획 확정 필요',
  QTY_REMAINING: '남은 수량 계획 필요',
  ASSIGNMENT_INCOMPLETE: 'W/O 생산 라인 지정 필요',
} as const;

/**
 * 사유 칩 도움말에 넣는 수와 수량. 화면이 아는 것만 채운다. 작업함은 행마다 부르지 않으므로(C-15 2) 계획 수량을 모른다.
 * 수량은 부르는 쪽이 표시 형식으로 바꿔 넘긴다.
 */
export interface ReasonDetail {
  orderQty?: string;
  plannedQty?: string;
  uom?: string;
  pendingWorkOrders?: number;
  lineMissingWorkOrders?: number;
}

export const erpWorkOrderFlow = {
  title: SCREEN_NAME,
  breadcrumbRoot: '생산 관리',

  /** 페이지 머리 조건 칩. `label`은 보이지 않는 칩 묶음의 접근명이다. */
  counts: {
    label: '처리 상태',
    all: (count: number): string => `전체 ${String(count)}건`,
    needsReview: (count: number): string => `${status.NEEDS_REVIEW} ${String(count)}건`,
    done: (count: number): string => `${status.DONE} ${String(count)}건`,
  },

  status,
  reasons: {
    ...reasons,
    more: (count: number): string => `외 ${String(count)}`,
  },
  /** 사유 칩 도움말(툴팁). 무엇이 잘못됐고 어디서 고치는지 말한다. */
  reasonHelp: {
    BOM_MISSING: (): string =>
      // ui-check-ignore: C-13 메뉴 이름 「품목·BOM 정보」를 그대로 쓴다(사용자 지시 2026-10-28, omf-all-around#204)
      '이 품목의 기본 BOM이 없거나 둘 이상입니다. 품목·BOM 정보에서 기본 BOM을 하나로 지정해야 합니다.',
    ROUTING_MISSING: (): string =>
      '이 품목에 쓸 수 있는 공정(Routing)이 없습니다. 공정(Routing) 화면에서 등록해야 합니다.',
    ROUTING_AMBIGUOUS: (): string =>
      `쓸 수 있는 공정(Routing)이 여럿이고 기본이 정해지지 않았습니다. 공정(Routing) 화면에서 기본을 지정하거나 ${steps.master} 단계에서 골라야 합니다.`,
    LINE_UNKNOWN: (): string =>
      `생산계획에 생산 라인이 정해지지 않았습니다. ${steps.plan} 단계에서 생산 라인을 골라야 합니다.`,
    PLAN_NOT_CONFIRMED: (): string =>
      `작성 중인 생산계획이 있습니다. ${steps.plan} 단계에서 계획을 확정해야 합니다.`,
    QTY_REMAINING: ({ orderQty, plannedQty, uom = '' }: ReasonDetail): string =>
      orderQty !== undefined && plannedQty !== undefined
        ? `주문 ${`${orderQty} ${uom}`.trim()} 중 ${`${plannedQty} ${uom}`.trim()}만 계획되었습니다. ${steps.plan} 단계에서 남은 수량을 계획해야 합니다.`
        : `확정한 계획 수량이 주문 수량보다 적습니다. ${steps.plan} 단계에서 남은 수량을 계획해야 합니다.`,
    ASSIGNMENT_INCOMPLETE: ({ pendingWorkOrders, lineMissingWorkOrders }: ReasonDetail): string =>
      pendingWorkOrders !== undefined && lineMissingWorkOrders !== undefined
        ? `배포 전 W/O ${String(pendingWorkOrders)}건 중 ${String(lineMissingWorkOrders)}건에 생산 라인이 없습니다. ${steps.assign} 단계에서 생산 라인을 지정해야 합니다.`
        : `배포 전 W/O 가운데 생산 라인이 없는 것이 있습니다. ${steps.assign} 단계에서 생산 라인을 지정해야 합니다.`,
  },

  filters: {
    pane: '조회 조건',
    q: '번호 검색',
    qPlaceholder: 'ERP W/O 번호',
    due: '납기 기간',
    duePlaceholder: '시작일 ~ 종료일',
    item: '품목',
    itemPicker: '품목 선택',
    itemCode: '품목 코드',
    itemName: '품목명',
  },

  list: {
    pane: 'ERP W/O 목록',
    caption: 'ERP W/O 작업함',
    columns: {
      orderNo: 'ERP W/O 번호',
      itemCode: '품목 코드',
      itemName: '품목명',
      orderQty: '주문 수량',
      dueDate: '납기일',
      pendingWorkOrders: '배포 전 W/O',
      status: '처리 상태',
      reasons: '필요한 조치',
      open: '이동',
    },
    pendingWorkOrders: (pending: number, total: number): string =>
      `${String(pending)} / ${String(total)}`,
    openRow: (orderNo: string): string => `${orderNo} 처리 화면 열기`,
    checkRow: (orderNo: string): string => `${orderNo} 선택`,
    loading: 'ERP W/O 목록 불러오는 중',
    loadFailed: 'ERP W/O 목록을 불러오지 못했습니다',
    loadFailedDescription: '잠시 후 다시 조회하세요.',
    readinessFailed: `배포 전 W/O를 불러오지 못해 「${reasons.ASSIGNMENT_INCOMPLETE}」 사유를 표시하지 못했습니다. 다시 조회하세요.`,
    readinessTruncated:
      '배포 전 W/O가 너무 많아 일부만 받았습니다. 받지 못한 ERP W/O는 배포 전 W/O 수를 「확인 불가」로 표시합니다.',
    pendingUnknown: '확인 불가',
    emptyTitle: '조건에 맞는 ERP W/O가 없습니다',
    emptyDescription: '조회 조건을 바꿔 다시 조회하세요.',
    emptyNeedsReviewTitle: '조치가 필요한 ERP W/O가 없습니다',
    emptyNeedsReviewDescription: `「${status.DONE}」 건은 그 조건에서 골라 일괄 배포하세요.`,
  },

  bulk: {
    release: '일괄 배포',
    autoPlan: '자동 계획 재실행',
    itemName: 'W/O',
    reasons: {
      noneChecked: '일괄 처리할 ERP W/O를 목록에서 체크하세요',
      running: '일괄 동작을 실행하는 중입니다',
    },
    releaseDialog: {
      title: '일괄 배포',
      target: (count: number): string => `대상 ERP W/O ${String(count)}건`,
      task: '배포',
      effects: ['W/O 상태 변경: 배포', '생산 LOT 선발행', '자재 출고 요청 발행'],
      skipTitle: '건너뛰는 조건',
      skipConditions: [
        '생산 라인이나 기본 위치가 정해지지 않은 W/O',
        '품목 기본 LOT 크기가 등록되지 않은 W/O',
        '배포할 W/O가 없는 ERP W/O',
      ],
      forecastTitle: '실행 예고',
      forecast: (processed: number, partial: number, skipped: number, workOrders: number): string =>
        `처리 ${String(processed)}건, 일부 처리 ${String(partial)}건, 건너뜀 ${String(skipped)}건(W/O ${String(workOrders)}건 배포 예정)`,
      forecasting: '배포할 W/O를 확인하는 중입니다',
      nothing: '모든 대상이 건너뛰어집니다. 처리 화면에서 4M 배정을 마친 뒤 배포하세요',
      irreversible: '배포 후에는 수정할 수 없습니다. W/O 취소로 처리합니다.',
      confirm: '배포',
    },
    autoPlanDialog: {
      title: '자동 계획 재실행',
      target: (count: number): string => `대상 ERP W/O ${String(count)}건`,
      task: '자동 계획',
      /*
       * 설비와 금형은 품목의 기본(★) 매핑으로 배정한다. 공정을 지정한 매핑은 그 공정의 W/O에, 「전체 공정」 매핑은
       * 그것이 필요한 첫 공정에만 붙는다(서버 `resource-assign.ts`).
       */
      effects: ['생산계획 작성과 확정', 'W/O 전개', '품목에 ★로 지정한 설비와 금형 자동 배정'],
      skipTitle: '건너뛰는 조건',
      /* 확정 계획이 있으면 자동 계획은 남은 수량을 채우지 않는다(서버 `act`: 작성 중 계획이 없으면 NOT_PLANNED). */
      skipConditions: [
        '기본 BOM이나 Routing이 없는 ERP W/O',
        '확정한 계획 수량이 주문 수량보다 적고 작성 중인 계획이 없는 ERP W/O(남은 수량은 생산계획 단계에서 계획)',
      ],
      /** 라인을 모르면 건너뛰지 않고 작성 중 계획을 남긴다(서버 자동 계획 결과 DRAFT). */
      draftNote: '생산 라인을 정할 수 없으면 작성 중인 계획만 만들고 확정하지 않습니다.',
      confirm: '재실행',
    },
    resultTitle: {
      release: '일괄 배포 결과',
      autoPlan: '자동 계획 재실행 결과',
    },
    outcomeReasons: {
      noWorkOrders: '배포할 W/O 없음',
      setupMissing: '라인이나 기본 위치 미정',
      noLotSize: '품목 기본 LOT 크기 없음',
      draft: reasons.PLAN_NOT_CONFIRMED,
      failed: '실행하지 못했습니다',
    },
  },

  process: {
    back: SCREEN_NAME,
    loading: 'ERP W/O 불러오는 중',
    notFound: '이 번호의 ERP W/O를 찾을 수 없습니다',
    notFoundDescription: '작업함에서 다시 고르세요.',
    loadFailed: 'ERP W/O를 불러오지 못했습니다',
    retry: '다시 시도',
    summary: {
      item: '품목',
      orderQty: '주문 수량',
      dueDate: '납기일',
      erpNo: 'ERP 원번호',
    },
    rerunAutoPlan: '자동 계획 다시 실행',
    autoPlanResult: {
      CONFIRMED: '자동 계획으로 계획을 확정했습니다',
      DRAFT: '작성 중 계획이 있습니다. 생산계획 단계에서 확정하세요',
      NOT_PLANNED: '자동 계획으로 계획을 만들지 못했습니다',
      running: '자동 계획이 진행 중입니다. 잠시 뒤 다시 실행하세요',
    },
    steps,
    /** 지난 단계 요약의 「라벨 값」 쌍(T-W-C 지난 단계 요약 형식) */
    pastSummary: {
      bom: 'BOM',
      routing: 'Routing',
      revision: (code: string, version: number): string => `${code} (Rev ${String(version)})`,
      confirmedQty: '확정 수량',
      line: '라인',
      assigned: '배정 완료',
      workOrders: (count: number): string => `W/O ${String(count)}건`,
      unset: '미지정',
    },
    /** 하단 바 문장(C-5). `select`, `enter`, `choose`, `resolve`, `canProceed`의 인자는 조사를 붙여 넘긴다. */
    remaining: {
      bomMissing:
        '기본 BOM이 등록되지 않아 진행할 수 없습니다. ERP 담당자에게 BOM 등록을 요청하세요',
      routingMissing:
        '사용할 수 있는 Routing이 등록되지 않아 진행할 수 없습니다. 기준정보 담당자에게 Routing 등록을 요청하세요',
      loadFailed: '기준 정보를 불러오지 못했습니다. 다시 시도하세요',
      select: (targetWithJosa: string): string => `${targetWithJosa} 고르세요`,
      addPlan: '생산계획을 추가하세요',
      enter: (plan: string, fieldWithJosa: string): string =>
        `${plan}의 ${fieldWithJosa} 입력하세요`,
      chooseLine: (plan: string): string => `${plan}의 라인을 고르세요`,
      qtyShort: (qty: string): string => `계획 수량이 ${qty} 부족합니다. 계획을 추가하세요`,
      canProceed: (stepWithJosa: string): string => `${stepWithJosa} 진행할 수 있습니다`,
      checking: '배포 가능 여부를 확인하는 중입니다',
      saveChanges: (workOrderNo: string): string => `${workOrderNo}의 변경을 저장하세요`,
      noWorkOrders: '확정한 계획에 W/O가 없습니다. 생산계획을 확인하세요',
      unassigned: (count: number): string => `W/O ${String(count)}건 미배정.`,
      pickUnassigned: '목록에서 배정 미완 W/O를 고르세요',
      choose: (operation: string, fieldWithJosa: string): string =>
        `${operation} 공정의 ${fieldWithJosa} 고르세요`,
      resolve: (findingWithJosa: string): string => `${findingWithJosa} 해결하세요`,
      releaseFinal: '배포 후 수정 불가',
      enterLot: (workOrderNo: string): string => `${workOrderNo}의 LOT 크기를 입력하세요`,
      remainingOrders: (count: number): string => `남은 ERP W/O ${String(count)}건`,
    },
    links: {
      bom: 'BOM 조회 열기',
      routing: 'Routing 화면 열기',
    },
    master: {
      heading: '계획에 쓸 BOM과 Routing',
      bom: 'BOM',
      routing: 'Routing',
      placeholder: '개정을 고르세요',
      revision: (code: string, version: number, status: string): string =>
        `${code} Rev ${String(version)} (${status})`,
      effective: (from: string, to: string): string => `유효기간 ${from} ~ ${to}`,
      periodOpen: '종료일 없음',
      autoSelected: '기본 개정',
      fixedByPlan: '확정된 계획이 쓰는 개정',
    },
    plan: {
      heading: '생산계획',
      add: '계획 추가',
      confirm: '전개 확정',
      saveDraft: '임시 저장',
      newRow: (displayNo: number): string => `신규 계획 ${String(displayNo)}`,
      newStatus: '신규',
      columns: {
        planNo: '계획 번호',
        planDate: '계획일',
        plannedQty: '계획 수량',
        line: '라인',
        status: '상태',
        remarks: '비고',
        actions: '행 동작',
      },
      fieldLabel: (rowName: string, field: string): string => `${rowName} ${field}`,
      errors: {
        REQUIRED: '필수 값입니다.',
        INVALID_DATE: '올바른 날짜를 고르세요.',
        INVALID_QUANTITY: '0보다 큰 수량을 입력하세요.',
        INVALID_SELECTION: '목록에서 다시 고르세요.',
      },
      remove: (rowName: string): string => `${rowName} 삭제`,
      removeShort: '삭제',
      failedTitle: '계획을 저장하지 못했습니다',
      empty: '등록된 계획이 없습니다.',
      total: (planned: string, ordered: string, uom: string): string =>
        `계획 수량 합계 ${planned} / ${ordered} ${uom}`,
    },
    planConfirm: {
      title: '전개 확정',
      target: (plans: string): string => `대상 계획: ${plans}`,
      task: '전개 확정',
      effects: {
        plans: (count: number): string => `생산계획 상태 변경: 확정 (${String(count)}건)`,
        workOrders: (count: number, operations: string): string =>
          `W/O ${String(count)}건 생성: ${operations}`,
      },
      irreversible: '확정 후에는 수정할 수 없습니다. W/O 취소로 처리합니다.',
      confirm: '전개 확정',
    },
    pickers: {
      line: '생산 라인 선택',
      equipment: '설비 선택',
      mold: '금형 선택',
      worker: '작업자 선택',
      location: '위치 선택',
      columns: {
        lineCode: '라인 코드',
        lineName: '라인명',
        equipmentCode: '설비 코드',
        equipmentName: '설비명',
        moldCode: '금형 코드',
        moldName: '금형명',
        workerNo: '사번',
        workerName: '성명',
        locationCode: '위치 코드',
        locationName: '위치명',
        warehouse: '창고',
      },
    },
    assign: {
      listHeading: 'W/O 목록',
      columns: {
        workOrderNo: 'W/O 번호',
        operation: '공정',
        status: '배정',
      },
      done: '배정 완료',
      pending: '배정 미완',
      empty: '배포할 W/O가 없습니다',
      selectPrompt: '왼쪽 목록에서 W/O를 고르세요',
      editorHeading: '4M 배정',
      editorLabel: (workOrderNo: string): string => `${workOrderNo} 4M 배정`,
      editorTitle: (workOrderNo: string, operation: string): string =>
        `${workOrderNo} ${operation}`,
      discard: {
        title: '변경 저장 안 함',
        body: '저장하지 않은 변경이 있습니다. 저장하지 않고 다른 W/O로 옮기면 변경이 사라집니다.',
        confirm: '저장 안 하고 이동',
      },
      groups: {
        equipmentAndMold: '설비와 금형',
        workerAndShift: '작업자와 교대',
        plan: '계획',
        location: '위치',
      },
      shiftOption: (name: string, start: string, end: string): string =>
        `${name} ${start} ~ ${end}`,
      fields: {
        productionLineId: '생산 라인',
        plannedEquipmentId: '설비',
        plannedMoldId: '금형',
        responsibleWorkerId: '담당 작업자',
        plannedShiftId: '계획 교대',
        defaultWipLocationId: '기본 WIP 위치',
        defaultFgLocationId: '기본 완제품 위치',
        defaultScrapLocationId: '기본 스크랩 위치',
        plannedStartAtLocal: '계획 시작',
        plannedEndAtLocal: '계획 종료',
        priorityNo: '우선순위',
      },
      /** 자동으로 채워지는 값의 요약 한 줄(T-W-C 높이가 모자랄 때 ①). 쉼표는 규칙 예시를 따른다. */
      fold: {
        change: '변경',
        changeLabel: (name: string): string => `${name} 변경`,
        lineLocations: '라인 기본 위치',
        locations: '기본 위치',
        shiftPlan: '교대 기준 계획',
        plan: '계획',
        wip: 'WIP',
        fg: '완제품',
        scrap: '스크랩',
        start: '시작',
        end: '종료',
        priority: '우선순위',
        unset: '미지정',
        afterLine: '생산 라인을 고르면 채웁니다',
      },
      lineHint: '생산 라인을 고르면 그 라인의 기본 위치로 채웁니다.',
      lineHintLabel: '생산 라인 도움말',
      shiftPlaceholder: '교대를 고르세요',
      shiftNone: '배정 없음',
      recommend: {
        group: (label: string): string => `${label} 추천`,
        apply: (label: string, name: string): string => `${label} 추천 적용: ${name}`,
        chip: (code: string): string => `추천 ${code}`,
      },
      check: {
        loading: '점검 중',
        blocked: '점검 차단',
        warning: '점검 경고',
        passed: '점검 통과',
      },
      actions: {
        check: '점검 다시 실행',
        reset: '변경 취소',
        save: '저장',
      },
      loadFailed: 'W/O를 불러오지 못했습니다',
    },
    release: {
      heading: '배포할 W/O',
      columns: {
        workOrderNo: 'W/O 번호',
        operation: '공정',
        orderQty: '지시 수량',
        lotSize: 'LOT 크기',
        lotCount: '생산 LOT 수',
      },
      lotSizeLabel: (workOrderNo: string): string => `${workOrderNo} LOT 크기`,
      task: '배포',
      effects: {
        status: (count: number): string => `W/O 상태 변경: 배포 (${String(count)}건)`,
        lots: (count: number): string => `생산 LOT 선발행 (${String(count)}개)`,
        materials: '자재 출고 요청 발행',
      },
      irreversible: '배포 후에는 수정할 수 없습니다. W/O 취소로 처리합니다.',
      release: '배포',
      failed: (workOrderNo: string, reason: string): string => `${workOrderNo}: ${reason}`,
    },
    done: {
      heading: '처리 결과',
      success: (orderNo: string, count: number): string =>
        `${orderNo}의 W/O ${String(count)}건을 배포했습니다`,
      statusLine: (workOrderNo: string, operation: string, status: string): string =>
        `${workOrderNo} ${operation}: ${status}`,
      /** 작업함으로 돌아가는 버튼. 부르는 쪽이 「으로/로」를 붙인다(C-5). */
      toWorklist: SCREEN_NAME,
      nextOrder: '다음 ERP W/O',
      alreadyReleased: '이 ERP W/O의 W/O는 모두 배포되었습니다',
    },
  },
} as const;
