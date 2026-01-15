type SelectorFn<T, U> = (data: T) => U;

export const maxElement = <T, U>(data: T[], selector: SelectorFn<T, U>): T => {
  return data.reduce((a: T, b: T): T => selector(a) > selector(b) ? a : b)
}

export const minElement = <T, U>(data: T[], selector: SelectorFn<T, U>): T => {
  return data.reduce((a: T, b: T): T => selector(a) <= selector(b) ? a : b)
}