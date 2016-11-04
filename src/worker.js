'use strict';

/**
 * Worker class than can work ;)
 *
 * @author Victor Huerta <vhuertahnz@gmail.com>
 */

import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

import fetch from 'node-fetch';
import R from 'ramda';
import Bluebird from 'bluebird';
import Handlebars from 'handlebars';
import Nodemailer from 'nodemailer';
import { MongoClient, Collection, Cursor } from 'mongodb';

/**
 * PROMISIFY EVERY DAMN THING!
 */
global.Promise = Bluebird;
Bluebird.promisifyAll(fs);
Bluebird.promisifyAll(MongoClient);
Bluebird.promisifyAll(Collection.prototype);
Bluebird.promisifyAll(Cursor.prototype);

/**
 * HANDLEBARS HELPERS
 */
Handlebars.registerHelper('color', discount => discount ? 'GREEN' : 'RED');

const URL = 'https://www.walmart.com.mx';
const MENU_REGEX = /(var\smenu\s.?\s)(\[?.+\;?)/g;

class Worker extends EventEmitter {

  constructor({ mongoUri, email, password, receivers, log = () => {} }) {
    super();
    let _this = this;
    _this.email = email;
    _this.password = password;
    _this.receivers = receivers;
    _this.mongoUri = mongoUri;
    _this.log = log;
    _this.buildUtility();
    MongoClient
      .connect(_this.mongoUri)
      .then(db => _this.db = db)
      .then(() => _this.emit('ready'))
      .catch(err => _this.emit('error', err));
  }

  buildUtility() {
    let _this = this;
    // Create templating util methods
    _this.generateHTML = R.curry((results, template) => template(results));

    // Create mailing util methods
    _this.mailer = Nodemailer.createTransport(`smtps://${_this.email}:${_this.password}@smtp.gmail.com`);
    Bluebird.promisifyAll(_this.mailer);
    _this.mailOptions = {
      from: `SCRAPER 👥 <${_this.email}>`, // sender address
      to: _this.receivers, // list of receivers
      subject: 'wmart 🤑🤑🤑🤑🤑🤑🤑', // Subject line
    };
    _this.sendMail = R.curry((mailer, options, html) => mailer.sendMailAsync(Object.assign({ html }, options)));
    _this.sendMail = _this.sendMail(_this.mailer);
    _this.sendMail = _this.sendMail(_this.mailOptions);
    _this.log('mailOptions...');
    _this.log(_this.mailOptions);
  }

  work() {
    let _this = this;
    _this.clean()
      .then(_this.fetchMenu.bind(_this))
      .then(_this.fetchArticles.bind(_this))
      .then(_this.saveArticles.bind(_this))
      .then(_this.findArticlesChanged.bind(_this))
      .then(_this.emailIt.bind(_this))
      .catch(err => _this.emit('error', err));
  }

  clean() {
    let _this = this;
    _this.log('clean...');
    return _this.db.collection('articles')
      .updateMany({}, {
        $set: {
          new: false,
          discount: false,
          increse: false
        }
      });
  }

  fetchMenu() {
    let _this = this;
    _this.log('fetchMenu...');
    const reduceMenus = (ls, elem) => {
      if(Array.isArray(elem)) {
        elem.reduce(reduceMenus, ls);
      } else if(elem && typeof elem === 'object') {
        if("Elements" in elem)
          reduceMenus(ls, elem.Elements);
        if("departmentName" in elem && elem.departmentName.startsWith("l-")) {
          ls.push(elem.departmentName);
        }
      }
      return ls;
    };

    return fetch(`${URL}/app/WebPart/taxonomy/general.js`, { timeout: 5000 })
      .then(res => res.text())
      .then(res => MENU_REGEX.exec(res)[2].slice(0, -1))
      .then(JSON.parse)
      .then(menu => menu.reduce(reduceMenus, []));
  }

  fetchArticles(lines) {
    let _this = this;
    _this.log('fetchArticles...');
    return Promise.all(lines.map(_this.fetchLine.bind(_this)))
      .then(res => res.reduce((r, a) => r.concat(a), []));
  }

  fetchLine(line) {
    let _this = this;
    return new Promise((resolve, reject) => {
      fetch(`${URL}/WebControls/hlGetProductsByLine.ashx?linea=${line}`, { timeout: 4000 })
        .then(res => res.json())
        .then(res => resolve(res))
        .catch(err => {
          _this.log(`Fail fetching: ${line}`);
          resolve([]);
        });
    });
  }

  saveArticles(articles) {
    let _this = this;
    _this.log('saveArticles...');
    return Promise.all(articles.map(_this.saveArticle.bind(_this)));
  }

  saveArticle(article) {
    let _this = this;
    return _this.db.collection('articles')
      .findOne({ upc: article.upc })
      .then(found => {
        if(!found) {
          let newArticle = {
            price: article.PrecioNumerico,
            description: article.Description,
            discount: false,
            percentage: 0,
            new: true,
            url: `https://www.walmart.com.mx/${article.ProductUrl}`,
            bundle: article.IsBundle,
            upc: article.upc,
            family: article.FamilyName,
            brand: article.Brand
          };
          return _this.db.collection('articles')
            .insertOne(newArticle);
        } else {
          if(found.price > article.PrecioNumerico || found.price < article.PrecioNumerico) {
            let percentage = Math.round(((1 - (article.PrecioNumerico / found.price)) * 100) * 100) / 100;
            let discount = found.price > article.PrecioNumerico;
            let increse = found.price < article.PrecioNumerico;
            return _this.db.collection('articles')
              .updateOne({ _id: found._id }, {
                $set: {
                  price: article.PrecioNumerico,
                  beforePrice: found.price,
                  url: `https://www.walmart.com.mx/${article.ProductUrl}`,
                  percentage,
                  discount,
                  increse
                }
              });
          } else {
            return article;
          }
        }
      });
  }

  findArticlesChanged() {
    let _this = this;
    _this.log('findArticlesChanged...');
    return new Promise((resolve, reject) => {
      _this.db.collection('articles')
        .find({ $or: [{ new: true }, { discount: true }, { increse: true }] })
        .toArray((err, rs) => {
          resolve(rs);
        });
    });
  }

  emailIt(results) {
    let _this = this;
    _this.log('sendMail...');
    return _this.buildMail(results)
      .then(_this.sendMail);
  }

  buildMail(results) {
    let _this = this;
    _this.log('buildMail...');
    return fs.readFileAsync(path.join(__dirname, '../template/mail.html'), 'utf-8')
      .then(Handlebars.compile)
      .then(_this.generateHTML({ results }));
  }

}

export default(options) => new Worker(options);
