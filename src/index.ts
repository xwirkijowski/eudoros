import * as fs from 'node:fs';

declare namespace $E {
    interface Config {
        levels: Array<Level>,
        options?: Options
    }

    interface Options {
        // Whether to switch to synchronous mode, default false
        synchronous?: boolean,
        // Specify log file output directory, if null logging to files disabled
        outputDirectory?: string|false,
        // Specify the file extension to use for the log files
        outputFileExtension?: string,
        // Whether to apply formatting to payload args (i.e. color Date instanced, numbers, objects)
        formatArgs?: boolean,
        // The name of the method to use on the `Date` object or a function that returns the formatted date as a string
        formatDate?: string|FormatDate
        // Enable or disable timestamps in console logs
        consoleTimestamps?: boolean
    }

    // The logging level object
    interface Level {
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
        // The name of the method that will be created, defaults to label
        methodName?: string,
        // A function that processes objects into a string with your own formatting, used only when logging to file.
        formatToString?: FormatToString
    }

    // Trace options
    interface Trace {
        // The label passed into `console.group()`
        groupLabel?: string
        groupPrefix?: string,
        format?: [string, string]
    }

    // Logging methods accepted by `console`
    type ConsoleMethod = 'log'|'info'|'error'|'warn'|'debug';

    // Head of the log with information set at the time of insertion (not from payload)
    type FilePayloadHead = {
        timestamp: string,
        level: string,
        domain?: string,
    }

    // Stringified log to be inserted to log file
    type FilePayload = string;

    // The logging payload - what is passed to the console method
    type Payload = string|number|boolean|object|Array<any>;

    // Function that translates objects passed as payload to a human-readable string
    interface FormatToString {
        (payload: Payload): string
    }

    // Function that formats the `Date` object
    interface FormatDate {
        (date: Date): string
    }
}

export class Eudoros {
    readonly #levels: Array<$E.Level> = []; // Logging levels, extracted from options
    readonly #options?: $E.Options = {};

