var _class, _temp;

import { DOM, PLATFORM } from 'aurelia-pal';
import { History } from 'aurelia-history';

export let LinkHandler = class LinkHandler {
  activate(history) {}

  deactivate() {}
};

export let DefaultLinkHandler = class DefaultLinkHandler extends LinkHandler {
  constructor() {
    super();

    this.handler = e => {
      let { shouldHandleEvent, href } = DefaultLinkHandler.getEventInfo(e);

      if (shouldHandleEvent) {
        e.preventDefault();
        this.history.navigate(href);
      }
    };
  }

  activate(history) {
    if (history._hasPushState) {
      this.history = history;
      DOM.addEventListener('click', this.handler, true);
    }
  }

  deactivate() {
    DOM.removeEventListener('click', this.handler);
  }

  static getEventInfo(event) {
    let info = {
      shouldHandleEvent: false,
      href: null,
      anchor: null
    };

    let target = DefaultLinkHandler.findClosestAnchor(event.target);
    if (!target || !DefaultLinkHandler.targetIsThisWindow(target)) {
      return info;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return info;
    }

    let href = target.getAttribute('href');
    info.anchor = target;
    info.href = href;

    let leftButtonClicked = event.which === 1;
    let isRelative = href && !(href.charAt(0) === '#' || /^[a-z]+:/i.test(href));

    info.shouldHandleEvent = leftButtonClicked && isRelative;
    return info;
  }

  static findClosestAnchor(el) {
    while (el) {
      if (el.tagName === 'A') {
        return el;
      }

      el = el.parentNode;
    }
  }

  static targetIsThisWindow(target) {
    let targetWindow = target.getAttribute('target');
    let win = PLATFORM.global;

    return !targetWindow || targetWindow === win.name || targetWindow === '_self' || targetWindow === 'top' && win === win.top;
  }
};

export function configure(config) {
  config.singleton(History, ShortUrlHistory);
  config.transient(LinkHandler, DefaultLinkHandler);
}

function stateEqual(a, b) {
  return a.fragment === b.fragment && a.query === b.query;
}

export let ShortUrlHistory = (_temp = _class = class ShortUrlHistory extends History {
  constructor(linkHandler) {
    super();

    this._isActive = false;
    this._onPopStateCallback = () => {
      this._checkUrl(false);
    };
    this._onHashChangeCallback = () => {
      this._checkUrl(true);
    };

    this.location = PLATFORM.location;
    this.history = PLATFORM.history;
    this.linkHandler = linkHandler;
  }

  activate(options) {
    if (this._isActive) {
      throw new Error('History has already been activated.');
    }

    this._isActive = true;
    this.options = Object.assign({}, { root: '/' }, this.options, options);

    this.root = ('/' + this.options.root + '/').replace(rootStripper, '/');

    PLATFORM.addEventListener('popstate', this._onPopStateCallback);
    PLATFORM.addEventListener('hashchange', this._onHashChangeCallback);

    if (!this.historyState) {
      this.historyState = this._getHistoryState();
    }

    this.linkHandler.activate(this);

    if (!this.options.silent) {
      return this._loadUrl();
    }
  }

  deactivate() {
    PLATFORM.removeEventListener('popstate', this._onPopStateCallback);
    PLATFORM.removeEventListener('hashchange', this._onHashChangeCallback);
    this._isActive = false;
    this.linkHandler.deactivate();
  }

  getAbsoluteRoot() {
    let origin = createOrigin(this.location.protocol, this.location.hostname, this.location.port);
    return `${origin}${this.root}`;
  }

  navigate(fragment, { trigger = true, replace = false } = {}) {
    if (fragment && absoluteUrl.test(fragment)) {
      this.location.href = fragment;
      return true;
    }

    if (!this._isActive) {
      return false;
    }

    const historyState = this._parseFragment(fragment || '');
    if (stateEqual(this.historyState, historyState) && !replace) {
      return false;
    }
    this.historyState = historyState;

    let url = this.root + '#' + historyState.fragment;

    if (fragment === '' && url !== '/') {
      url = url.slice(0, -1);
    }
    url = url.replace('//', '/');

    this.history[replace ? 'replaceState' : 'pushState'](historyState, DOM.title, url);

    if (trigger) {
      return this._loadUrl(historyState);
    }
  }

  navigateBack() {
    this.history.back();
  }

  setTitle(title) {
    DOM.title = title;
  }

  getState(key) {
    let state = Object.assign({}, this.history.state);
    return state[key];
  }

  _getHash() {
    return this.location.hash.substr(1);
  }

  _parseFragment(fragment, query) {
    query = query || '';

    let queryIndex = fragment.indexOf('?');
    if (queryIndex >= 0) {
      query = fragment.slice(queryIndex + 1).trim();
      fragment = fragment.slice(0, queryIndex);
    }

    fragment = '/' + fragment.replace(routeStripper, '');

    const stateString = fragment + (query.length > 0 ? '?' + query : '');

    return { fragment, query, stateString };
  }

  _getHistoryState() {
    const hashOnlyState = this._parseFragment(this._getHash());
    if (hashOnlyState.query.length > 0) {
      return hashOnlyState;
    }
    if (hashOnlyState.fragment === this.getState('fragment')) {
      return this._parseFragment(this._getHash(), this.getState('query'));
    } else {
      let { pathname, search, hash } = this.location;
      this.history.replaceState(hashOnlyState, null, `${pathname}${search}${hash}`);
      return hashOnlyState;
    }
  }

  _checkUrl(isHashChange) {
    let current = this._getHistoryState();
    if (!stateEqual(current, this.historyState)) {
      this._loadUrl(current);
    }
  }

  _loadUrl(stateOverride) {
    if (!stateOverride) {
      stateOverride = this._getHistoryState();
    }
    this.historyState = stateOverride;

    return this.options.routeHandler ? this.options.routeHandler(this.historyState.stateString) : false;
  }
}, _class.inject = [LinkHandler], _temp);

const routeStripper = /^#?\/*|\s+$/g;

const rootStripper = /^\/+|\/+$/g;

const absoluteUrl = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

function createOrigin(protocol, hostname, port) {
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
}