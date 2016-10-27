'use strict';

/**
 * This file is the entry point to start the workers, for a default service
 *
 * @author Victor Huerta <vhuertahnz@gmail.com>
 */

import throng from 'throng';

const work = () => {
  console.log('Working...');
};

/**
 * Master function
 */
const master = () => {
  console.log('Master function, concurrency:', 2);
};

/**
 * Start every worker
 * @param  {Number} id Worker id
 */
const start = (id) => {
  work();
  setInterval(work, 1000 * 60 * 5);
};

// Run Workers
throng({
  workers: 2,
  grace: 1,
  master: master,
  start: start
});
