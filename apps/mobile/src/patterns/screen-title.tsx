import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ScreenTitle {
  text: string;
  /** 앱바를 한 줄로 두고 사번 칩을 뺀다. 화면 본문이 사번을 따로 보여 주는 자리만 켠다. */
  compact: boolean;
}

interface ScreenTitleOptions {
  compact?: boolean;
}

interface ScreenTitleStore {
  title: ScreenTitle | null;
  setTitle: (title: ScreenTitle | null) => void;
}

const ScreenTitleContext = createContext<ScreenTitleStore | null>(null);

export const ScreenTitleProvider = ({ children }: { children: ReactNode }) => {
  const [title, setTitle] = useState<ScreenTitle | null>(null);

  return (
    <ScreenTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </ScreenTitleContext.Provider>
  );
};

export const useCurrentScreenTitle = (): string | null =>
  useContext(ScreenTitleContext)?.title?.text ?? null;

export const useCompactTopbar = (): boolean =>
  useContext(ScreenTitleContext)?.title?.compact ?? false;

/**
 * 화면 제목을 앱바로 넘긴다.
 *
 * 좁은 단말에서 본문은 제목까지 담을 만큼 넉넉하지 않고, 앱바는 어차피 자리를 차지하고
 * 있으면서 비어 있다. 화면을 떠나면 앞 화면의 제목이 남지 않게 지운다.
 */
export const useScreenTitle = (
  title: string,
  { compact = false }: ScreenTitleOptions = {},
): void => {
  const store = useContext(ScreenTitleContext);
  const setTitle = store?.setTitle;

  useEffect(() => {
    if (setTitle === undefined) {
      return;
    }

    setTitle({ text: title, compact });
    return () => {
      setTitle(null);
    };
  }, [setTitle, title, compact]);
};
