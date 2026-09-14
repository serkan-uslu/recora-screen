export type RunAction = <T>(action: () => Promise<T>) => Promise<T | undefined>;
