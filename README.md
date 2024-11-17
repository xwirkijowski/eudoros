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

You can manually choose whether to choose the ESM or CJS version.
- By default `import { Eudoros } from 'eudoros'` will import the CommonJS version.
- You can use the ECMAScript module version by specifying the export path `import { Eudoros } from 'eudoros/esm'`.

See [DOCS.md](DOCS.md) for detailed configuration options and type documentation.

### Basic Example

> [!TIP]
> Usually you don't have to specify `consoleMethod` in level options.
> 
> When left undefined, Eudoros will try to use match the `label` property to supported `console` methods, and when it fails to find a match, it will fall back to the `console.log` method.

```typescript
// index.js or logger.js
import { Eudoros } from 'eudoros';

const logger = new Eudoros({
  levels: [
    { label: 'debug', prefix: '[DEBUG]', logToFile: 'debug' },
    { label: 'info', prefix: '[INFO]', logToFile: true },
    { label: 'success', prefix: '[INFO]', consoleMethod: 'debug', logToFile: true },
    { label: 'error', prefix: '[ERROR]', logToFile: 'error' },
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
    { label: 'error', prefix: '[ERROR]', logToFile: 'error' },
  ],
  options: {
    /// Your options here
  },
});
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
