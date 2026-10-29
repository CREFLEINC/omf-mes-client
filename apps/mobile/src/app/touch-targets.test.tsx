import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * 화면 폴더 아래 몇 단계든 본다. 화면을 단계 파일로 나누거나 화면들이 함께 쓰는 확정 바를
 * patterns 에 두면, 한 단계만 보는 검사는 그 단추를 보지 못한 채 초록으로 남는다.
 */
const tsxUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return tsxUnder(path);
    }

    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : [];
  });

const screenFiles = (): { name: string; text: string }[] =>
  ['screens', 'patterns'].flatMap((root) =>
    tsxUnder(join(SRC, root)).map((path) => ({
      name: path.slice(SRC.length + 1),
      text: readFileSync(path, 'utf-8'),
    })),
  );

/**
 * 장갑을 낀 손이 누르는 자리는 72픽셀이어야 하고 그것을 내는 것은 2xl 하나다.
 *
 * 화면마다 눈으로 맞추면 화면끼리 규격이 갈린다.
 */
/*
 * 검사를 patterns 까지 넓히며 드러난, 전부터 있던 예외다. 대화상자 바닥에 두 단추가 나란히
 * 서는 자리라 2xl 로 키우면 360dp 한 줄에 들어가는지 실기에서 본 뒤 정한다. 새 예외를 여기에
 * 더하지 않는다.
 *
 * 기기 등록 해제 창도 같은 자리다 - 사번 확인 화면(2xl 단추가 함께 있어 검사에 안 걸렸다)에서
 * 설정으로 옮기며 파일만 나뉘었다(사용자 지시 2026-10-21). 창 단추가 xl 인 것은 그 화면 시험이
 * 따로 지킨다.
 */
const KNOWN_EXCEPTIONS = new Set([
  'patterns/scan-replace-dialog.tsx',
  'screens/device-registration/unregister.tsx',
]);

describe('터치 규격', () => {
  it('핵심 액션 버튼은 2xl 이다', () => {
    const offenders = screenFiles()
      .filter((file) => !KNOWN_EXCEPTIONS.has(file.name))
      .filter((file) => file.text.includes('variant="filled"'))
      .filter((file) => !file.text.includes('size="2xl"'))
      .map((file) => file.name);

    expect(offenders).toEqual([]);
  });

  /* 입력류는 xl 이 최대다. 그보다 크게 주면 타입이 막는다 - 여기서는 관례만 지킨다. */
  it('입력류에 2xl 을 주지 않는다', () => {
    const offenders = screenFiles()
      .filter((file) => /<(TextField|TextArea|Select|NumberPad)[^>]*size="2xl"/s.test(file.text))
      .map((file) => file.name);

    expect(offenders).toEqual([]);
  });
});
