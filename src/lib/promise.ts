/**
 * This should be moved to a separate common library.
 */

type PromiseOrValue<T> = T | PromiseLike<T>;

export function combine<P1, P2, R>(
  p1: PromiseOrValue<P1>,
  p2: PromiseOrValue<P2>,
  combineFn: (val1: P1, val2: P2) => PromiseOrValue<R>,
): Promise<R>;

export function combine<P1, P2, P3, R>(
  p1: PromiseOrValue<P1>,
  p2: PromiseOrValue<P2>,
  p3: PromiseOrValue<P3>,
  combineFn: (val1: P1, val2: P2, val3: P3) => PromiseOrValue<R>,
): Promise<R>;

export function combine<P1, P2, P3, P4, R>(
  p1: PromiseOrValue<P1>,
  p2: PromiseOrValue<P2>,
  p3: PromiseOrValue<P3>,
  p4: PromiseOrValue<P4>,
  combineFn: (val1: P1, val2: P2, val3: P3, val4: P4) => PromiseOrValue<R>,
): Promise<R>;

/**
 * The actual implementation (this signature is not visible to callers).
 */
export function combine(...args: any[]): Promise<any> {
  // The last argument is always the combine function
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const combineFn = args.pop() as Function;

  // The rest of the arguments are the promises
  const promises = args;

  return Promise.all(promises).then((resolvedValues) => combineFn(...resolvedValues));
}

export function promiseTimeout<R>(delay: number, result: R): Promise<R> {
  return new Promise((resolve) => setTimeout(resolve, delay)).then(() => result);
}

export function promiseLog<R>(log: string, result: R): R {
  console.log(log);
  return result;
}

export function promiseLogWithObject<R>(log: string, result: R): R {
  console.log(log, result);
  return result;
}
