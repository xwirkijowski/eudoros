export default {
	options: {
		outputDirectory: './logs'
	},
	levels: [
		{ // Critical errors that cause performance degradation or shutdown
			label: 'critical',
			prefix: `\x1b[1m\x1b[31m[\u{2717}]\x1b[0m`, // Bold, red
			format: ['\x1b[1m\x1b[31m', '\x1b[0m'], // Bold, red
			logToFile: true,
			consoleMethodName: 'error'
		},
		{ // Non-critical errors
			label: 'error',
			prefix: `\x1b[31m[\u{2717}]\x1b[0m`, // Red
			format: ['\x1b[31m', '\x1b[0m'], // Red
			logToFile: true,
			consoleMethodName: 'error'
		},
		{ // Warnings, expected exceptions
			label: 'warn',
			prefix: `\x1b[33m[\u{26A0}]\x1b[0m`, // Yellow
			format: ['\x1b[33m', '\x1b[0m'], // Yellow
			logToFile: true,
			consoleMethodName: 'warn'
		},
		{
			label: 'success',
			prefix: `\x1b[32m[\u{2713}]\x1b[0m`, // Green
			format: ['\x1b[32m', '\x1b[0m'], // Green
			logToFile: true
		},
		{ // Request logging
			label: 'request',
			prefix: '[>]',
			format: [],
			logToFile: 'request',
			formatToString: (payload) => {
				return `Request ${payload.requestId} finished in ${payload.time}ms, received at ${payload.timestampStart.toISOString()}, user ${payload?.userId||'UNAUTHENTICATED'}`
			}
		},
		{ // Authentication and authorization logging
			label: 'audit',
			prefix: '',
			format: [],
			logToFile: 'audit',
		},
		{ // Standard logging
			label: 'log',
			prefix: '',
			format: [],
			logToFile: true,
			methodName: 'std'
		},
		{ // Information
			label: 'info',
			prefix: '\x1b[34m[\u{0069}]\x1b[0m',
			format: ['\x1b[34m', '\x1b[0m'],
			logToFile: true,
			consoleMethodName: 'info'
		},
		{ // Debugging
			label: 'debug',
			prefix: '',
			format: [],
			logToFile: 'debug',
			consoleMethodName: 'debug'
		}
	]
}
