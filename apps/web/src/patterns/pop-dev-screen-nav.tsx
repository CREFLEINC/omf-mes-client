import { Select } from '@crefle/web-ui';
import { useId } from 'react';
import { useNavigate } from 'react-router';

/**
 * **개발 서버에서만 서는** POP 화면 이동 셀렉터 — 진입 화면(P-CO-01)의 「작업 화면으로
 * 이동」 자리에 선다.
 *
 * ⭐ **왜 있는가.** 그 버튼은 눌러도 아무 일도 하지 않는다 — 갈 곳인 작업 시작 화면
 * (P-02-01 · `/pop/work-start`)은 이제 서 있으나 버튼이 아직 그 주소로 이어지지 않았다.
 * 그리고 POP 화면을 손으로 확인하려면 주소를 직접 쳐야 하는데 단말 셸에는 주소창이 없어,
 * 개발 중 확인 경로가 사람마다 갈렸다. 이 셀렉터가 그 자리를 **개발 중에만** 메운다.
 *
 * ⛔ **배포본에 들어가지 않는다.** 호출부가 `import.meta.env.MODE === 'development'`로 감싸고,
 * 그 값은 빌드 시점에 상수로 치환되어 배포 번들에서는 이 모듈째 걷힌다(실측 — `build:pop`
 * 산출물에 이 파일의 문구가 없다). ⚠ 조건을 런타임 값으로 바꾸면 걷히지 않고 현장 단말에
 * 개발용 조작이 남는다.
 *
 * ⛔ **버튼이 P-02-01로 이어지면 이 파일과 호출부를 함께 걷는다.** 그때 그 버튼이 실제
 * 이동 대상을 갖게 되므로 이 대체물이 남아 있을 이유가 없다.
 */

export interface PopDevScreen {
  /** 라우트 표에 있는 주소 그대로. 감지기가 이 값으로 대조한다. */
  path: string;
  /** 목록에 보일 이름. 화면 ID를 앞에 둔다 — 설계와 같은 말로 부른다. */
  label: string;
  /**
   * 화면이 요구하는 진입값. **없으면 그 화면은 「대상이 없습니다」로 막힌 채 뜬다.**
   *
   * ⚠ **`pnpm mock`(씨앗 서버)에 실제로 있는 번호여야 한다.** 씨앗이 직접 처리하는 자원에
   * 없는 번호를 적으면 404 가 돌아와, 이 셀렉터가 없애려던 「대상이 없습니다」로 그대로 뜬다
   * (실측 — 포장 번호를 씨앗에 없는 값으로 적었다가 걸렸다). 씨앗에 경로가 없는 것은 계약
   * 예시 서버로 넘어가 어떤 번호에도 답한다.
   *
   * ⛔ 제품 데이터가 아니다. 목 자료가 바뀌면 여기도 함께 바뀐다.
   *
   * ⛔ 이 값을 화면 코드가 읽는 기본값으로 옮기지 않는다. 진입값은 화면을 «부르는 쪽»이
   * 정하는 것이고, 화면이 스스로 지어내면 대상 없이 열린 사실이 가려진다.
   */
  query?: string;
}

/**
 * 갈 수 있는 POP 화면. **라우트 표에서 뽑지 않고 여기에 적는다** — 앱 내부 의존은
 * `routes → screens → patterns` 한 방향이라 `patterns`가 `routes`를 부를 수 없다
 * (`.dependency-cruiser.cjs` 「app-inner-direction」).
 *
 * ⭐ **빠진 화면은 감지기가 잡는다.** `routes/pop-dev-screen-nav.test.ts`가 이 목록과
 * `popRoutes`를 대조한다 — 라우트를 부르는 것이 허용되는 자리에 시험을 두어 방향을 지켰다.
 * 새 POP 화면을 붙이면 그 시험이 먼저 걸리므로, 목록이 조용히 낡지 않는다.
 *
 * ⛔ **진입 화면(P-CO-01)은 담지 않는다.** 이 셀렉터가 서 있는 화면이 그 화면이라, 목록에
 * 두면 자기 자신으로 가는 항목이 된다.
 *
 * ⛔ i18n 리소스에 넣지 않는다. 개발 중에만 보이는 문구라 번역 대상이 아니고, 공용 문구
 * 파일은 여러 작업이 동시에 건드리는 자리다.
 */
