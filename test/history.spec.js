import './setup';
import { ShortUrlHistory } from '../src/index';
import { LinkHandler } from '../src/link-handler';

describe('browser history', () => {
  it('should have some tests', () => {
    const bh = new ShortUrlHistory();
    expect(bh).toBe(bh);
  });

  describe('_parseFragment()', () => {
    it('should normalize fragment without query', () => {
      const expected = {
        query: '',
        fragment: '/admin/user/123',
        stateString: '/admin/user/123'
      };
      const bh = new ShortUrlHistory();

      expect(bh._parseFragment('admin/user/123')).toEqual(expected);
      expect(bh._parseFragment('admin/user/123?')).toEqual(expected);
      expect(bh._parseFragment('admin/user/123  ')).toEqual(expected);
      expect(bh._parseFragment('/admin/user/123?')).toEqual(expected);
      expect(bh._parseFragment('/admin/user/123   ')).toEqual(expected);
      expect(bh._parseFragment('///admin/user/123')).toEqual(expected);

      expect(bh._parseFragment('#admin/user/123')).toEqual(expected);
      expect(bh._parseFragment('#admin/user/123  ')).toEqual(expected);
      expect(bh._parseFragment('#/admin/user/123')).toEqual(expected);
      expect(bh._parseFragment('#/admin/user/123?   ')).toEqual(expected);
      expect(bh._parseFragment('#///admin/user/123?')).toEqual(expected);
    });

    it('should extract query', () => {
      const expected = {
        query: 'a=1&b=42&cat[]=dog&cat[]=mouse',
        fragment: '/admin/user/123',
        stateString: '/admin/user/123?a=1&b=42&cat[]=dog&cat[]=mouse'
      };
      const bh = new ShortUrlHistory();

      expect(bh._parseFragment('admin/user/123?a=1&b=42&cat[]=dog&cat[]=mouse')).toEqual(expected);
      expect(bh._parseFragment('/admin/user/123?a=1&b=42&cat[]=dog&cat[]=mouse')).toEqual(expected);
      expect(bh._parseFragment('/admin/user/123?a=1&b=42&cat[]=dog&cat[]=mouse   ')).toEqual(expected);
      expect(bh._parseFragment('///admin/user/123?a=1&b=42&cat[]=dog&cat[]=mouse')).toEqual(expected);

      expect(bh._parseFragment('#admin/user/123?a=1&b=42&cat[]=dog&cat[]=mouse')).toEqual(expected);
      expect(bh._parseFragment('#admin/user/123  ?a=1&b=42&cat[]=dog&cat[]=mouse  ')).toEqual(expected);
      expect(bh._parseFragment('#/admin/user/123?a=1&b=42&cat[]=dog&cat[]=mouse')).toEqual(expected);
      expect(bh._parseFragment('#/admin/user/123  ?a=1&b=42&cat[]=dog&cat[]=mouse  ')).toEqual(expected);
      expect(bh._parseFragment('#///admin/user/123?a=1&b=42&cat[]=dog&cat[]=mouse')).toEqual(expected);
    });
  });

  describe('getAbsoluteRoot', () => {
    it('should return a valid URL with a trailing slash', () => {
      const bh = new ShortUrlHistory(new LinkHandler());
      bh.activate({});
      bh.location = {
        protocol: 'http:',
        hostname: 'localhost',
        port: ''
      };

      expect(bh.getAbsoluteRoot()).toBe('http://localhost/');
    });

    it('should return a valid URL with a port', () => {
      const options = {};
      const bh = new ShortUrlHistory(new LinkHandler());
      bh.activate(options);
      bh.location = {
        protocol: 'https:',
        hostname: 'www.aurelia.io',
        port: '8080'
      };

      expect(bh.getAbsoluteRoot()).toBe('https://www.aurelia.io:8080/');
    });

    it('should return a valid URL with a trailing fragment if root is set', () => {
      const options = { root: '/application/' }
      const bh = new ShortUrlHistory(new LinkHandler());
      bh.activate(options);
      bh.location = {
        protocol: 'https:',
        hostname: 'www.aurelia.io',
        port: '8080'
      };

      expect(bh.getAbsoluteRoot()).toBe('https://www.aurelia.io:8080/application/');
    });
  });

  describe('_getHistoryState', () => {
    it('should get browser page state by parsing the hash', () => {
      const bh = new ShortUrlHistory(new LinkHandler());
      bh.activate({});
      bh.location = {
        protocol: 'http:',
        hostname: 'localhost',
        port: '',
        hash: '#/a/b/c?a=1&b=42'
      };
      expect(bh._getHistoryState().query).toBe('a=1&b=42');
      expect(bh._getHistoryState().fragment).toBe('/a/b/c');
      expect(bh._getHistoryState().stateString).toBe('/a/b/c?a=1&b=42');
    });

    it('should get browser page state available through history.state', () => {
      const bh = new ShortUrlHistory(new LinkHandler());
      bh.activate({});
      bh.history.pushState({query: 'xyz'}, '', bh.location.href);
      expect(bh._getHistoryState().query).toBe('xyz');
    });
  });

  describe('navigate', () => {
    it('should update the browser pushstate to include query and string from url', () => {
      const bh = new ShortUrlHistory(new LinkHandler());
      bh.activate({});

      spyOn(bh.history, 'pushState').and.callThrough();
      bh.history.pushState.and.stub();

      bh.navigate('#/a/b');
      bh.navigate('#/?a=1');
      bh.navigate('#/a/c?a=1');
      bh.navigate('#?b=1');
      bh.navigate('#?b=2');

      expect(bh.history.pushState.calls.argsFor(0)).toEqual([{query: ''}, '', '/#/a/b']);
      expect(bh.history.pushState.calls.argsFor(1)).toEqual([{query: 'a=1'}, '', '/#/']);
      expect(bh.history.pushState.calls.argsFor(2)).toEqual([{query: 'a=1'}, '', '/#/a/c']);
      expect(bh.history.pushState.calls.argsFor(3)).toEqual([{query: 'b=1'}, '', '/#/']);
      expect(bh.history.pushState.calls.argsFor(4)).toEqual([{query: 'b=2'}, '', '/#/']);
    });
  });

  describe('_loadUrl', () => {
    // it('should')
  });
});
