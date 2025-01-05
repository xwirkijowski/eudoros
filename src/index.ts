/**
 * Eudoros - Flexible Logging Utility
 *
 * @author  Sebastian Wirkijowski <sebastian@wirkijowski.me>
 */

import * as fs from 'node:fs';

export interface Config {
    levels: Array<Level>,
    options?: Options
}

export interface Options {
    // Whether to switch to synchronous mode, default false
    synchronous?: boolean,
    // Specify log file output directory, if null logging to files disabled
    outputDirectory?: string|false,
    // Specify the file extension to use for the log files
    outputFileExtension?: string,
    // Whether to apply formatting to payload args (i.e. color Date instanced, numbers, objects)
    formatArgs?: boolean,
    // The name of the method to use on the `Date` object or a function that returns the formatted date as a string
    formatDate?: ValidDateToStringMethod|FormatDateFunction
    // Enable or disable timestamps in console logs
    consoleTimestamps?: boolean
}

// The logging level object
export interface Level {
    // The name of the logging level
    label: string,
    // Prefix that appears at the start of the log message in console
    prefix?: string,
    // Formatting of the timestamp and domain elements (ANSI bindings or extra characters)
    format?: [string, string]|[string, string, string, string]
    // True to output to file, string to specify a suffix to `log-<>` in the filename for this log level
    logToFile?: boolean|string,
    /**
     * Enabling this option will split payload into message and trace, and group them together.
     * All arguments will be in the first message, the last argument will always be removed from payload.
     * If the last argument is null or undefined, no `console.trace` call will be sent.
     */
    trace?: Trace,
    // Which console method to use for this level (e.g. console.<log>, console.<error>)
    consoleMethodName?: ConsoleMethod,
    // Override configuration level console timestamp settings
    consoleTimestamps?: boolean
    // The name of the method that will be created, defaults to label
    methodName?: string,
    // A function that processes objects into a string with your own formatting, used only when logging to file.
    formatToString?: FormatToStringFunction
}

// Trace options
export interface Trace {
    // The label passed into `console.group()`
    groupLabel?: string
    groupPrefix?: string,
    format?: [string, string]
}

// Logging methods accepted by `console`
export type ConsoleMethod = 'log'|'info'|'error'|'warn'|'debug';

// Valid formatting methods for Date
export type ValidDateToStringMethod = {
    [Key in keyof Date]: Date[Key] extends (this: Date) => string ? Key : never
}[keyof Date]

// Head of the log with information set at the time of insertion (not from payload)
export type FilePayloadHead = {
    timestamp: string,
    level: string,
    domain?: string,
}

// Stringified log to be inserted to log file
export type FilePayload = string;

// The logging payload - what is passed to the console method
export type Payload = string|number|boolean|object|Array<string|number|boolean|object>;

// Function that translates objects passed as payload to a human-readable string
export interface FormatToStringFunction {
    (payload: Payload): string
}

// Function that formats the `Date` object
export interface FormatDateFunction {
    (date: Date): string
}

export class Eudoros {
    readonly #levels: Array<Level> = []; // Logging levels, extracted from options
    readonly #options?: Options = {};

