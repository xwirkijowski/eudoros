# Eudoros Documentation

## Configuration

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