// ==UserScript==
// @name         Discourse Trust-Level Floating Widget
// @namespace    https://github.com/yourname/discourse-tl-widget
// @version      2025-06-06
// @description  A sleek floating widget that shows your progress towards the next trust level on ANY Discourse forum (TL 0 → 3 supported).
// @author       Hua
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discourse.org
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==
/*  ╔═══════════════════════════════════════════════════════════════╗
    ║                       CONFIGURABLE PART                       ║
    ╚═══════════════════════════════════════════════════════════════╝ */

const TL_REQUIREMENTS = { // Discourse defaults; adjust for custom forums
  0 : {
    topics_entered: 5,
    posts_read_count: 30,
    time_read: 600
  },
  1 : {
    days_visited: 15,
    likes_given: 1,
    likes_received: 1,
    posts_count: 3,
    topics_entered: 20,
    posts_read_count: 100,
    time_read: 3600,
    replies_to_different_topics: 3
    /* best-effort */
  },
  2 : {
    days_visited: 50,
    posts_read_count: 0,
    topics_entered: 0,
    likes_given: 30,
    likes_received: 20,
    posts_count: 10
  }
};
const TL3_MAINTAIN_IDX = 2; // reuse TL2→3 thresholds for TL3 retention
/*  ╔═══════════════════════════════════════════════════════════════╗
    ║                        CORE LOGIC START                       ║
    ╚═══════════════════════════════════════════════════════════════╝ */

