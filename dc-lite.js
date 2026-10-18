/* 싸우쿠다 홈페이지 - 화면 갱신용 작은 스크립트 (수정하지 않아도 됩니다) */
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

  function compile(root) {
    var binders = [];
    // 반복 영역(sc-for)
    var fors = Array.prototype.slice.call(root.querySelectorAll('sc-for')).filter(function (el) {
      var p = el.parentNode;
      while (p && p !== root) { if (p.nodeName === 'SC-FOR') return false; p = p.parentNode; }
      return true;
    });
    fors.forEach(function (el) {
      var anchor = document.createComment('list');
      var tpl = el.innerHTML;
      var listExpr = (el.getAttribute('list') || '').replace(/[{}]/g, '').trim();
      var as = el.getAttribute('as') || 'item';
      el.parentNode.replaceChild(anchor, el);
      var made = [];
      binders.push(function (scopes) {
        made.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
        made = [];
        var arr = lookup(listExpr, scopes) || [];
        var after = anchor;
        arr.forEach(function (item, idx) {
          var t = document.createElement('template');
          t.innerHTML = tpl;
          var frag = t.content;
          var sub = compile(frag);
          var local = {}; local[as] = item; local.$index = idx;
          var sc = [local].concat(scopes);
          sub.forEach(function (b) { b(sc); });
          var nodes = Array.prototype.slice.call(frag.childNodes);
          nodes.forEach(function (n) {
            after.parentNode.insertBefore(n, after.nextSibling);
            after = n;
            made.push(n);
          });
        });
      });
    });
    // 글자와 속성
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var node = root.nodeType === 11 ? walker.nextNode() : walker.currentNode;
    while (node) {
      if (node.nodeType === 3) {
        if (node.nodeValue.indexOf('{{') !== -1) {
          (function (n, tpl) {
            binders.push(function (scopes) { n.nodeValue = str(interp(tpl, scopes)); });
          })(node, node.nodeValue);
        }
      } else if (node.nodeType === 1 && node.attributes) {
        Array.prototype.slice.call(node.attributes).forEach(function (a) {
          if (a.value.indexOf('{{') === -1) return;
          var el = node, name = a.name, tpl = a.value;
          el.removeAttribute(name);
          if (name.indexOf('data-dc-on') === 0) {
            var ev = name.slice('data-dc-on'.length);
            var cur = null;
            el.addEventListener(ev, function (e) { if (typeof cur === 'function') cur(e); });
            binders.push(function (scopes) { cur = interp(tpl, scopes); });
          } else {
            binders.push(function (scopes) {
              var v = interp(tpl, scopes);
              if (v === false || v == null) el.removeAttribute(name);
              else el.setAttribute(name, str(v));
            });
          }
        });
      }
      node = walker.nextNode();
    }
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
    binders = compile(root);
    render();
    if (inst.componentDidMount) { try { inst.componentDidMount(); } catch (e) {} }
  };
})();
