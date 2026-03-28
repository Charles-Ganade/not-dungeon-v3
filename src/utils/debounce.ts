interface DebouncedFn<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  abort: () => void;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const fn: DebouncedFn<T> = ((...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  }) as DebouncedFn<T>;
  fn.abort = () => {clearTimeout(timeoutId)}

  fn.abort 

  return fn
}