(async() = >{
  /* -------------------------------------------------------------- *
   *  Helpers
   * -------------------------------------------------------------- */
  const $ = sel = >document.querySelector(sel);
  const html = (parent, tpl) = >{
    parent.insertAdjacentHTML('beforeend', tpl);
  };

  /* Support forums hosted in a sub-directory, e.g. example.com/forum */
  const apiBase = (() = >{
    const {
      origin,
      pathname
    } = location;
    const m = pathname.match(/^\/([^/] + )\ / u\ //);      // /forum/u/...
    return origin + (m ? ` / $ {
      m[1]
    }`: '');
  })();

  /* Get current username — try fast <meta> then fallback to session API */
  async
  function getCurrentUsername() {
    const tag = $('meta[name="current-user-username"]');
    if (tag ? .content) return tag.content;
    const r = await fetch(`$ {
      apiBase
    }
    /session/current.json`, {
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json'
      }
    });
    if (r.ok) {
      const js = await r.json();
      return js ? .current_user ? .username || null;
    }
    return null;
  }
  const username = await getCurrentUsername();
  if (!username) return; // not logged-in user; widget not shown
  /* Dark-mode helper */
  function applyDark(el) {
    if (matchMedia('(prefers-color-scheme: dark)').matches) el.classList.add('ld-dark');
  }

  /* -------------------------------------------------------------- *
   *  UI
   * -------------------------------------------------------------- */
  function buildUI() {
    html(document.body, ` < div id = "ld-container" > <div id = "ld-btn" > <span id = "ld-lvl" > L ? </span>
          <div id="ld-bar"><div id="ld-fill"></div > </div>
          <span id="ld-stat">0/0 < /span>
        </div > <div id = "ld-popup" > <header > <span id = "ld-name" > … < /span>
            <span id="ld-badge">TL → ?</span > </header>
          <div id="ld-main"><div id="ld-list"></div > </div>
          <footer>
            <small id="ld-msg">Loading…</small > <br > <button id = "ld-reload" > Reload < /button>
          </footer > </div>
      </div > `);
    applyDark($('#ld-container'));
    $('#ld-btn').addEventListener('mouseenter', () = >$('#ld-popup').classList.add('show'));
    $('#ld-container').addEventListener('mouseleave', () = >$('#ld-popup').classList.remove('show'));
    $('#ld-reload').onclick = refresh;
  }

  /* -------------------------------------------------------------- *
   *  API helpers (dual-source)
   * -------------------------------------------------------------- */

  /** Site-wide stats (for TL2→3 dynamic thresholds) */
  const fetchSiteStats = () = >fetch(`$ {
    apiBase
  }
  /about.json`, {
        headers: { 'Accept': 'application/json ' }
    })
    .then(r => r.json())
    .then(({ about }) => about.stats);


  /** Full summary (has all fields, but some counts stale) */
  const fetchUserSummary = uname =>
    fetch(`${apiBase}/u/${uname}/summary.json`, {
      credentials: 'same - origin ',
      headers: { 'Accept ': 'application / json ' }
    }).then(r => r.json());

  /** Quarterly directory stats (fresh but partial) */
  const fetchUserDirStats = uname =>
    fetch(`${apiBase}/directory_items?period=quarterly&order=days_visited`, {
      credentials: 'same - origin ',
      headers: { 'Accept ': 'application / json ' }
    }).then(r => r.json())
      .then(({ directory_items }) => {
        const item = directory_items.find(i => i.user?.username === uname)
                  || directory_items[0];
        return item || null;
      });

  /* -------------------------------------------------------------- *
   *  Fetch & render
   * -------------------------------------------------------------- */
  async function refresh() {
    $('#ld - msg ').innerText = 'Updating…';
    try {
      const uname = await getCurrentUsername();
      if (!uname) throw Error('Not logged in ');

      /* Parallel fetch: site totals + two user-level APIs */
      const [siteStats, sumRaw, dirItem] = await Promise.all([
        fetchSiteStats(),
        fetchUserSummary(uname),
        fetchUserDirStats(uname)
      ]);

      if (!dirItem) throw Error('directory_items lookup failed ');
        const sumStats  = sumRaw.user_summary;
      const sumUser   = (sumRaw.users && sumRaw.users[0]) || { trust_level: 0 };
        const tl         = dirItem.user?.trust_level ?? sumUser.trust_level ?? 0;
        const isMaintain = tl >= 3;                       // TL3+ maintenance mode
        const tierIndex  = isMaintain ? TL3_MAINTAIN_IDX : tl; // pick requirement set
      if (tl >= 4) { $('#ld - msg ').innerText = 'TL4 + widget hidden '; return; }

      /* Dynamic thresholds for TL2→3 (Discourse default logic) */
if (tierIndex === 2) {
  TL_REQUIREMENTS[2].posts_read_count =
    Math.min(Math.floor(siteStats.posts_30_days  / 4), 20000);
  TL_REQUIREMENTS[2].topics_entered =
    Math.min(Math.floor(siteStats.topics_30_days / 4), 500);
}

      /* Merge: directory values override summary (more up-to-date) */
      const stats = { ...sumStats };
      [
        ['days_visited ',     dirItem.days_visited],
        ['likes_given ',      dirItem.likes_given],
        ['likes_received ',   dirItem.likes_received],
        ['posts_count ',      dirItem.post_count],
        ['topics_entered ',   dirItem.topics_entered],
        ['posts_read_count ', dirItem.posts_read]
      ].forEach(([k, v]) => { if (v != null) stats[k] = v; });

      /* Compose list of requirement items */
      const req = TL_REQUIREMENTS[tierIndex];
      const items  = Object.entries(req).map(([k, need]) => {
        const cur       = stats[k] ?? 0;
        const curShow   = k === 'time_read ' ? Math.round(cur / 60) + 'm ' : cur;
        const needShow  = k === 'time_read ' ? Math.round(need / 60) + 'm ' : need;
        return { label: k.replace(/_/g, ''), cur, need, curShow, needShow,
                 ok: Number(cur) >= Number(need) };
      });

      /* Percent complete */
      const done  = items.filter(i => i.ok).length;
      const pct   = Math.round(done / items.length * 100);

      /* ---------- render ---------- */
      $('#ld - name ').innerText   = uname;
      $('#ld - badge ').innerText = isMaintain ? 'Keep TL3 ' : `→ TL${tl + 1}`;
      $('#ld - lvl ').innerText    = `L${tl}`;
      $('#ld - fill ').style.width = pct + ' % ';
      $('#ld - stat ').innerText   = `${done}/${items.length}`;

      const list = $('#ld - list ');
      list.innerHTML = '';
      items.forEach(i => {
        const color = i.ok ? '
  var (--ld - good)' : '
  var (--ld - bad)';
        html(list, `<div class="ld-row">
          <span>${i.label}</span>
          <span style="color:${color}">${i.curShow} / ${i.needShow}</span>
        </div>`);
      });

      $('#ld - msg ').innerText = done === items.length
  ? (isMaintain
      ? 'You have secured TL3.'
      : `Congrats! You meet TL${tl + 1}.`)
  : (isMaintain
      ? `Need ${items.length - done} more target(s) to keep TL3.`
      : `Need ${items.length - done} more target(s).`);
    } catch (err) {
      $('#ld - msg ').innerText = 'Error: ' + err.message;
    }
  }

  /* -------------------------------------------------------------- *
   *  Init
   * -------------------------------------------------------------- */
  GM_addStyle(/* css */`
    :root{
      --ld-bg:#fff;--ld-fg:#1f2937;--ld-muted:#6b7280;--ld-good:#16a34a;
      --ld-bad:#dc2626;--ld-bar:#e5e7eb;--ld-accent:#fb923c;
    }
    .ld-dark{--ld-bg:#262626;--ld-fg:#e5e7eb;--ld-muted:#9ca3af;
             --ld-bar:#525252;}
    #ld-container{position:fixed;top:50%;right:0;transform:translateY(-50%);
      font-family:system-ui,sans-serif;z-index:9999;}
    #ld-btn{background:var(--ld-bg);border:1px solid var(--ld-bar);
      border-right:none;border-radius:8px 0 0 8px;padding:8px;width:56px;
      display:flex;flex-direction:column;align-items:center;gap:4px;
      cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1);}
    #ld-btn:hover{width:72px}
    #ld-lvl{font-weight:700;color:var(--ld-accent)}
    #ld-bar{width:40px;height:4px;background:var(--ld-bar);
      border-radius:2px;overflow:hidden}
    #ld-fill{height:100%;background:linear-gradient(90deg,#fb923c,#f97316)}
    #ld-stat{font-size:10px;color:var(--ld-muted)}
    #ld-popup{position:absolute;right:100%;top:50%;
      transform:translateY(-50%);background:var(--ld-bg);
      border:1px solid var(--ld-bar);border-radius:12px;width:320px;
      opacity:0;pointer-events:none;transition:.2s;
      box-shadow:0 10px 20px rgba(0,0,0,.15);}
    #ld-popup.show{opacity:1;pointer-events:auto;
      transform:translate(-8px,-50%)}
    header{padding:12px;border-bottom:1px solid var(--ld-bar);font-size:14px;
      display:flex;justify-content:space-between;align-items:center}
    #ld-list{padding:12px;max-height:250px;overflow-y:auto;font-size:12px}
    .ld-row{display:flex;justify-content:space-between;padding:2px 0}
    footer{font-size:12px;color:var(--ld-muted);padding:8px 12px 12px;
      border-top:1px solid var(--ld-bar);text-align:center}
    #ld-reload{margin-top:6px;padding:4px 8px;border:0;border-radius:6px;
      background:var(--ld-bar);cursor:pointer;color:var(--ld-fg);}
  `);

  buildUI();
  refresh();
})();
'
