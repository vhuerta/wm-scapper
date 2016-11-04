'use strict';

/**
 * This file is the entry point to start the workers, for a default service
 *
 * @author Victor Huerta <vhuertahnz@gmail.com>
 */

import throng from 'throng';
import Worker from './worker';

const CONCURRENCY = 1;

/**
 * Master function
 */
const master = () => {
  console.log('Master function, concurrency:', CONCURRENCY);
};

const log = console.log;

/**
 * Start every worker
 * @param  {Number} id Worker id
 */
const start = (id) => {

  const instance = Worker({
    mongoUri: process.env.MONGODB_URI,
    email : process.env.GMAIL_EMAIL,
    password: process.env.GMAIL_PASSWORD,
    receivers: process.env.RECEIVERS,
    log: log
  });

  instance.on('ready', () => {
    log(`Worker ${id} ready!`);
    setTimeout(() => {
      instance.work();
      setInterval(instance.work, 1000 * 60 * 5); // work every 5 minutes
    }, (id - 1) * 1000 * 60 * 2); // start on 0, 2, 4 mins
  });

  instance.on('error', err => {
    log(`Worker ${id} error!`);
    log(err);
    process.exit();
  });
};

// Run Workers
throng({
  workers: CONCURRENCY,
  grace: 1,
  master: master,
  start: start
});
