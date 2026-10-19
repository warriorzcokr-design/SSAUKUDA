/* 싸우쿠다 홈페이지 - 관리자(Pages CMS)에서 고친 글·사진을 화면에 넣는 스크립트 (수정하지 않아도 됩니다) */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function get(obj, path) {
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (obj == null) return undefined; obj = obj[parts[i]]; }
    return obj;
  }
  function getJSON(url) {
    return fetch(url + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url);
      return r.json();
    });
  }
  function apply(data) {
    document.querySelectorAll('[data-c]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-c'));
      if (typeof v !== 'string') return;
      if (el.hasAttribute('data-ml')) el.innerHTML = esc(v).replace(/\r?\n/g, '<br>');
      else el.textContent = v;
    });
    document.querySelectorAll('[data-ci]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-ci'));
      if (typeof v !== 'string') return;
      var slot = el.closest('[data-photo-slot]');
      if (v) {
        el.setAttribute('src', v);
        if (slot) { el.hidden = false; var t = slot.querySelector('[data-photo-empty]'); if (t) t.hidden = true; }
      } else if (slot) {
        el.hidden = true; var e = slot.querySelector('[data-photo-empty]'); if (e) e.hidden = false;
      }
    });
    document.querySelectorAll('[data-ch]').forEach(function (el) {
      var v = get(data, el.getAttribute('data-ch'));
      if (typeof v === 'string' && v) el.setAttribute('href', v);
    });
  }

  var BORDER = 'border-bottom: 1px solid #2A2926; ';
  function matchRow(m, last) {
    var b = last ? '' : BORDER;
    function td(pad, extra, v) { return '<td style="padding: 18px ' + pad + '; ' + b + extra + '">' + esc(v) + '</td>'; }
    return '<tr>' +
      td('24px', 'white-space: nowrap', m.date || '[날짜]') +
      td('16px', '', m.event || '[대회명]') +
      td('16px', 'white-space: nowrap', m.division || '[신청 부문]') +
      td('16px', '', m.name || '[선수 이름]') +
      td('16px', 'white-space: nowrap', m.weight || '[체급]') +
      td('16px', '', m.result || '[승 / 패 · 결정 방법]') +
      td('24px', 'color: #A8A39A', m.opponent || '[상대 · 소속]') +
      '</tr>';
  }
  function fillMatches(list) {
    var t = document.getElementById('match-table');
    if (!t || !Array.isArray(list)) return;
    var bodies = t.querySelectorAll('tbody');
    if (bodies.length < 2) return;
    var first = '', rest = '';
    list.forEach(function (m, i) {
      var row = matchRow(m || {}, i === list.length - 1);
      if (i < 10) first += row; else rest += row;
    });
    bodies[0].innerHTML = first;
    bodies[1].innerHTML = rest;
  }

  window.SSContent = {
    load: function (page) {
      var jobs = [getJSON('content/' + page + '.json').then(apply).catch(function () {})];
      if (page === 'records') {
        jobs.push(getJSON('content/matches.json').then(function (d) { fillMatches(d && d.matches); }).catch(function () {}));
      }
      return Promise.all(jobs).then(function () { return window.SSContentData; });
    },
    props: function (page, defaults) {
      return getJSON('content/' + page + '.json').then(function (d) {
        var p = Object.assign({}, defaults);
        if (d && d.settings && typeof d.settings.transferred === 'string') p.transferred = d.settings.transferred;
        return p;
      }).catch(function () { return defaults; });
    }
  };
})();
