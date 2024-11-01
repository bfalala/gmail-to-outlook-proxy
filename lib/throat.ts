import throat from "throat";

export function throatNamespace<T extends (...args: any[]) => any>(
  limit: number,
  fn: T
) {
  const throats: Record<
    string,
    {
      fn: T;
      n: number;
    }
  > = {};
  return async (
    namespace: string,
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> => {
    if (!throats[namespace]) {
      throats[namespace] = {
        fn: throat(limit, fn) as any,
        n: 0,
      };
    }
    throats[namespace].n++;
    try {
      return await throats[namespace].fn(...args);
    } finally {
      throats[namespace].n--;
      if (throats[namespace].n === 0) {
        delete throats[namespace];
      }
    }
  };
}
