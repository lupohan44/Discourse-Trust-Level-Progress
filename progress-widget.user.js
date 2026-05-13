// ==UserScript==
// @name         Discourse Trust-Level Floating Widget
// @namespace    https://github.com/lupohan44/Discourse-Trust-Level-Progress
// @version      2026-05-12
// @description  A sleek floating widget that shows your progress towards the next trust level on ANY Discourse forum (TL 0 → 3 supported).
// @author       Hua, uhhhh, Luxisme
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discourse.org
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

/* === CONFIG === */

const TL_REQUIREMENTS = {
  0: { topics_entered: 5, posts_read_count: 30, time_read: 600 },
  1: {
    days_visited: 15, likes_given: 1, likes_received: 1, posts_count: 3,
    topics_entered: 20, posts_read_count: 100, time_read: 3600,
    replies_to_different_topics: 3,
  },
  2: {
    days_visited: 50, likes_given: 30, likes_received: 20,
    posts_read_count: 0, topics_entered: 0, posts_count: 10,
    // Hidden requirements (enforced by Discourse source, not documented):
    likes_received_users: 5,   // ceil(20 / 4)
    likes_received_days:  7,   // ceil(20 / 3)
    topics_replied_to:    10,  // num_topics_replied_to
  },
};
const TL3_MAINTAIN_IDX = 2;
const TL3_PERIOD_DAYS  = 100;
const HIDDEN_KEYS = new Set(['likes_received_users', 'likes_received_days', 'topics_replied_to']);

/* === CORE === */

