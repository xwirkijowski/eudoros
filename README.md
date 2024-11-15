# 🛠️ Eudoros - Compact & Flexible Logging Utility

![NPM Version](https://img.shields.io/npm/v/eudoros?style=flat&logo=npm&logoColor=ffffff&logoSize=auto&labelColor=C61B3B&color=202B2E)

A powerful and customizable logging library for Node.js, with support for custom log levels, formatting, and file logging.

## Overview

Eudoros is a robust and flexible logging utility for Node.js applications. It allows you to define custom logging levels with configurable prefixes, formatting, and file logging capabilities. The library is designed to be highly extensible and easy to integrate into your project.

> In **Eudoros**, your message strings and arguments passed into the logging methods are called **payloads**.

This utility comes with minimal defaults to ensure it works out of the box. When initializing without any configuration, it will create a single basic logging method. All logs are by default written to the `./logs` directory. See [Default Configuration](#default-configuration) for more details.

> **Fun fact for recruiters** _(\*wink wink\*)_**:** I made this in a under 24 hours (8h of sleep included) with almost non-existent previous TypeScript or module building knowledge. Began work 2 hours before [this commit](https://github.com/xwirkijowski/identity-service/commit/0e91c9fffa0513ed18597b3fe96c8d6949d24c5c) in the [identity-service](https://github.com/xwirkijowski/identity-service) repo. This is my first npm package and I'm pretty proud of it `:)`

## Features

- Define custom log levels with configurable prefixes, handling options, formatting and processing (on log to file)
- Supports various console methods (all valid methods: `log`, `info`, `error`, `warn`, `debug`)
- Fully customizable `Date` object handling with a preferred static method or custom formatting function
- Optional automatic formatting of payload arguments (numbers, arrays, objects)
- Optional console log grouping and exception trace insertion
- Option to output specific logs to separate files
- Asynchronous logging using `process.nextTick()` to avoid blocking your main application
- **(new)** Synchronous mode available! Just add `synchronous: true` to the configuration
- Comprehensive error handling and internal error reporting

## Installation

You can install Eudoros using npm `npm install eudoros`. Remember to use `--save` or `--save-dev` according to your needs.

## Usage

You can manually choose whether to choose the ESM or CJS version. By default `import { Eudoros } from 'eudoros'` will import the CommonJS version. You can use the ECMAScript module version by specifying the export path `import { Eudoros } from 'eudoros/esm'`.


### Basic Example

```typescript
// index.js or logger.js
import { Eudoros } from 'eudoros';

const logger = new Eudoros({
  levels: [
    { label: 'debug', prefix: '[DEBUG]', logToFile: 'debug' },
    { label: 'info', prefix: '[INFO]', logToFile: true },
    { label: 'error', prefix: '[ERROR]', consoleMethodName: 'error', logToFile: 'error' },
  ],
  options: {
    outputDirectory: './logs',
    outputFileExtension: 'log',
    formatArgs: true,
  },
});

logger.debug('This is a debug message');
logger.info('This is an info message');
logger.error('This is an error message', new Error('Something went wrong'));

export default logger; // Export instance for use in other components
```

### EudorosBuilder

As an alternative way to initialize the logger  you can also use the `EudorosBuilder` class. This can be helpful if you want to loop over an array to add your levels.
> Keep in mind that you cannot add new levels after initialization!

```typescript
// index.js or logger.js
import { EudorosBuilder } from 'eudoros';

const builder = new EudorosBuilder({
  outputDirectory: './logs',
  formatArgs: true,
})
  .addLevel({
    label: 'debug',
    prefix: '[DEBUG]',
    logToFile: 'debug',
  })
  .addLevel({
    label: 'info',
    prefix: '[INFO]',
    logToFile: true,
  })
  // ...you can add as many as you like! Just don't overdo it.

const logger = builder.init();

logger.debug('This is a debug message');
logger.info('This is an info message');
logger.error('This is an error message', new Error('Something went wrong'));

export default logger; // Export instance for use in other components
```

### init Function

The last way to initialize is the `init` function, made as an alternative to the class-based approach, because why not?

```typescript
import { init } from 'eudoros';

const logger = init({
  levels: [
    { label: 'debug', prefix: '[DEBUG]', logToFile: 'debug' },
    { label: 'info', prefix: '[INFO]', logToFile: true },
    { label: 'error', prefix: '[ERROR]', consoleMethodName: 'error', logToFile: 'error' },
  ],
  options: {
    outputDirectory: './logs',
    formatArgs: true,
  },
});

logger.debug('This is a debug message');
logger.info('This is an info message');
logger.error('This is an error message', new Error('Something went wrong'));
```

### Logging with domains (distinguishing components)

```js
// auth.service.js
logger.withDomain('debug', 'AuthService', 'Validating token');
logger.withDomain('error', 'AuthService', 'Invalid token', token, error);

// user.service.js
logger.withDomain('info', 'UserService', 'Creating new user', userData);
logger.withDomain('warn', 'UserService', 'Duplicate email detected', email);

// payment.service.js
logger.withDomain('info', 'PaymentService', 'Processing payment', orderId);
logger.withDomain('error', 'PaymentService', 'Payment failed', orderId, error);
```
The `withDomain` method provides an alternative way to log messages with an additional domain tag that appears after the timestamp. This is useful for distinguishing logs from different components or modules in your application.

Specified domain tag will also be included in the file logs (if enabled), making them easier to filter and analyze.

> [!NOTE]
> When using `withDomain`, the domain tag is formatted using the same format array as defined in your level configuration.

#### Method arguments

| Argument  | Type | Description                                                                        |
|-----------|:---:|------------------------------------------------------------------------------------|
| `level`   | `string` | The logging level to use (must match one of your defined levels).                  |
| `domain`  | `string` | A string identifier for the component/module.                                      |
| `...args` | `$E.Payload[]` | The logging payload (supports all the same formatting as regular logging methods). |

## Default Configuration

```typescript
// Default logging levels array if none specified
const default_levels = [{
    label: 'log',
    prefix: '[>]'
}];

// Default options
const default_options = {
    outputDirectory: './logs',
    outputFileExtension: 'log',
    formatArgs: true,
    formatDate: 'toISOString',
    consoleTimestamps: true
};
```

These defaults are merged with provided configuration using spread operator (`{...defaults, ...yourOptions}`), so you only need to specify the options you want to define or override.

## Configuration Options

The Eudoros constructor accepts a `$E.Config` object with the following properties:

### $E.Config

| Property | Type | Description |
| --- |:---:| --- |
| `levels` | `Array<$E.Level>` | An array of logging level objects. |
| `options` | `$E.Options` | Optional configuration options for the logging system. |

### $E.Options

| Property              |          Type           | Default       | Description                                                                                                                                                                                                                                                             |
|-----------------------|:-----------------------:|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `synchronous`         |        `boolean`        | `false`       | Whether to switch to synchronous mode, default `false`. This changes the behavior of the internal `initLevels` and `handleLog` functions.                                                                                                                                        |
| `outputDirectory`     |     `string\|false`     | `'./logs'`    | Specifies the output directory for log files. If `false`, logging to files is disabled.                                                                                                                                                                                 |
| `outputFileExtension` |        `string`         | `log`         | Specifies the file extension to use for the log files.                                                                                                                                                                                                                  |
| `formatArgs`          |        `boolean`        | `true`        | Determines whether to apply formatting to payload arguments (e.g., coloring Date instances, numbers, objects).                                                                                                                                                          |
| `formatDate`          | `string\|$E.FormatDate` | `toISOString` | Determines which [`Date` method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#static_methods) to use when handling dates, or a defines a custom function to handle the formatting instead (see [$E.FormatDate](#eformatdate)). |
| `consoleTimestamps`   |        `boolean`        | `true`        | Enable or disable timestamps in console logs.                                                                                                                                                                                                                           |

### $E.Level

The logging level interface. 

| Property | Type | Description                                                                                                                                                                                                                                                        |
| --- |:---:|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `label` | `string` | The name of the logging level and the only required variable.                                                                                                                                                                                                      |
| `prefix` | `string` | The prefix that appears at the start of the log message in the console.                                                                                                                                                                                            |
| `format` | `[string, string]\|[string, string, string, string]` | The formatting of the timestamp and domain elements ([ANSI bindings](https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797) or extra characters).                                                                                                          |
| `logToFile` | `boolean\|string` | Determines whether to output the log to a file.<br/><ul><li>If a string, it adds the value as a substring  to `log-<here>-{date}.txt` in the filename for this log level.</li><li>If `true` logs to main log file.</li><li>If `false` or unset disabled.</li></ul> |
| `trace` | `$E.Trace` | Options for splitting the payload into message and trace, and grouping them together in separate `console` calls.                                                                                                                                                  |
| `consoleMethodName` | `$E.ConsoleMethod` | The [console method](https://developer.mozilla.org/en-US/docs/Web/API/console#instance_methods) to use for this logging level (e.g., `console.log`, `console.error`). Defaults to `log`.                                                                           |
| `consoleTimestamps` | `boolean` | Override configuration level console timestamp settings.                                                                                                                                                                                                           |
| `methodName` | `string` | The name of the method that will be created, defaults to `label`.                                                                                                                                                                                                  |
| `formatToString` | `$E.formatToString` | A function that processes objects into a string with custom formatting, used only when logging to file.                                                                                                                                                            |

### $E.Trace
> [!IMPORTANT]
> When using the `trace` option, **the last argument in the logging method will always be removed from the payload**.
It will be used in a subsequent `console.trace()` call if it's not `undefined`, `null` or otherwise falsy.

Options used to configure the grouped trace logging.

| Property | Type | Description |
| --- | --- | --- |
| `groupLabel` | `string` | The label passed into `console.group()`. |
| `groupPrefix` | `string` | The prefix for the group label. |
| `format` | `[string, string]` | The formatting of the trace output. |

 #### Example use case
 ```js
 someFunction({foo, bar}, cb => { /* business logic */ }).catch(e => {
   log.critical('Cannot perform this action!', x, y, z, err)
 })
 ```
 Will result in...
 ```
 [⚠] 2024-11-13T19:14:28.774Z Critical error encountered.
    [✗] Cannot perform this action! / x / y / z
    Trace: Error: Something went wrong
        at ...stack trace...
```


### $E.FormatToString
> [!NOTE]
> The `formatToString` function is only called when writing to files, not for console output.
```typescript
interface FormatToString {
    (payload: Payload): string
}
```
This function is especially useful when defining a special logging level for requests or auditing purposes, where usually we directly pass variables with objects or arrays in a specific order for file logging purposes.

It accesses the payload variables and prepares a string to be used on the `handleLog` method, allowing your log to also display in a human-readable form in your application console.

| Argument | Type | Description                                                    |
| --- |:---:|----------------------------------------------------------------|
| `payload` | `Payload` | The logging payload (array of arguments passed to log method). |
| Returns | `string` | Formatted string to be written to the log file.                |

#### Example implementation
```js
const formatToString = (payload) => {
    const [request] = payload; // Assuming first arg is request object
    return `${request.method} ${request.url} - ${request.status}`;
}
```

### $E.FormatDate
> [!NOTE]
> The `formatDate` function also processes the `Date` objects passed into the payload.

```typescript
interface FormatDate {
    (date: Date): string
}
```
This function allows more flexibility when handling dates, as it processes all `Date` objects.

| Argument |   Type   | Description                                                  |
|---------|:--------:|--------------------------------------------------------------|
| `date`  |  `Date`  | The `Date` object to modify.                                 |
| Returns | `string` | Formatted string to be used for all logging purposes. |


## Other Types

### $E.FilePayloadHead
This type represents the metadata header of each log entry when writing to files.

| Property | Type | Description                                                    |
| --- |:---:|----------------------------------------------------------------|
| `timestamp` | `string` | ISO timestamp of when the log was created.                     |
| `level` | `string` | The logging level used (matches the level's label).            |
| `domain` | `string\|undefined` | Optional domain tag if the log was created using `withDomain`. |

### $E.FilePayload
The complete log entry structure that gets written to files. Each line in the log file is a JSON string containing:

| Property                |         Type         | Description                                          |
|-------------------------|:--------------------:|------------------------------------------------------|
| `...lineHead` | `$E.FilePayloadHead` | All properties from `$E.FilePayloadHead`.            |
| `args`                  |   `Array<Payload>`   | Array of all arguments passed to the logging method. |

### $E.Payload
The payload is an array of arguments. The table below represents the valid types that can be passed as logging arguments and the way they are formatted.

| Type | File Log Format        | Console Format (when `formatArgs: true`) |
| --- |------------------------|------------------------------------|
| `string` | Raw string             | Raw string                         |
| `number` | Number                 | Yellow colored text                |
| `boolean` | Boolean                | Raw boolean                        |
| `object` | JSON string            | Cyan colored JSON string           |
| `Array<any>` | Comma-separated string | Green colored comma-separated list |
| `Date` | Formatted string       | Magenta colored string             |
| `Error` | Error `toString()`       | Raw error (for stack traces)       |

### $E.ConsoleMethod
Valid console methods that can be used for logging.

| Value | Description |
| --- | --- |
| `'log'` | Standard output (default) |
| `'info'` | Informational output |
| `'error'` | Error output |
| `'warn'` | Warning output |
| `'debug'` | Debug output |

## Internal Error Handling

Eudoros includes a built-in error reporting system that ensures logging failures don't crash your application. When an error occurs within the logger itself, it will:

1. Create a visually distinct error group in the console with a warning symbol (⚠️)
2. Include timestamp of the exception
3. Display a descriptive error message
4. Show a stack trace if an error object is available
5. Continue operation without interrupting the application

For example, if writing to a log file fails, you'll see:
```shell
[⚠] 2024-11-13T19:14:28.774Z Eudoros caught an exception.
    [>] Cannot write log to file!
    Error: EACCES: permission denied
        at ...stack trace...
```

Common scenarios where internal error handling activates:
- Invalid log level configuration
- File system permission issues
- Custom format function errors
- Invalid console method names

## Contributing

You are welcome to contributions to Eudoros! If you have any ideas, bug reports, or pull requests, feel free to submit them to the [GitHub repository](https://github.com/xwirkijowski/eudoros).

## License

Eudoros is licensed under the [Apache License 2.0](LICENSE).
