export enum LogLevel {
  DEBUG = 'debug',
}

// TODO: should be set by config
const logLevel = LogLevel.DEBUG;

export const log = (message: string | undefined, level = LogLevel.DEBUG) => {
  if (logLevel === LogLevel.DEBUG && level === LogLevel.DEBUG)
    console.log(message);
};
