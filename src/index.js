import {History} from 'aurelia-history';
import {LinkHandler, DefaultLinkHandler} from './link-handler';
import {DOM, PLATFORM} from 'aurelia-pal';

/**
 * Configures the plugin by registering ShortUrlHistory as the implementation of History in the DI container.
 * @param config The FrameworkConfiguration object provided by Aurelia.
 */
export function configure(config: Object): void {
  config.singleton(History, ShortUrlHistory);
  config.transient(LinkHandler, DefaultLinkHandler);
}

function stateEqual(a, b) {
  return a.fragment === b.fragment && a.query === b.query;
}

/**
 * An implementation of the basic history API.
 */
export class ShortUrlHistory extends History {
  static inject = [LinkHandler];

  //static hasPushState = !!(this.history && this.history.pushState);

  /**
   * Creates an instance of ShortUrlHistory
   * @param linkHandler An instance of LinkHandler.
   */
  constructor(linkHandler: LinkHandler) {
    super();

    this._isActive = false;
    this._onPopStateCallback = () => { this._checkUrl(false); };
    this._onHashChangeCallback = () => { this._checkUrl(true); };

    this.location = PLATFORM.location;
    this.history = PLATFORM.history;
    this.linkHandler = linkHandler;
  }

  /**
   * Activates the history object.
   *
   * This method is called on application start. It must read the current URL/state and invoke a 
   * router action as a result. The incoming URL could contain a hash (e.g. an externally shared
   * link) or it could contain a history.state (e.g. from a reload of the app)
   *
   * @param options The set of options to activate history with.
   * @returns Whether or not activation occurred.
   */
  activate(options?: Object): boolean {
    if (this._isActive) {
      throw new Error('History has already been activated.');
    }

    this._isActive = true;
    this.options = Object.assign({}, { root: '/' }, this.options, options);

    // Normalize root to always include a leading and trailing slash.
    this.root = ('/' + this.options.root + '/').replace(rootStripper, '/');

    // Listen on both - one of the two will fire and we'll see the change
    // IE doesn't fire popstate when the hash changes: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/3740423/
    // so listening on hashchange is essential
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

  /**
   * Deactivates the history object.
   */
  deactivate(): void {
    PLATFORM.removeEventListener('popstate', this._onPopStateCallback);
    PLATFORM.removeEventListener('hashchange', this._onHashChangeCallback);
    this._isActive = false;
    this.linkHandler.deactivate();
  }

  /**
   * Returns the fully-qualified root of the current history object.
   * @returns The absolute root of the application.
   */
  getAbsoluteRoot(): string {
    let origin = createOrigin(this.location.protocol, this.location.hostname, this.location.port);
    return `${origin}${this.root}`;
  }

  /**
   * Causes a history navigation to occur.
   *
   * This method is called by the Aurelia internals to invoke a state transition in the router. 
   * It will be passed a fragment string generated by the framework containing the new route information
   * in full. This method must parse the incoming fragment to pull out the query string and then
   * update the history state / url.
   *
   * @param fragment The history fragment to navigate to.
   * @param options The set of options that specify how the navigation should occur.
   * @param options.replace If true, the url/history.state should be updated but not add an entry
   * to the browser history.
   * @return True if navigation occurred/false otherwise.
   */
  navigate(fragment?: string, {trigger = true, replace = false} = {}): boolean {
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
    // Don't include a trailing slash on the root.
    if (fragment === '' && url !== '/') {
      url = url.slice(0, -1);
    }
    url = url.replace('//', '/');

    // Use pushstate to set the fragment as a real URL, the query in the history state
    this.history[replace ? 'replaceState' : 'pushState'](historyState, DOM.title, url);

    if (trigger) {
      return this._loadUrl(historyState);
    }
  }

  /**
   * Causes the history state to navigate back.
   */
  navigateBack(): void {
    this.history.back();
  }

  /**
   * Sets the document title.
   */
  setTitle(title: string): void {
    DOM.title = title;
  }

  /**
   * Gets a key in the history page state.
   * @param key The key for the value.
   * @return The value for the key.
   */
  getState(key: string): any {
    let state = Object.assign({}, this.history.state);
    return state[key];
  }

  _getHash(): string {
    return this.location.hash.substr(1);
  }

  _parseFragment(fragment: string, query?: string): object {
    query = query || '';

    // Pull query from hash if it's there - overrides current state
    let queryIndex = fragment.indexOf('?');
    if (queryIndex >= 0) {
      query = fragment.slice(queryIndex + 1).trim();
      fragment = fragment.slice(0, queryIndex);
    }

    fragment = '/' + fragment.replace(routeStripper, '');

    const stateString = fragment + (query.length > 0 ? ('?' + query) : '');

    return { fragment, query, stateString };
  }

  _getHistoryState(): object {
    // IE doesn't fire popstate on hash changes (https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/3740423/)
    // AND IE isn't resetting the `history.state` object either so our stored query is wrong. As such, we need
    // to validate that the history.state applies to the url we think it does:
    // First get the fragment without the query of the current hash
    const hashOnlyState = this._parseFragment(this._getHash());
    if (hashOnlyState.query.length > 0) {
      // The hash has a query in it, assume it's correct, use it
      return hashOnlyState;
    }
    if (hashOnlyState.fragment === this.getState('fragment')) {
      // The stored query matches the fragment, ok to use
      return this._parseFragment(this._getHash(), this.getState('query'));
    } else {
      // The stored query doesn't match the fragment, the hash must have changed without history.state being updated
      // Force the current state to update to what we now understand to be true
      let { pathname, search, hash } = this.location;
      this.history.replaceState(hashOnlyState, null, `${pathname}${search}${hash}`);
      return hashOnlyState;
    }
  }

  /**
   * Event listener for changes to the browser history state. This will fire when the browser updates
   * history state - generally through forward/back but also will fire when the code here in this
   * class updates the state. `isHashChange` is provided for debugging purposes
   */
  _checkUrl(isHashChange: boolean): boolean {
    // Browser fired a change event - check to see if actually a change
    let current = this._getHistoryState();
    if (!stateEqual(current, this.historyState)) {
      this._loadUrl(current);
    }
  }

  /**
   * Fires a route change back to Aurelia using the current URL
   */
  _loadUrl(stateOverride: object): boolean {
    // Either get the current state or parse the given state
    if (!stateOverride) {
      stateOverride = this._getHistoryState();
    }
    this.historyState = stateOverride;

    return this.options.routeHandler ?
      this.options.routeHandler(this.historyState.stateString) :
      false;
  }
}

// Cached regex for stripping a leading hash/slash and trailing space.
const routeStripper = /^#?\/*|\s+$/g;

// Cached regex for stripping leading and trailing slashes.
const rootStripper = /^\/+|\/+$/g;

// Cached regex for detecting if a URL is absolute,
// i.e., starts with a scheme or is scheme-relative.
// See http://www.ietf.org/rfc/rfc2396.txt section 3.1 for valid scheme format
const absoluteUrl = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

function createOrigin(protocol: string, hostname: string, port: string) {
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
}