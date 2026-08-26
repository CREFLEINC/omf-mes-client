import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL 의 자동 cleanup 은 전역 afterEach 가 있을 때만 등록되는데 이 저장소는 vitest globals 를
// 켜지 않는다. 없으면 이전 테스트의 DOM 이 남아 랜드마크 조회가 중복으로 잡힌다.
afterEach(() => {
  cleanup();
});
