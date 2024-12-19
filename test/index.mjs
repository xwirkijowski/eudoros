import {init} from "../dist/index.cjs";
import config from './configuration.mjs';

// Set up configuration
const log = init(config);

// Begin test
log.critical('1 Critical error test!', 24, 24.53323, new Date(), [1, 2, 3, 4, 'Lorem ipsum'], {key1: false, key2: 21.37}, false);
log.critical('2 Critical with trace test!', new Date(), 23, new Error('test'));

log.error('3 Standard error test!');
log.warn('4 Warning test!');
log.success('5 Success test!');
log.audit('6 Audit test!');
log.std('7 Standard log test!');
log.info('8 Info test!');
log.debug('9 Debug test!');
log.error('10 This is an error message', new Error('Something went wrong'));

log.withDomain('error', 'AuthService', '11 Validating token', [1,2,3,4], new Date());