    readonly #default_method = 'log';
    readonly #default_levels = [
        {
            label: 'log',
            prefix: '[-]'
        }
    ];
    readonly #default_options = {
        synchronous: false,
        outputDirectory: './logs',
        outputFileExtension: 'log',
        formatArgs: true,
        formatDate: ('toISOString' as ValidDateToStringMethod),
        consoleTimestamps: true
    };

    /**
     * Index signature
     *
     * Allows dynamic method assignment with string keys
     */
    [key: string]: Function;

    /**
     * Internal error reporting.
     * If an exception is caught inside the logger, this function will handle it and display all details.
     *
     * @param   {string}                 msg     - Descriptive error message
     * @param   {Error|Payload|unknown}  err     - The error object or the data that caused it
     * @private
     */
    readonly #internalErrorLog = (msg: string, err?: Error|Payload|unknown): void => {
        console.group(`\x1b[31m[\u{26A0}]\x1b[0m`, `\x1b[31m${this.#formatDate(new Date())}\x1b[0m`, 'Eudoros caught an exception.');
        console.error(`\x1b[31m[>]\x1b[0m`, (msg && msg.length > 0 || msg === null || msg === undefined) ? msg : (err instanceof Error) ? err?.message : err);
        err && console.trace(err);
        console.groupEnd();
    }

    /**
     * Format the `Date` object.
     *
     * @param   {Date}  date    - The `Date` object to format.
     * @return  String
     */
    readonly #formatDate = (date: Date): string => {
        const format = this.#options?.formatDate || this.#default_options.formatDate;

        try {
            if (typeof format === 'function') {
                return format(date) as string;
            }

            return (date[format as keyof Date] as Function)() as string;
        } catch(err) {
            this.#internalErrorLog(`Cannot format date! Falling back to default format`, date)
            return ((date[this.#default_options.formatDate as keyof Date] as Function)() as string);
        }
    }

    /**
     * Check if the provided `console` method is valid and supported.
     *
     * @param   {string}    consoleMethod   - The `console` method
     */
    isValidMethod = (consoleMethod: string): consoleMethod is ConsoleMethod => {
        return ['log', 'info', 'error', 'warn', 'debug'].includes(consoleMethod);
    }

    /**
     * Create a logger instance and initialize levels.
     *
     * @param 	config	Configuration object
     */
    constructor (config: Config) {
        if (config) {
            this.#levels = config?.levels || this.#default_levels; // Assign levels

            // If options defined, join defaults and defined options by spread, last overwrites, else use defaults.
            this.#options = (config.options)
                ? {...this.#default_options, ...config.options}
                : this.#default_options;

            this.#initLevels(); // Generate methods

            return this;
        }
    }

    /**
     * Dynamically set up methods for each logging level defined in options.
     *
     * @private
     */
    #initLevels (): void {
        this.#levels.forEach((level) => {
            const methodName: string = level?.methodName
                ? level.methodName.toLowerCase()
                : level.label.toLowerCase();

            (this as Record<string, Function>)[methodName] = (this.#options?.synchronous === false)
                ? async (...args: Payload[]): Promise<void> => {
                    try {
                        this.#handleLog(level, undefined, ...args);
                    } catch (err) {
                        this.#internalErrorLog(`Error during log handling \`${level.label}\`!`, err);
                    }
                }
                : (...args: Payload[]): void => {
                    try {
                        this.#handleLog(level, undefined, ...args);
                    } catch (err) {
                        this.#internalErrorLog(`Error during log handling \`${level.label}\`!`, err);
                    }
                };
        })
    }

    /**
     * Apply user defined log level formatting and prepare the group label.
     * Everything is turned into a single string.
     * There are no user supplied arguments (payload) here, except for the `domain`.
     *
     * @param   {Level}         level       - The logging level
     * @param   {string|null}   [domain=''] - Optional domain (extra tag after timestamp)
     * @private
     */
    #formatGroup = (level: Level, domain?: string|null): string => {
        if (!level.trace) {
            this.#internalErrorLog(`Cannot format trace on \`${level.label}\`, no trace config defined!`)
            return "<Format group error!>";
        } else {
            const prefix: string = level.trace.groupPrefix + " " || '';
            const label: string = level.trace.groupLabel || '';
            const format: string[] = (level.trace.format && Array.isArray(level.format) && level.trace.format.length > 0)
                ?  level.trace.format
                : ['', ''];

            const withTimestamp: boolean = (level?.consoleTimestamps !== undefined)
                ? level.consoleTimestamps
                : this.#options?.consoleTimestamps as boolean;
            const timestamp: string = withTimestamp ?
                `${format[0]}${this.#formatDate(new Date())}${format[1]}` + " "
                : '';

            domain = (domain)
                ? `${format[0]}[${domain}]${format[1]}` + " "
                : '';

            return prefix+timestamp+domain+label;
        }
    }

    /**
     * Apply user defined log level formatting and prepare the payload itself.
     * All `args` are turned into a single string, objects undergo `JSON.stringify`.
     *
     * @param   {Level}         level       - The logging level
     * @param   {string|null}   [domain]    - Optional domain (extra tag after timestamp)
     * @param   {Payload[]}     args        - Log payload
     * @private
     */
    #formatPayload = (level: Level, domain?: string|null, ...args: Payload[]): string => {
        const prefix: string = level.prefix ? level.prefix+" " : '';
        const format = (level.format && Array.isArray(level.format) && level.format.length > 0)
            ?  level.format
            : ['', ''];

        const withTimestamp: boolean = (level?.consoleTimestamps !== undefined)
            ? level.consoleTimestamps
            : this.#options?.consoleTimestamps as boolean;
        const timestamp = withTimestamp
            ? `${format[0]}${this.#formatDate(new Date())}${format[1]}` + " "
            : '';

        const formatArgs: boolean = this.#options?.formatArgs ?? false;

        let payload: Payload[]|Payload = args;

        if (level?.formatToString) {
            try {
                payload = level.formatToString(payload);
            } catch (err) {
                this.#internalErrorLog(`Error in provided \`formatToString()\` function on \`${level.label}\`!`, err);
            }
        } else if (Array.isArray(payload)) {
            if (level?.trace && payload.length > 1) { // If with trace and has more than 1 arg, pop trace arg
                payload.pop();
            }

            payload = payload
                .filter((arg: Payload) => arg !== undefined) // Filter out undefined
                .map((arg: Payload) => {
                    if (typeof arg === "number") { // Format numbers
                        return formatArgs
                            ? `\x1b[33m${Number(arg)}\x1b[0m`
                            : Number(arg);
                    } else if (typeof arg === "object" && Array.isArray(arg)) { // Format arrays
                        return formatArgs
                            ? `\x1b[32m${arg.join(", ")}\x1b[0m`
                            : arg.join(", ");
                    } else if (arg instanceof Date) { // Format Date instances
                        return formatArgs
                            ? `\x1b[35m${this.#formatDate(arg)}\x1b[0m`
                            : this.#formatDate(arg);
                    } else if (arg instanceof Error) { // Do not format Errors
                        return arg;
                    } else if (typeof arg === 'object') { // Format standard objects
                        return formatArgs
                            ? `\x1b[36m${JSON.stringify(arg)}\x1b[0m`
                            : String(`${JSON.stringify(arg)}`);
                    } else return arg;
                })
                .join(" / ")
        } else if (typeof payload === 'object') {
            payload = JSON.stringify(payload, null, 2);
        }

        if (domain) {
            domain = `${format[0]}[${domain}]${format[1]}` + " ";
        }

        return (level.trace)
            ? `${prefix}${payload}`
            : `${prefix}${timestamp}${domain??''}${format[2]||''}${payload}${format[3]||''}`;
    }

    /**
     * Format log message and call appropriate dynamic method.
     * If level has file logging enabled, call the file logging method.
     * File logging method uses its own format.
     *
     * @param   {Level}         level       - The logging level
     * @param   {string|null}   [domain]    - Optional domain (extra tag after timestamp)
     * @param   {Payload[]}     args        - Log payload
     * @private
     */
    #handleLog: Function = async (level: Level, domain?: string|null, ...args: Payload[]): Promise<void> => {
        const message: string = this.#formatPayload(level, domain, ...args);

        let consoleMethod: string;

        if (level?.consoleMethodName && this.isValidMethod(level.consoleMethodName)) {
            consoleMethod = level.consoleMethodName;
        } else if (this.isValidMethod(level.label)) {
            consoleMethod = level.label;
        } else {
            consoleMethod = this.#default_method;
        }

        // Prepare payload
        const send: Function = (): void => {
            const trace: Payload = args[args.length - 1];
            if (level.trace) {
                console.group(this.#formatGroup(level, domain));
                console[consoleMethod as ConsoleMethod](message);
                trace && console.trace(trace);
                console.groupEnd();
            } else {
                console[consoleMethod as ConsoleMethod](message);
            }
        }

        if (this.#options?.synchronous === false) { // Async mode
            // Run as soon as possible, do not block current operations
            process.nextTick(() => {
                send();
            });
        } else { // Sync mode
            send()
        }

        if (level.logToFile && this.#options?.outputDirectory) this.#logToFile(level, domain, ...args);
    }

    /**
     * Prepare the log payload for file logging.
     * File logs are saved as a JSON string to make them easier to plug into Grafana.
     *
     * @param   {Level}         level       - The logging level
     * @param   {string|null}   [domain]    - Optional domain (extra tag after timestamp)
     * @param   {Payload[]}     args        - Log payload
     * @private
     */
    #logToFile: Function = (level: Level, domain?: string|null, ...args: Payload[]): void => {
        if (!this.#options?.outputDirectory) {
            this.#internalErrorLog('Cannot log to file! Configuration error, failed to load defaults.')
        } else {
            const date: Date = new Date();
            // Build date substring for file name, add padded zeros to month and date
            const dateString: string = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            let lineHead: FilePayloadHead = {
                timestamp: this.#formatDate(date),
                level: level.label
            }

            if (domain) lineHead.domain = domain;

            const line: FilePayload = JSON.stringify({
                ...lineHead,
                args
            });

            const fileName: string = (typeof level.logToFile === "string")
                ? `${level.label}-log-${dateString}`
                : `log-${dateString}`;

            fs.appendFile(`${this.#options.outputDirectory}/${fileName}.${this.#options.outputFileExtension}`, line+'\r\n', { flag: 'a+' }, err => {
                if (err) this.#internalErrorLog(`Cannot write log to file!`, err);
            })
        }

    }

    /**
     * Alternative to dynamically generated methods, includes an extra tag (domain) in the log.
     *
     * @param	{string}     level	- The logging level
     * @param	{string}     domain	- Domain (extra tag after timestamp)
     * @param 	{Payload[]}  args	- Log payload
     */
    withDomain: Function = (level: string, domain: string, ...args: Payload[]): void => {
        const levelObject: Level|undefined = this.#levels.find(obj => obj?.label === level);

        if (levelObject)
            try {
                this.#handleLog(levelObject, domain, ...args);
            } catch (err) {
                this.#internalErrorLog(`Error during error handling \`${level}\` with domain!`, err);
            }
        else this.#internalErrorLog(`Invalid log level \`${level}\` provided!`)
    }
}

/**
 *  Alternative to `new Eudoros(config)`.
 *
 *  @constructor
 */
export class EudorosBuilder {
    levels: Level[] = []
    opts: Options = {}

    constructor(opts: Options) {
        this.opts = opts;

        return this;
    }

    addLevel (level: Level): this {
        this.levels.push(level);

        return this;
    }

    init (): Eudoros {
        const config: Config = {levels: [...this.levels], options: this.opts}

        return new Eudoros(config);
    }
}

/**
 * Alternative to `new Eudoros(config)`.
 *
 * @param   config  - Configuration object with log levels and options.
 * @constructor
 */
export const init: Function = (config: Config): Eudoros => {
    return new Eudoros(config)
}