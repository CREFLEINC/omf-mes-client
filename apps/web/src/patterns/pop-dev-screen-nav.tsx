import { Select, type SelectOption } from '@crefle/web-ui';
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

/**
 * 갈 수 있는 POP 화면. **라우트 표에서 뽑지 않고 여기에 적는다** — 앱 내부 의존은
 * `routes → screens → patterns` 한 방향이라 `patterns`가 `routes`를 부를 수 없다
 * (`.dependency-cruiser.cjs` 「app-inner-direction」).
 *
 * ⭐ **빠진 화면은 감지기가 잡는다.** `routes/pop-dev-screen-nav.test.tsx`가 이 목록과
 * `popRoutes`를 대조한다 — 라우트를 부르는 것이 허용되는 자리에 시험을 두어 방향을 지켰다.
 * 새 POP 화면을 붙이면 그 시험이 먼저 걸리므로, 목록이 조용히 낡지 않는다.
 *
 * ⛔ i18n 리소스에 넣지 않는다. 개발 중에만 보이는 문구라 번역 대상이 아니고, 공용 문구
 * 파일은 여러 작업이 동시에 건드리는 자리다.
 */
export const POP_DEV_SCREENS: SelectOption[] = [
  { value: '/pop/worker-assignment', label: 'P-CO-01 작업자 지정' },
  { value: '/pop/material-input', label: 'P-02-03 자재 투입 스캔' },
  { value: '/pop/tool-usage', label: 'P-05-01 공구 사용' },
  { value: '/pop/emergency-work-orders', label: 'P-02-12 긴급 작업지시' },
  { value: '/pop/downtime', label: 'P-05-02 비가동 등록' },
  { value: '/pop/material-lot-label', label: 'P-01-01 자재LOT 등록·라벨' },
  { value: '/pop/pqc-inspection', label: 'P-02-13 PQC 제품 검사' },
  { value: '/pop/tag-issue', label: 'P-02-05 인식표 발행' },
  { value: '/pop/work-start', label: 'P-02-01 작업 시작' },
  { value: '/pop/rework-results', label: 'P-04-03 재작업 실적 등록' },
];

/** 트리거의 접근성 이름 — 시험과 화면이 같은 값을 보게 한 자리에 둔다. */
export const POP_DEV_SCREEN_NAV_LABEL = '개발용 화면 이동';

export interface PopDevScreenNavProps {
  /** 대체하는 버튼과 같은 조건으로 잠근다 — 작업자가 정해지기 전에는 넘어가지 않는다. */
  disabled: boolean;
}

export const PopDevScreenNav = ({ disabled }: PopDevScreenNavProps) => {
  const navigate = useNavigate();

  return (
    <Select
      aria-label={POP_DEV_SCREEN_NAV_LABEL}
      size="xl"
      disabled={disabled}
      placeholder={POP_DEV_SCREEN_NAV_LABEL}
      options={POP_DEV_SCREENS}
      onChange={(path) => {
        void navigate(path);
      }}
    />
  );
};
