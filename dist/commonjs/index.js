'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _aureliaHistoryShorturl = require('./aurelia-history-shorturl');

Object.keys(_aureliaHistoryShorturl).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _aureliaHistoryShorturl[key];
    }
  });
});