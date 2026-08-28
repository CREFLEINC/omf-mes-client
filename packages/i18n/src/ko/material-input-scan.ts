/**
 * P-02-03 자재 투입 스캔·오투입 검증. **POP(현장 단말) 화면**이라 관리웹과 어휘가 갈린다.
 *
 * - 작업자가 장갑을 낀 채 읽는다. 문장을 짧게 쓰고 한 줄에 한 가지만 말한다.
 * - **「통과」가 「정상」이 아니다.** 출고 미귀속·교차 투입은 막지 않고 기록만 하는데,
 *   나중에 계보를 추적할 때 그 구분이 필요하다 — 그래서 표시할 말이 따로 있다.
 * - 판정 문구를 화면이 지어내지 않는다. 자재 상태·오투입 판정은 서버가 하고 화면은 옮긴다.
 */
export const materialInputScan = {
  title: '자재 투입',
  panes: {
    receipt: '계획 대비 수령',
    scan: '스캔',
  },
  header: {
    /** W/O 를 주소에서 받지 못한 상태 — 무엇을 해야 하는지까지 적는다. */
    workOrderMissing: '작업지시가 지정되지 않았습니다. 작업지시를 고른 뒤 다시 들어오세요.',
    workOrder: (workOrderId: number): string => `작업지시 #${String(workOrderId)}`,
  },
  table: {
    item: '품목',
    lot: 'LOT',
    issuedQty: '출고',
    receivedQty: '수령',
    varianceQty: '차이',
    status: '상태',
  },
  /** 수령 상태 — 서버가 계산한 차이 수량을 세 갈래로 옮긴 것이다. 값을 만들지 않는다. */
  receiptStatus: {
    matched: '수령 완료',
    short: '수령 부족',
    none: '미수령',
  },
  loading: {
    receipt: '라인 수령 내역을 불러오는 중',
  },
  empty: {
    receiptTitle: '수령 내역이 없습니다',
    receiptDescription: '이 작업지시로 라인에 내려온 자재가 아직 없습니다.',
    /* 조회 자체가 나가지 않은 상태 — 「받은 자재가 없다」와 다른 말을 한다. */
    notQueriedTitle: '아직 조회하지 않았습니다',
  },
  notes: {
    /* 부족·미수령은 투입을 막지 않는다(스펙 §6) — 밝히지 않으면 작업자가 멈춰 선다. */
    shortAllowed: '부족·미수령이 있어도 수령한 양으로 투입할 수 있습니다.',
    /* 스캐너가 없거나 코드가 상했을 때의 대체 경로(스펙 §6 「스캔 실패」). */
    manualEntry: '스캔이 되지 않으면 코드를 직접 입력하고 Enter를 누르세요.',
  },

  /** 스캔 구획 — 자재LOT과 금형을 **같은 칸**에서 받는다(스펙 §3). */
  scan: {
    label: '자재LOT / 금형 코드',
    submit: '읽기',
    scanning: '조회 중',
    /**
     * 스캔 한 번의 결과를 말하는 자리. 실패도 그 자리에서 말한다 — 화면을 옮기지 않는다.
     *
     * ⭐ **읽은 코드와 찾은 것을 함께 말한다.** LOT 검색은 번호의 일부나 외부 식별자로도
     * 걸리므로 **읽은 것과 찾은 것이 다를 수 있다.** 찾은 쪽만 말하면 작업자는 자기가 읽지
     * 않은 번호를 보고도 왜 그런지 알 수 없고, 잘못 걸린 것인지 판단할 근거가 없다.
     */
    outcomes: {
      material: (code: string, lotNo: string): string =>
        code === lotNo ? `${lotNo} 담았습니다.` : `${code} → ${lotNo} 담았습니다.`,
      mold: (code: string, moldCode: string): string =>
        code === moldCode
          ? `금형 ${moldCode} 물렸습니다.`
          : `${code} → 금형 ${moldCode} 물렸습니다.`,
      duplicate: (code: string, lotNo: string): string =>
        code === lotNo
          ? `${lotNo}은(는) 이미 담겨 있습니다.`
          : `${code} → ${lotNo}은(는) 이미 담겨 있습니다.`,
      ambiguous: (count: number): string =>
        `${String(count)}건이 함께 검색됐습니다. 코드를 더 정확히 읽어 주세요.`,
      notFound: (code: string): string => `${code}을(를) 찾을 수 없습니다.`,
      failed: '조회하지 못했습니다. 다시 읽어 주세요.',
    },
  },

  /** 담긴 투입 후보 목록. **아직 보내지 않은 것**이다. */
  scanned: {
    materialsLabel: '담은 자재',
    moldLabel: '물린 금형',
    remove: '빼기',
    /** 스펙 §4-B의 유일한 「입력」 칸. 되돌릴 수 없는 값이라 문구가 무엇을 치는지 못박는다. */
    qtyLabel: (lotNo: string): string => `${lotNo} 투입 수량`,
    qtyProblems: {
      empty: '투입 수량을 입력하세요.',
      format: '투입 수량은 숫자로 입력하세요.',
      notPositive: '투입 수량은 0보다 커야 합니다.',
    },
    /** 서버가 통과시키되 기록만 한 것 — 스펙 §5-3. 「통과」가 「정상」이 아니다. */
    unlinkedIssue: '출고 미귀속',
    crossProcess: '교차 투입',
    removeMaterial: (lotNo: string): string => `${lotNo} 빼기`,
    empty: '아직 아무것도 담지 않았습니다.',
    moldEmpty: '물린 금형이 없습니다.',
    /** LOT 상태는 **표시만 한다** — 투입 가부는 서버가 정한다(스펙 §5-2). */
    statusLabel: '상태',
    /** 품질 판정과 **다른 축**이다. 나란히 두면 모순처럼 읽혀 줄을 나눈다. */
    heldMark: '보류 중',
    /** 표시명을 못 받았을 때. 원문 코드를 그대로 보이므로 담당자에게 전할 단서는 남는다. */
    statusLabelUnavailable: '상태 이름을 불러오지 못해 코드로 표시합니다.',
    shotCount: (current: number, guaranteed: number): string =>
      `타발 ${current.toLocaleString('ko-KR')} / ${guaranteed.toLocaleString('ko-KR')}`,
    /* 적정 타수가 마스터에 없으면 남은 타수를 낼 수 없다. 0으로 채우지 않는다. */
    shotCountUnknown: (current: number): string =>
      `타발 ${current.toLocaleString('ko-KR')} · 적정 타수 없음`,
    /* 넘어도 막지 않는다(미결 #6 — 경고만). 그 사실을 문구가 함께 말한다. */
    shotCountExceeded: '적정 타수를 넘었습니다. 투입은 막지 않지만 교체를 검토하세요.',
  },

  /** 투입 확정 — **이번 회차에는 누를 수 없다.** 아래 사유가 그 이유를 밝힌다. */
  confirm: {
    action: '투입 확정',
    /**
     * 비활성 사유는 그 컨트롤의 이름으로 시작한다.
     *
     * ⛔ 내부 절차·이슈 번호를 넣지 않는다 — 작업자가 쓰지 않는 말이다. 「무엇이 막혔는지 +
     * 누가 풀 수 있는지」까지만 적는다.
     */
    reasons: {
      nothingScanned: '투입 확정은 자재를 하나 이상 담아야 누를 수 있습니다.',
      /**
       * ⛔ **아래 셋을 한 문장으로 합치지 않는다**(공유계약 F-6).
       *
       * 「권한이 없다」와 「확인할 수 없다」는 작업자가 할 일이 다르다 — 앞은 관리자에게
       * 가야 하고 뒤는 다시 시도하면 풀린다. 합치면 열려 있는 단말에서 작업자가 관리자를
       * 찾아가고, 막힌 단말에서 되읽기를 반복한다.
       */
      denied: '이 단말은 이 공정의 자재 투입 권한이 없습니다. 관리자에게 문의하세요.',
      unavailable: '투입 권한을 확인할 수 없습니다. 다시 시도해 주세요.',
      unidentified: '단말이 확인되지 않았습니다. 작업지시를 고른 뒤 다시 들어오세요.',
      checking: '투입 권한을 확인하는 중입니다.',
      qtyMissing: '투입 확정은 담은 자재마다 수량을 입력해야 누를 수 있습니다.',
      workerMissing: '작업자가 확인되지 않았습니다. 사번을 확인한 뒤 다시 들어오세요.',
      sending: '투입을 기록하는 중입니다.',
    },
    /**
     * 무엇을 다시 하는지 드러나야 한다 — 「다시 확인」만으로는 스캔을 다시 하라는 것인지
     * 투입을 다시 하라는 것인지 알 수 없다. 이 버튼이 하는 일은 **권한 조회 한 번**이다.
     */
    retry: '투입 권한 다시 조회',
    /** 되돌릴 수 없는 기록이 남았다는 사실을 그 자리에서 말한다. */
    recorded: (count: number): string => `${String(count)}건을 투입 기록했습니다.`,
    /**
     * ⚠ **몇 건이 들어갔는지 함께 말한다.** 서버에 일괄 취소가 없고 정정 경로도 없어
     * (스펙 §8 미결 9), 작업자가 무엇을 다시 해야 하는지는 그 수가 정한다.
     */
    partiallyRecorded: (count: number): string =>
      `${String(count)}건까지 기록된 뒤 실패했습니다. 기록된 것은 남아 있습니다.`,
    failed: '투입을 기록하지 못했습니다.',
  },
} as const;