export const POP_DEV_SCREENS: readonly PopDevScreen[] = [
  { path: '/pop/work-start', label: 'P-02-01 작업 시작' },
  { path: '/pop/material-input', label: 'P-02-03 자재 투입 스캔', query: '?workOrderId=11002' },
  {
    path: '/pop/tag-issue',
    label: 'P-02-05 인식표 발행',
    query: '?workOrderId=11002&workerNo=100029',
  },
  {
    path: '/pop/production-result',
    label: 'P-02-04 작업실적 등록',
    query: '?workOrderId=11002&workerNo=100029',
  },
  {
    path: '/pop/packing-label-reprint',
    label: 'P-02-09 포장 라벨·인식표 재출력',
    query: '?handlingUnitId=13001&workerNo=100029',
  },
  {
    path: '/pop/lot-label',
    label: 'P-02-07 LOT 라벨 출력·부착',
    query: '?workOrderId=11002&workerNo=100029',
  },
  { path: '/pop/pqc-inspection', label: 'P-02-13 PQC 제품 검사', query: '?ir=1001' },
  { path: '/pop/emergency-work-orders', label: 'P-02-12 긴급 작업지시' },
  { path: '/pop/material-lot-label', label: 'P-01-01 자재LOT 등록·라벨' },
  /*
   * ⚠ **씨앗에 출하가 없다** — 이 번호는 씨앗이 아니라 계약 예시 서버가 받아 답한다(씨앗에
   * 경로가 아예 없으면 그리로 넘어간다). 씨앗이 출하를 담게 되면 그때 실제 번호로 바꾼다.
   */
  {
    path: '/pop/shipping-label',
    label: 'P-04-02 납품·포장 라벨 출력',
    query: '?shipmentId=14001&workerNo=100029',
  },
  { path: '/pop/rework-results', label: 'P-04-03 재작업 실적 등록' },
  {
    path: '/pop/tool-usage',
    label: 'P-05-01 공구 사용',
    query: '?workOrderId=11002&workerNo=100029',
  },
  { path: '/pop/downtime', label: 'P-05-02 비가동 등록', query: '?equipmentId=5001' },
  {
    path: '/pop/packing-work',
    label: 'P-02-08 포장 작업',
    /* 씨앗에서 완료 LOT 이 달려 있는 작업지시다 — 다른 번호면 포장 대상이 비어 뜬다. */
    query: '?workOrderId=11001&workerNo=100029',
  },
  {
    path: '/pop/repack-label-issue',
    label: 'P-04-04 재구성 라벨 발행',
    /* P-02-09 와 같은 씨앗 포장을 쓴다 — 씨앗에 실제로 있는 번호여야 한다(위 주석). */
    query: '?handlingUnitId=13001&workerNo=100029',
  },
  /*
   * ⚠ 이 화면은 사번을 주소로 받지 않는다 — 단말·공정·사번은 셸이 채운다. 개발 셸이 그
   * 자리를 합성값으로 채우므로(`app/pop-main.tsx`) 화면은 서고, 등록 가부는 그 단말·공정의
   * 게이팅 조회 결과가 정한다(F-6).
   */
  {
    path: '/pop/running-change',
    label: 'P-02-11 러닝체인지 부품 교체',
    query: '?workOrderId=11002',
  },
  /*
   * ⚠ **씨앗에 출고 전표가 없다** — 이 번호는 계약 예시 서버가 받아 답한다(위 출하와 같은
   * 사정). 씨앗이 출고를 담게 되면 그때 실제 번호로 바꾼다.
   */
  {
    path: '/pop/goods-issue-qr',
    label: 'P-01-02 출고 QR 발행',
    query: '?goodsIssueId=15001&workerNo=100029',
  },
  /*
   * ⚠ 이 화면도 진입 컨텍스트를 주소로 받는다(`?workOrderId=`) — 작업지시 선택이 셸에 서기
   * 전까지의 임시 경로다. 사번은 셸·`worker-session` 이 비었을 때만 주소를 본다.
   */
  {
    path: '/pop/work-hold',
    label: 'P-02-10 작업 중단(홀드) 등록',
    query: '?workOrderId=11002',
  },
];

/** 진입 화면 — 이 셀렉터가 서 있는 자리라 목록에서 뺀다. 감지기가 이 예외를 안다. */
export const POP_DEV_ENTRY_PATH = '/pop/worker-assignment';

/** 트리거의 접근성 이름 — 시험과 화면이 같은 값을 보게 한 자리에 둔다. */
export const POP_DEV_SCREEN_NAV_LABEL = '개발용 화면 이동';

export interface PopDevScreenNavProps {
  /** 대체하는 버튼과 같은 조건으로 잠근다 — 작업자가 정해지기 전에는 넘어가지 않는다. */
  disabled: boolean;
}

export const PopDevScreenNav = ({ disabled }: PopDevScreenNavProps) => {
  const navigate = useNavigate();
  const labelId = useId();

  return (
    <>
      {/*
       * ⛔ **`aria-label` 로 때우지 않는다**(`docs/layout-conventions.md` 규범 3). 디자인
       * 시스템의 `Select` 는 `label` prop 을 주지 않으므로 보이는 이름을 직접 만들어 잇는다 —
       * `aria-label` 만 두면 **눈으로 보이는 이름이 없어** 무엇을 고르는 칸인지 알 수 없다.
       * 같은 셸의 전례가 이 형태다(`screens/downtime-register/reason-fields.tsx`).
       */}
      <span className="field-label" id={labelId}>
        {POP_DEV_SCREEN_NAV_LABEL}
      </span>
      <Select
        aria-labelledby={labelId}
        /*
         * ⚠ **옆 버튼들의 `POP_TOUCH_SIZE`(2xl)를 쓸 수 없다.** `SelectSize` 는 `xl` 까지고
         * 그 상수는 `ButtonSize` 다 — 타입이 다르다. 디자인 시스템이 `Select` 에 72px 변형을
         * 내려 주면 그때 한 자리로 모은다.
         */
        size="xl"
        disabled={disabled}
        placeholder={POP_DEV_SCREEN_NAV_LABEL}
        /*
         * ⭐ **고른 값을 남기지 않는다.** 고르는 즉시 다른 화면으로 떠나므로 「지금 여기서
         * 무엇이 골라져 있는가」라는 상태가 성립하지 않는다 — 비제어로 두면 부품이 그 상태를
         * 대신 들고 있다가, 돌아왔을 때 가지도 않을 화면 이름을 띄운다.
         */
        value={null}
        options={POP_DEV_SCREENS.map(({ path, label, query }) => ({
          value: `${path}${query ?? ''}`,
          label,
        }))}
        onChange={(target) => {
          void navigate(target);
        }}
      />
    </>
  );
};
