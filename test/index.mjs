import {init} from "../dist/index.cjs";
import config from './configuration.mjs';

// Set up configuration
const log = init(config);

// Begin test
log.critical('Critical error test!', 24, 24.53323, new Date(), [1, 2, 3, 4, 'Lorem ipsum'], {key1: false, key2: 21.37}, false);
log.critical('Critical with trace test!', new Error('test'));

log.error('Standard error test!');
log.warn('Warning test!');
log.success('Success test!');
log.request('Request test!');
log.audit('Audit test!');
log.std('Standard log test!');
log.info('Info test!');
log.debug('Debug test!');
log.error('This is an error message', new Error('Something went wrong'));
log.debug('Debug test!');