(async () => {
  /* Safe DOM helper: only accepts text children, no HTML interpolation. */
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class')      e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k === 'text')  e.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else                    e.setAttribute(k, v);
      }
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }
  const $ = (sel) => document.querySelector(sel);

  const apiBase = (() => {
    const { origin, pathname } = location;
    const m = pathname.match(/^\/([^/]+)\/u\//);
    return origin + (m ? `/${m[1]}` : '');
  })();

  async function getCurrentUsername() {
    const tag = $('meta[name="current-user-username"]');
    if (tag?.content) return tag.content;
    const r = await fetch(`${apiBase}/session/current.json`, {
      credentials: 'same-origin', headers: { Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const js = await r.json();
    return js?.current_user?.username || null;
  }

  const username = await getCurrentUsername();
  if (!username) return;

  const applyDark = (node) =>
    matchMedia('(prefers-color-scheme: dark)').matches && node.classList.add('ld-dark');

  /* UI refs, populated by buildUI */
  const ui = {};

  function buildUI() {
    ui.lvl    = el('span', { id: 'ld-lvl',   text: 'L?' });
    ui.fill   = el('div',  { id: 'ld-fill' });
    ui.bar    = el('div',  { id: 'ld-bar' }, ui.fill);
    ui.stat   = el('span', { id: 'ld-stat',  text: '0/0' });
    ui.btn    = el('div',  { id: 'ld-btn' }, ui.lvl, ui.bar, ui.stat);

    ui.name   = el('span', { id: 'ld-name',  text: '…' });
    ui.badge  = el('span', { id: 'ld-badge', text: 'TL → ?' });
    ui.list   = el('div',  { id: 'ld-list' });
    ui.msg    = el('small',{ id: 'ld-msg',   text: 'Loading…' });
    ui.reload = el('button',{ id: 'ld-reload', text: 'Reload' });

    const header = el('header', null, ui.name, ui.badge);
    const main   = el('div', { id: 'ld-main' }, ui.list);
    const footer = el('footer', null, ui.msg, el('br'), ui.reload);
    ui.popup = el('div', { id: 'ld-popup' }, header, main, footer);

    ui.container = el('div', { id: 'ld-container' }, ui.btn, ui.popup);
    document.body.appendChild(ui.container);

    applyDark(ui.container);
    ui.btn.addEventListener('mouseenter', () => ui.popup.classList.add('show'));
    ui.container.addEventListener('mouseleave', () => ui.popup.classList.remove('show'));
    ui.reload.addEventListener('click', refresh);
  }

  /* --- API --- */
  const fetchSiteStats = () =>
    fetch(`${apiBase}/about.json`, { headers: { Accept: 'application/json' } })
      .then(r => r.json()).then(({ about }) => about.stats);

  const fetchUserSummary = (u) =>
    fetch(`${apiBase}/u/${u}/summary.json`, {
      credentials: 'same-origin', headers: { Accept: 'application/json' },
    }).then(r => r.json());

  const fetchUserDirStats = (u) =>
    fetch(`${apiBase}/directory_items?period=quarterly&order=days_visited`, {
      credentials: 'same-origin', headers: { Accept: 'application/json' },
    }).then(r => r.json())
      .then(({ directory_items }) => directory_items.find(i => i.user?.username === u) || null);

  async function fetchAllActions(u, filter, sinceTs) {
    const PAGE = 30, MAX_PAGES = 60;
    const out = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE;
      const r = await fetch(
        `${apiBase}/user_actions.json?username=${encodeURIComponent(u)}&filter=${filter}&offset=${offset}&limit=${PAGE}`,
        { credentials: 'same-origin', headers: { Accept: 'application/json' } },
      );
      if (!r.ok) break;
      const items = (await r.json()).user_actions || [];
      if (items.length === 0) break;
      let hitCutoff = false;
      for (const a of items) {
        if (Date.parse(a.created_at) < sinceTs) { hitCutoff = true; break; }
        out.push(a);
      }
      if (hitCutoff || items.length < PAGE) break;
    }
    return out;
  }

  async function fetchHiddenStats(u) {
    const sinceTs = Date.now() - TL3_PERIOD_DAYS * 86_400_000;
    const [likesRecv, replies] = await Promise.all([
      fetchAllActions(u, 2, sinceTs),
      fetchAllActions(u, 5, sinceTs),
    ]);
    return {
      likes_received_users: new Set(likesRecv.map(a => a.acting_username)).size,
      likes_received_days:  new Set(likesRecv.map(a => a.created_at.slice(0, 10))).size,
      topics_replied_to:    new Set(replies.map(a => a.topic_id)).size,
    };
  }

  /* --- Main --- */
  async function refresh() {
    ui.msg.textContent = 'Updating…';
    try {
      const uname = await getCurrentUsername();
      if (!uname) throw Error('Not logged in');

      const [siteStats, sumRaw, dirItem] = await Promise.all([
        fetchSiteStats(), fetchUserSummary(uname), fetchUserDirStats(uname),
      ]);
      if (!dirItem) throw Error('directory_items lookup failed');

      const sumStats = sumRaw.user_summary;
      const tl = dirItem.user?.trust_level ?? sumRaw.users?.[0]?.trust_level ?? 0;
      if (tl >= 4) { ui.msg.textContent = 'TL4+ widget hidden'; return; }

      const isMaintain = tl >= 3;
      const idx = isMaintain ? TL3_MAINTAIN_IDX : tl;

      if (idx === 2) {
        TL_REQUIREMENTS[2].posts_read_count = Math.min(Math.floor(siteStats.posts_30_days  / 4), 20000);
        TL_REQUIREMENTS[2].topics_entered   = Math.min(Math.floor(siteStats.topics_30_days / 4),   500);
      }

      const stats = { ...sumStats };
      [
        ['days_visited',     dirItem.days_visited],
        ['likes_given',      dirItem.likes_given],
        ['likes_received',   dirItem.likes_received],
        ['posts_count',      dirItem.post_count],
        ['topics_entered',   dirItem.topics_entered],
        ['posts_read_count', dirItem.posts_read],
      ].forEach(([k, v]) => { if (v != null) stats[k] = v; });

      if (idx === 2) {
        try {
          const hidden = await fetchHiddenStats(uname);
          Object.assign(stats, hidden);
        } catch (e) {
          console.warn('[TL-Tracker v2] hidden stats fetch failed:', e);
        }
      }

      const req   = TL_REQUIREMENTS[idx];
      const items = Object.entries(req).map(([k, need]) => {
        const cur = stats[k] ?? 0;
        const fmt = v => (k === 'time_read' ? Math.round(v / 60) + 'm' : v);
        return {
          label: k.replace(/_/g, ' '),
          cur, need,
          ok: +cur >= +need,
          curShow: fmt(cur), needShow: fmt(need),
          hidden: HIDDEN_KEYS.has(k),
        };
      });

      const done = items.filter(i => i.ok).length;
      const pct  = Math.round(done / items.length * 100);

      ui.name.textContent  = uname;
      ui.badge.textContent = isMaintain ? 'Keep TL3' : `→ TL${tl + 1}`;
      ui.lvl.textContent   = `L${tl}`;
      ui.fill.style.width  = pct + '%';
      ui.stat.textContent  = `${done}/${items.length}`;

      /* Rebuild list with safe DOM ops only. */
      ui.list.textContent = '';  // clear
      items.forEach(i => {
        const labelEl = el('span', { class: 'ld-label' }, i.label);
        if (i.hidden) {
          labelEl.appendChild(el('span', { class: 'ld-mark', title: 'Hidden rule from Discourse source' }, '*'));
        }
        const valEl = el('span', {
          style: `color: ${i.ok ? 'var(--ld-good)' : 'var(--ld-bad)'}`,
        }, `${i.curShow} / ${i.needShow}`);
        const row = el('div', { class: i.hidden ? 'ld-row ld-hidden' : 'ld-row' }, labelEl, valEl);
        ui.list.appendChild(row);
      });

      ui.msg.textContent =
        done === items.length
          ? (isMaintain ? 'You have secured TL3.' : `Congrats! You meet TL${tl + 1}.`)
          : (isMaintain ? `Need ${items.length - done} more to keep TL3.`
                        : `Need ${items.length - done} more target(s).  * = hidden rule`);
    } catch (e) {
      ui.msg.textContent = 'Error: ' + e.message;
    }
  }

  GM_addStyle(`
    :root{--ld-bg:#fff;--ld-fg:#1f2937;--ld-muted:#6b7280;--ld-good:#16a34a;
          --ld-bad:#dc2626;--ld-bar:#e5e7eb;--ld-accent:#fb923c;}
    .ld-dark{--ld-bg:#262626;--ld-fg:#e5e7eb;--ld-muted:#9ca3af;--ld-bar:#525252;}
    #ld-container{position:fixed;top:50%;right:0;transform:translateY(-50%);
      font-family:system-ui,sans-serif;z-index:9999;}
    #ld-btn{background:var(--ld-bg);border:1px solid var(--ld-bar);
      border-right:none;border-radius:8px 0 0 8px;padding:8px;width:56px;
      display:flex;flex-direction:column;align-items:center;gap:4px;
      cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1);}
    #ld-btn:hover{width:72px}
    #ld-lvl{font-weight:700;color:var(--ld-accent)}
    #ld-bar{width:40px;height:4px;background:var(--ld-bar);border-radius:2px;overflow:hidden}
    #ld-fill{height:100%;background:linear-gradient(90deg,#fb923c,#f97316)}
    #ld-stat{font-size:10px;color:var(--ld-muted)}
    #ld-popup{position:absolute;right:100%;top:50%;transform:translateY(-50%);
      background:var(--ld-bg);border:1px solid var(--ld-bar);border-radius:12px;width:340px;
      opacity:0;pointer-events:none;transition:.2s;box-shadow:0 10px 20px rgba(0,0,0,.15);}
    #ld-popup.show{opacity:1;pointer-events:auto;transform:translate(-8px,-50%)}
    header{padding:12px;border-bottom:1px solid var(--ld-bar);font-size:14px;
      display:flex;justify-content:space-between;align-items:center}
    #ld-list{padding:12px;max-height:280px;overflow-y:auto;font-size:12px}
    .ld-row{display:flex;justify-content:space-between;padding:2px 0}
    .ld-hidden{font-style:italic}
    .ld-mark{color:var(--ld-accent);margin-left:3px;font-weight:700}
    footer{font-size:12px;color:var(--ld-muted);padding:8px 12px 12px;
      border-top:1px solid var(--ld-bar);text-align:center}
    #ld-reload{margin-top:6px;padding:4px 8px;border:0;border-radius:6px;
      background:var(--ld-bar);cursor:pointer;color:var(--ld-fg);}
  `);

  buildUI();
  refresh();
})();
