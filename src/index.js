'use strict';

/**
 * This file is the entry point to start the workers, for a default service
 *
 * @author Victor Huerta <vhuertahnz@gmail.com>
 */

import throng from 'throng';

/**
 * Master function
 */
const master = () => {
  console.log('Master function, concurrency:', config.concurrency.worker);
};

/**
 * Start every worker
 * @param  {Number} id Worker id
 */
const start = (id) => {
  setTimeout(() => console.log('working'), 15 * 1000 * 60);
};

// Run Workers
throng({
  workers: 3,
  grace: 1,
  master: master,
  start: start
});
