/**
 * 허용 의존 관계 검사 — 구조설계 v0.2 §4.2가 정본.
 * 워크스페이스 경계는 잘못된 방향의 "선언"까지는 막지 못하므로 여기서 검증한다.
 * 규칙의 to.path는 해석된 경로와 @omf-mes/* 지정자를 모두 매칭한다(미해석 import 대비).
 */

const EXCLUDED_BUILD_OUTPUT = [
  '(^|/)dist/',
  '(^|/)android/(\\.gradle|build|app/build|app/src/main/assets)/',
].join('|');

module.exports = {
  forbidden: [
    {
      name: 'domain-depends-on-nothing',
      comment: 'domain은 프로젝트 내부 패키지에 의존하지 않는다',
      severity: 'error',
      from: { path: '(^|/)packages/domain/' },
      to: { path: '(^|/)packages/(api-client|ui|i18n)/|(^|/)apps/|^@omf-mes/(api-client|ui|i18n|web)' },
    },
    {
      name: 'api-client-only-domain',
      comment: 'api-client는 domain에만 의존할 수 있다',
      severity: 'error',
      from: { path: '(^|/)packages/api-client/' },
      to: { path: '(^|/)packages/(ui|i18n)/|(^|/)apps/|^@omf-mes/(ui|i18n|web)' },
    },
    {
      name: 'ui-is-presentation-only',
      comment: 'ui는 domain·api-client에 의존하지 않는다 — 데이터는 props로 받는다',
      severity: 'error',
      from: { path: '(^|/)packages/ui/' },
      to: { path: '(^|/)packages/(domain|api-client|i18n)/|(^|/)apps/|^@omf-mes/(domain|api-client|i18n|web)' },
    },
    {
      name: 'i18n-depends-on-nothing',
      comment: 'i18n은 아무것도 참조하지 않는다',
      severity: 'error',
      from: { path: '(^|/)packages/i18n/' },
      to: { path: '(^|/)packages/(domain|api-client|ui)/|(^|/)apps/|^@omf-mes/(domain|api-client|ui|web)' },
    },
    {
      name: 'no-cross-app',
      comment: 'apps 간 직접 의존 금지',
      severity: 'error',
      from: { path: '(^|/)apps/([^/]+)/' },
      to: { path: '(^|/)apps/', pathNot: '(^|/)apps/$2/' },
    },
    {
      name: 'app-inner-direction',
      comment: '앱 내부는 routes → screens → patterns 한 방향 — 역방향 참조 금지',
      severity: 'error',
      from: { path: '(^|/)apps/([^/]+)/src/(screens|patterns)/' },
      to: { path: '(^|/)apps/$2/src/(routes|app)/' },
    },
    {
      name: 'patterns-not-into-screens',
      comment: 'patterns는 특정 화면을 알지 않는다',
      severity: 'error',
      from: { path: '(^|/)apps/([^/]+)/src/patterns/' },
      to: { path: '(^|/)apps/$2/src/screens/' },
    },
  ],
  options: {
    // 루트에서 도는 depcruise 는 하위 디렉터리의 .gitignore 를 읽지 않는다.
    // 빌드 산출물이 순회에 섞이면 「방금 빌드했는지」에 따라 모듈 수가 달라진다.
    // 산출물이 놓이는 자리만 적는다 — `build` 를 경로 어디서나 잡으면 `src/build/`
    // 같은 소스까지 조용히 빠져 검사가 그 범위에서 눈이 먼다.
    exclude: { path: EXCLUDED_BUILD_OUTPUT },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types'],
    },
  },
};
