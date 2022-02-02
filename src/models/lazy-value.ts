export class LazyValue<T> {
  private _cache?: T;

  constructor(
    private _getter: () => T,
  ) { }

  get = (): T => {
    if (this._cache)
      return this._cache
    else
      return this._cache = this._getter();
  }

  set = (value: T) => {
    this._cache = value;
  }
}

export class ULazyValue<T> extends LazyValue<T | undefined> { }