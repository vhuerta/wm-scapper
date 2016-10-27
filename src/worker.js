'use strict';

import EventEmitter from 'events';

class Worker extends EventEmitter {

  constructor({ email, password }) {
    super();
  }
  
}

export default(options) => new Worker();
