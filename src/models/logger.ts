const LEVEL_LOG = 1;
const LEVEL_WARN = 2;
const LEVEL_ERROR = 4;

export const LogLevel = {
  LOG: LEVEL_LOG,
  WARN: LEVEL_WARN,
  ERROR: LEVEL_ERROR,
  ALL: LEVEL_LOG | LEVEL_WARN | LEVEL_ERROR,
  NONE: 0,
};

export class Logger {
  constructor(
    public level: number,
    public logCallback?: (level: number, ...values: any[]) => unknown,
  ) { }

  private _log = (level: number, fallbackCallback: (...values: any[]) => unknown, ...values: any[]) => {
    if (!this.isActive() || (level & this.level) === 0)
      return;

    if (this.logCallback) {
      this.logCallback(level, ...values);
    }
    else
      fallbackCallback('ng112-js', ...values);
  }

  log = (...values: any[]) => this._log(LogLevel.LOG, (...values: any[]) => console.log(...values), ...values);
  warn = (...values: any[]) => this._log(LogLevel.WARN, (...values: any[]) => console.warn(...values), ...values);
  error = (...values: any[]) => this._log(LogLevel.ERROR, (...values: any[]) => console.error(...values), ...values);

  isActive = (): boolean => this.level !== LogLevel.NONE;
  isExternal = (): boolean => !!this.logCallback;
  isFallback = (): boolean => !this.logCallback;

  static getFromConfig = (config?: boolean | number | ((level: number, ...values: any[]) => unknown)) => {
    let debugFunction: ((level: number, ...values: any[]) => unknown) | undefined = undefined;
    if (config === true)
      config = LogLevel.ALL;
    else if (typeof config === 'function') {
      debugFunction = config;
      config = LogLevel.ALL;
    }
    else if (!config)
      config = LogLevel.NONE;

    return new Logger(config, debugFunction);
  }
}