    readonly #default_method = 'log';
    readonly #default_levels = [
        {
            label: 'log',
            prefix: '[>]'
        }
    ];
    readonly #default_options = {
        synchronous: false,
        outputDirectory: './logs',
        outputFileExtension: 'log',
        formatArgs: true,
        formatDate: 'toISOString',
        consoleTimestamps: true
    };

    /**
     * Internal error reporting.
     *
     * If an exception is caught inside the logger, this function will handle it and display all details.
     *
     * @param       msg     Descriptive error message
     * @param       err     The error object
     * @private
     */
    readonly #internalErrorLog = (msg: string, err?: any) => {
        console.group(`\x1b[31m[\u{26A0}]\x1b[0m`, `\x1b[31m${this.#formatDate(new Date())}\x1b[0m`, 'Eudoros caught an exception.');
        console.error(`\x1b[31m[>]\x1b[0m`, msg);
        err && console.trace(err);
        console.groupEnd();
    }

    /**
     * Format the `Date` object.
     *
     * @param   date    The `Date` object to format.
     * @return  String
     */
    readonly #formatDate = (date: Date) => {
        if (this.#options?.formatDate) {
            try {
                if (typeof this.#options.formatDate === 'function') {
                    return this.#options.formatDate(date);
                } else {
                    return (date as any)[this.#options.formatDate]();
                }
            } catch (err) {
                this.#internalErrorLog(`Error during date formatting!`, err)
            }
        } else {
            this.#internalErrorLog(`Cannot format date, no config defined!`, date)
            return date;
        }
    }

    /**
     * Check if the provided `console` method is valid and supported.
     * @param   consoleMethod   The `console` method
     */
    isValidMethod = (consoleMethod: string): consoleMethod is $E.ConsoleMethod => {
        return ['log', 'info', 'error', 'warn', 'debug'].includes(consoleMethod);
    }

    /**
     * Create a logger instance and initialize levels.
     *
     * @param 	config	Configuration object
     */
    constructor (config: $E.Config) {
        if (config) {
            this.#levels = config.levels || this.#default_levels; // Assign levels

            // If options defined, join defaults and defined options by spread, last overwrites
            if (config.options) this.#options = {...this.#default_options, ...config.options};

            this.#initLevels(); // Set up dynamic methods

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

            if (this.#options?.synchronous === false) { // Async mode
                (this as any)[methodName] = async (...args: $E.Payload[]) => {
                    // Fire and forget - don't block
                    this.#handleLog(level, undefined, ...args).catch(err => {
                        this.#internalErrorLog(`Error during log handling \`${level.label}\`!`, err)
                    });
                }
            } else { // Sync mode
                (this as any)[methodName] = (...args: $E.Payload[]) => {
                    this.#handleLog(level, undefined, ...args).catch(err => {
                        this.#internalErrorLog(`Error during log handling \`${level.label}\`!`, err)
                    });
                }
            }
        })
    }

    /**
     * Apply user defined log level formatting and prepare the group label.
     * Everything is turned into a single string.
     * There are no user supplied arguments (payload) here, except for the `domain`.
     *
     * @param    level    The logging level
     * @param    domain    Optional domain (extra tag after timestamp)
     * @private
     */
    #formatGroup = (level: $E.Level, domain?: string|null): string => {
        if (!level.trace) {
            this.#internalErrorLog(`Cannot format trace on \`${level.label}\`, no trace config defined!`)
            return `<Format group error!>`;
        } else {
            const prefix: string = level.trace.groupPrefix || '';
            const label: string = level.trace.groupLabel || '';
            const format = (level.trace.format && Array.isArray(level.format) && level.trace.format.length > 0) ?  level.trace.format : ['', ''];

            // Format date
            const timestamp = this.#options?.consoleTimestamps === false ? '' : `${format[0]}${this.#formatDate(new Date())}${format[1]} `;

            if (domain) {
                domain = `${format[0]}[${domain}]${format[1]}`;
            }

            return `${prefix?prefix+' ':''}${timestamp}${domain?`${domain} `:''}${label}`;
        }
    }

    /**
     * Apply user defined log level formatting and prepare the payload itself.
     * All `args` are turned into a single string, objects undergo `JSON.stringify`.
     *
     * @param 	level	The logging level
     * @param	domain	Optional domain (extra tag after timestamp)
     * @param 	args	Log payload
     * @private
     */
    #formatPayload = (level: $E.Level, domain?: string|null, ...args: $E.Payload[]): string => {
        const prefix: string = level.prefix || '';
        const format = (level.format && Array.isArray(level.format) && level.format.length > 0) ?  level.format : ['', ''];

        const timestamp = this.#options?.consoleTimestamps === false ? '' : `${format[0]}${this.#formatDate(new Date())}${format[1]} `;

        const formatArgs: boolean = this.#options?.formatArgs??false;

        let payload: $E.Payload[]|$E.Payload = args;

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
                .filter((arg: any) => arg !== undefined) // Filter out undefined
                .map((arg: any) => {
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
            domain = `${format[0]}[${domain}]${format[1]}`;
        }

        return (level.trace) ? `${prefix?prefix+' ':''}${payload}` : `${prefix?prefix+' ':''}${timestamp}${domain?`${domain} `:''}${format[2]||''}${payload}${format[3]||''}`;
    }

    /**
     * Format log message and call appropriate dynamic method.
     * If level has file logging enabled, call the file logging method.
     * File logging method uses its own format.
     *
     * @param	level	The logging level
     * @param	domain	Optional domain (extra tag after timestamp)
     * @param 	args	Log payload
     * @private
     */
    #handleLog = async (level: $E.Level, domain?: string|null, ...args: $E.Payload[]): Promise<void> => {
        const message = this.#formatPayload(level, domain, ...args);

        let consoleMethod: string;

        if (level?.consoleMethodName && this.isValidMethod(level.consoleMethodName)) {
            consoleMethod = level.consoleMethodName;
        } else if (this.isValidMethod(level.label)) {
            consoleMethod = level.label;
        } else {
            consoleMethod = this.#default_method;
        }

        // Prepare payload
        const send = () => {
            const trace = args[args.length - 1];
            if (level.trace) {
                console.group(this.#formatGroup(level, domain));
                console[consoleMethod as $E.ConsoleMethod](message);
                trace && console.trace(trace);
                console.groupEnd();
            } else {
                console[consoleMethod as $E.ConsoleMethod](message);
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

        if (level.logToFile && this.#options?.outputDirectory) this.#logToFile(level, null, ...args);
    }

    /**
     * Prepare the log payload for file logging.
     * File logs are saved as a JSON string to make them easier to plug into Grafana.
     *
     * @param 	level	The logging level
     * @param   domain  Optional domain
     * @param 	args	Log payload
     * @private
     */
    #logToFile = (level: $E.Level, domain?: string|null, ...args: $E.Payload[]): void => {
        if (!this.#options?.outputDirectory) {
            this.#internalErrorLog('Cannot log to file! Configuration error, failed to load defaults.')
        } else {
            const date = new Date();
            // Build date substring for file name, add padded zeros to month and date
            const dateString = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            // Prepare message

            let lineHead: $E.FilePayloadHead = {
                timestamp: this.#formatDate(date),
                level: level.label
            }

            if (domain) lineHead.domain = domain;

            const line: $E.FilePayload = JSON.stringify({
                ...lineHead,
                args
            });

            const fileName = (typeof level.logToFile === "string")
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
     * @param	level	The logging level
     * @param	domain	Optional domain (extra tag after timestamp)
     * @param 	args	Log payload
     */
    withDomain = (level: string, domain: string, ...args: $E.Payload[]): void => {
        const levelObject = this.#levels.find(obj => obj?.label === level);

        if (levelObject) this.#handleLog(levelObject, domain, ...args).catch(err => {
            this.#internalErrorLog(`Error during error handling \`${level}\` with domain!`, err);
        }); else this.#internalErrorLog(`Invalid log level \`${level}\` provided!`)
    }
}

/**
 *  Alternative to `new Eudoros(config)`.
 */
export class EudorosBuilder {
    levels: $E.Level[] = []
    opts: $E.Options = {}

    constructor(opts: $E.Options) {
        this.opts = opts;

        return this;
    }

    addLevel (level: $E.Level) {
        this.levels.push(level);

        return this;
    }

    init () {
        const config: $E.Config = {levels: [...this.levels], options: this.opts}

        return new Eudoros(config);
    }
}

/**
 * Alternative to `new Eudoros(config)`.
 *
 * @param   config  Configuration object with log levels and options.
 */
export const init = (config: $E.Config) => {
    return new Eudoros(config)
}