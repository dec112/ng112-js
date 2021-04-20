import { Logger, LogLevel } from './logger';

describe('Logger functionality', () => {
  it('Should support external callback functions', () => {
    const debug = new Logger(LogLevel.ALL, (level: number, ...values: any[]) => {
      expect(level).toBe(LogLevel.LOG);
      expect(values[0]).toBe('Test');
      expect(values[1]).toBe('Log');
    });

    debug.log('Test', 'Log');
  });

  it('Should only log specific log levels', () => {
    const mock = jest.fn();

    const debug = new Logger(LogLevel.LOG | LogLevel.ERROR, mock);

    debug.log('1');
    debug.warn('2');
    debug.error('3');
    debug.error('4');
    debug.warn('5');

    expect(mock).toHaveBeenNthCalledWith(1, LogLevel.LOG, '1');
    expect(mock).toHaveBeenNthCalledWith(2, LogLevel.ERROR, '3');
    expect(mock).toHaveBeenNthCalledWith(3, LogLevel.ERROR, '4');
  });

  it('Should not debug anything if log level is NONE', () => {
    const mock = jest.fn();

    const debug = new Logger(LogLevel.NONE, mock);

    debug.log('');
    debug.warn('');
    debug.error('');

    expect(mock).not.toHaveBeenCalled();
  });

  it('Should be able to debug objects', () => {
    const mock = jest.fn();
    const obj = {
      a: 'plain',
      js: 'object',
    };

    const debug = new Logger(LogLevel.ALL, mock);

    debug.warn(obj);

    expect(mock).toHaveBeenCalledWith(LogLevel.WARN, obj);
  });

  it('Should fall back to console if no log callback is specified', () => {
    const debug = new Logger(LogLevel.ALL);
    const spy = jest.spyOn(console, 'log');

    debug.log('Logging test');

    expect(spy).toHaveBeenCalledWith('ng112-js', 'Logging test');

    spy.mockRestore();
  });
})