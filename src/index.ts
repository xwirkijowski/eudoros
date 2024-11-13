import * as fs from 'node:fs';

declare namespace $E {
    interface Config {
        levels: Array<Level>,
        options?: Options
    }

    interface Options {
        outputDirectory?: string|null,
        //createOutputDirectory?: boolean;
    }

    // The logging level object
    interface Level {
        label: string,
        prefix?: string,
        format?: [string, string]|[string, string, string, string]
        logToFile?: boolean|string,
        method?: Method,
        formatToString?: formatToString
    }

    // Logging methods accepted by `console`
    type Method = 'log'|'info'|'error'|'warn'|'debug';

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
    interface formatToString {
        (payload: Payload): string
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
        outputDirectory: './logs',
        //createOutputDirectory: true,
    };

    isValidMethod = (method: string): method is $E.Method => {
        return ['log', 'info', 'error', 'warn', 'debug'].includes(method);
    }

    /**
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
     */
    #initLevels (): void {
        this.#levels.forEach((level) => {
            (this as any)[level.label.toLowerCase()] = async (...args: $E.Payload[]) => {
                // Fire and forget - don't block
                this.#handleLog(level, undefined, ...args).catch(err => {
                    console.error(`Error during error handling ${level.label}: ${err}`)
                });
            }
        })
    }

    /**
     * Apply user defined log level formatting and prepare the payload itself.
     * All `args` are turned into a single string, objects undergo `JSON.stringify`.
     *
     * @param 	level	The logging level
     * @param	domain	Optional domain (extra tag after timestamp)
     * @param 	args	Log payload
     */
    #formatPayload = (level: $E.Level, domain?: string|null, ...args: $E.Payload[]): string => {
        const prefix = level.prefix || '';
        const format = level.format || ['', ''];
        const timestamp = `${format[0]}${new Date().toISOString()}${format[1]}`;

        let payload: $E.Payload[]|$E.Payload = args;

        if (level?.formatToString && Array.isArray(payload) && typeof payload[0] === 'object') {
            payload = level.formatToString(payload[0]);
        } else {
            if (Array.isArray(payload)) {
                payload
                    .map((arg: any) => {
                        if (typeof arg === 'object') {
                            return JSON.stringify(arg, null, 2);
                        }
                        return String(arg);
                    })
                    .join(' ')
            } else if (typeof payload === 'object') {
                payload = JSON.stringify(payload, null, 2);
            }
        }

        if (domain) {
            domain = `${format[0]}[${domain}]${format[1]}`;
        }

        return `${prefix} ${timestamp}${domain?` ${domain} `:' '}${format[2]||''}${payload}${format[3]||''}`;
    }

    /**
     * Format log message and call appropriate dynamic method.
     * If level has file logging enabled, call the file logging method.
     * File logging method uses its own format.
     *
     * @param	level	The logging level
     * @param	domain	Optional domain (extra tag after timestamp)
     * @param 	args	Log payload
     */
    #handleLog = async (level: $E.Level, domain?: string|null, ...args: $E.Payload[]): Promise<void> => {
        const message = this.#formatPayload(level, domain, ...args);

        const method: string = level.method ?? (this.isValidMethod(level.label)) ? level.label : this.#default_method;

        // Run as soon as possible, do not block current operations
        process.nextTick(() => console[method as $E.Method](message));

        if (level.logToFile && this.#options?.outputDirectory) this.#logToFile(level, null, ...args);
    }

    /**
     * Prepare the log payload for file logging.
     * File logs are saved as a JSON string to make them compatible with Grafana.
     *
     * @param 	level	The logging level
     * @param   domain  Optional domain
     * @param 	args	Log payload
     */
    #logToFile = (level: $E.Level, domain?: string|null, ...args: $E.Payload[]): void => {
        if (!this.#options?.outputDirectory) {
            console.error('Cannot log to file! Configuration error, failed to load defaults.')
        } else {
            const date = new Date();
            // Build date substring for file name, add padded zeros to month and date
            const dateString = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            // Prepare message

            let lineHead: $E.FilePayloadHead = {
                timestamp: date.toISOString(),
                level: level.label
            }

            if (domain) lineHead.domain = domain;

            const line: $E.FilePayload = JSON.stringify({
                lineHead,
                ...args
            });

            const fileName = (typeof level.logToFile === "string")
                ? `${level.label}-log-${dateString}`
                : `log-${dateString}`;

            fs.appendFile(`${this.#options.outputDirectory}/${fileName}.txt`, line, { flag: 'a+' }, err => {
                if (err) console.error(`Cannot write log to file. ${err}`);
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
            console.error(`Error during error handling ${level} with domain: ${err}`)
        }); else console.log(`Invalid log level \`${level}\` provided!`)
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