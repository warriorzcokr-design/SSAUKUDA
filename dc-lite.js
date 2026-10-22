/* 싸우쿠다 홈페이지 - 화면 갱신용 작은 스크립트 (수정하지 않아도 됩니다)
   미리 만들어 둔 페이지(검색용)에서도 다시 연결되도록 템플릿 정보를 data-dc-* 속성에 남깁니다. */
(function () {
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var ONLY = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(path, scopes) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.');
    for (var i = 0; i < scopes.length; i++) {
      var sc = scopes[i];
      if (sc && typeof sc === 'object' && parts[0] in sc) {
        var v = sc;
        for (var j = 0; j < parts.length; j++) {
          if (v == null) return undefined;
          v = v[parts[j]];
        }
        return v;
      }
    }
    return undefined;
  }
  function str(v) { return v == null ? '' : String(v); }
  function interp(tpl, scopes) {
    var m = tpl.match(ONLY);
    if (m) return lookup(m[1], scopes);
    return tpl.replace(HOLE, function (_, p) { return str(lookup(p, scopes)); });
  }
  function insideItem(node, root) {
    var p = node.parentNode;
    while (p && p !== root) {
      if (p.nodeType === 1 && p.hasAttribute && p.hasAttribute('data-dc-item')) return true;
      p = p.parentNode;
    }
    return false;
  }

  function bindList(anchor, tpl, listExpr, as, binders) {
    var n = anchor.nextSibling;
    while (n && ((n.nodeType === 3 && !n.nodeValue.trim()) || (n.nodeType === 1 && n.hasAttribute('data-dc-item')))) {
      var next = n.nextSibling;
      n.parentNode.removeChild(n);
      n = next;
    }
    var made = [];
    binders.push(function (scopes) {
      made.forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
      made = [];
      var arr = lookup(listExpr, scopes) || [];
      var after = anchor;
      arr.forEach(function (item, idx) {
        var t = document.createElement('template');
        t.innerHTML = tpl;
        var frag = t.content;
        var sub = compile(frag, true);
        var local = {}; local[as] = item; local.$index = idx;
        var sc = [local].concat(scopes);
        sub.forEach(function (b) { b(sc); });
        Array.prototype.slice.call(frag.childNodes).forEach(function (x) {
          if (x.nodeType === 3 && !x.nodeValue.trim()) return;
          if (x.nodeType === 1) x.setAttribute('data-dc-item', '');
          after.parentNode.insertBefore(x, after.nextSibling);
          after = x;
          made.push(x);
        });
      });
    });
  }

  function compile(root, isItem) {
    var binders = [];
    Array.prototype.slice.call(root.querySelectorAll('sc-for')).forEach(function (el) {
      if (!el.parentNode) return;
      var p = el.parentNode, nested = false;
      while (p && p !== root) { if (p.nodeName === 'SC-FOR') { nested = true; break; } p = p.parentNode; }
      if (nested) return;
      var t = document.createElement('template');
      t.setAttribute('data-dc-for', (el.getAttribute('list') || '').replace(/[{}]/g, '').trim());
      t.setAttribute('data-dc-as', el.getAttribute('as') || 'item');
      t.innerHTML = el.innerHTML;
      el.parentNode.replaceChild(t, el);
    });
    Array.prototype.slice.call(root.querySelectorAll('template[data-dc-for]')).forEach(function (t) {
      if (!isItem && insideItem(t, root)) return;
      bindList(t, t.innerHTML, t.getAttribute('data-dc-for'), t.getAttribute('data-dc-as') || 'item', binders);
    });
    var list = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var node = root.nodeType === 11 ? walker.nextNode() : walker.currentNode;
    while (node) { list.push(node); node = walker.nextNode(); }
    list.forEach(function (node) {
      if (!isItem && (insideItem(node, root) || (node.nodeType === 1 && node.hasAttribute('data-dc-item')))) return;
      if (node.nodeType === 3) {
        if (node.nodeValue.indexOf('{{') === -1) return;
        var tpl = node.nodeValue;
        if (isItem) {
          binders.push(function (scopes) { node.nodeValue = str(interp(tpl, scopes)); });
        } else {
          var span = document.createElement('span');
          span.setAttribute('data-dc-t', tpl);
          node.parentNode.replaceChild(span, node);
          binders.push(function (scopes) { span.textContent = str(interp(tpl, scopes)); });
        }
        return;
      }
      if (node.nodeType !== 1) return;
      if (!isItem && node.hasAttribute('data-dc-t')) {
        var t2 = node.getAttribute('data-dc-t');
        binders.push(function (scopes) { node.textContent = str(interp(t2, scopes)); });
        return;
      }
      Array.prototype.slice.call(node.attributes).forEach(function (a) {
        var el = node, name = a.name, val = a.value;
        if (name.indexOf('data-dc-on') === 0 && val.indexOf('{{') !== -1) {
          var ev = name.slice('data-dc-on'.length);
          var cur = null;
          el.addEventListener(ev, function (e) { if (typeof cur === 'function') cur(e); });
          binders.push(function (scopes) { cur = interp(val, scopes); });
          if (isItem) el.removeAttribute(name);
          return;
        }
        var target = null, tpl3 = null;
        if (name.indexOf('data-dc-a-') === 0) { target = name.slice('data-dc-a-'.length); tpl3 = val; }
        else if (val.indexOf('{{') !== -1) {
          target = name; tpl3 = val;
          el.removeAttribute(name);
          if (!isItem) el.setAttribute('data-dc-a-' + name, val);
        }
        if (!target) return;
        binders.push(function (scopes) {
          var v = interp(tpl3, scopes);
          if (v === false || v == null) el.removeAttribute(target);
          else el.setAttribute(target, str(v));
        });
      });
    });
    return binders;
  }

  var inst = null, binders = [], pending = false;
  function render() {
    var vals = inst && inst.renderVals ? (inst.renderVals() || {}) : {};
    binders.forEach(function (b) { b([vals]); });
  }
  function schedule() {
    if (pending) return;
    pending = true;
    Promise.resolve().then(function () {
      pending = false;
      render();
      if (inst && inst.componentDidUpdate) { try { inst.componentDidUpdate(); } catch (e) {} }
    });
  }

  window.DCLogic = function DCLogic(props) { this.props = props || {}; this.state = {}; };
  window.DCLogic.prototype.setState = function (o) {
    if (typeof o === 'function') o = o(this.state || {}, this.props);
    this.state = Object.assign({}, this.state || {}, o || {});
    schedule();
  };
  window.DCLogic.prototype.forceUpdate = function () { schedule(); };

  window.DCMount = function (Comp, props) {
    inst = new Comp(props || {});
    inst.props = props || {};
    if (!inst.state) inst.state = {};
    var root = document.getElementById('page-top') || document.body;
    binders = compile(root, false);
    render();
    if (inst.componentDidMount) { try { inst.componentDidMount(); } catch (e) {} }
    window.__dcMounted = true;
  };
})();
