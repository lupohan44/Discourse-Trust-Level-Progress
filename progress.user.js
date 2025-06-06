// ==UserScript==
// @name         Discourse Trust-Level Progress Tracker (directory API)
// @namespace    https://github.com/lupohan44/Discourse-Trust-Level-Progress
// @version      2025-06-06
// @description  Show discourse trust level progress
// @author       Hua
// @match        *://*/u/*/summary*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discourse.org
// @grant        window.onurlchange
// @require      https://scriptcat.org/lib/513/2.0.0/ElementGetter.js
// ==/UserScript==

(() => {
  'use strict';

  /* ---------- Utilities ---------- */

  function getApiBase() {
    const { origin, pathname } = location;
    const match = pathname.match(/^\/([^/]+)\/u\//);
    const baseDir = match ? `/${match[1]}` : '';
    return origin + baseDir;
  }
  const API_BASE = getApiBase();

  function getUsername() {
    const m = location.pathname.match(/\/u\/([^/?#]+)\//);
    return m ? m[1] : null;
  }

  /* ---------- Trust-level targets (defaults) ---------- */

  const TL_REQUIREMENTS = {
    0: { topics_entered: 5, posts_read_count: 30, time_read: 600 },
    1: {
      days_visited: 15,
      likes_given: 1,
      likes_received: 1,
      posts_count: 3,
      topics_entered: 20,
      posts_read_count: 100,
      time_read: 3600
    },
    2: {
      days_visited: 50,
      posts_read_count: 0,
      topics_entered: 0,
      likes_given: 30,
      likes_received: 20,
      posts_count: 10
    }
  };
  const TL3_MAINTAIN_IDX = 2;

  /* ---------- CSS hooks ---------- */

  const SELECTOR = {
    days_visited:     'li.stats-days-visited    > div > span > span',
    likes_given:      'li.stats-likes-given     > a   > div > span > span',
    likes_received:   'li.stats-likes-received  > div > span > span',
    posts_count:      'li.stats-posts-count     > a   > div > span > span',
    topics_entered:   'li.stats-topics-entered  > div > span > span',
    posts_read_count: 'li.stats-posts-read      > div > span > span',
    time_read:        'li.stats-time-read       > div > span'
  };

  /* ---------- API helpers ---------- */

  const fetchSiteStats = () =>
    fetch(`${API_BASE}/about.json`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status));

  const fetchUserDirStats = username =>
    fetch(`${API_BASE}/directory_items?period=quarterly&order=days_visited`, {
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(({ directory_items }) => {
        const item = directory_items.find(i => i.user?.username === username)
                  || directory_items[0];
        if (!item) throw new Error('user not found');
        return {
          days_visited:     item.days_visited,
          likes_given:      item.likes_given,
          likes_received:   item.likes_received,
          posts_count:      item.post_count,
          topics_entered:   item.topics_entered,
          posts_read_count: item.posts_read,
          time_read:        null,               // directory 没有
          trust_level:      item.user?.trust_level ?? 0
        };
      });
    const fetchUserSummary = username =>
    fetch(`${API_BASE}/u/${username}/summary.json`, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
    })
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(res => ({
        stats:        res.user_summary,
        trust_level:  res.users?.[0]?.trust_level ?? 0
    }));

  /* ---------- Render ---------- */

  function paintStats(trustLevel, stats) {
    const target = TL_REQUIREMENTS[trustLevel] || TL_REQUIREMENTS[0];

    Object.keys(target).forEach(k => {
      if (stats[k] == null) return;
      elmGetter
        .get(SELECTOR[k])
        .then(el => {
          el.textContent =
            k === 'time_read'
              ? `${stats[k]} / ${target[k]} s`
              : `${stats[k]} / ${target[k]}`;
          el.style.color =
            Number(stats[k]) >= Number(target[k]) ? 'green' : 'red';
        })
        .catch(() => {});
    });
  }

    async function refresh() {
        const username = getUsername();
        if (!username) return;

        try {
            const [site, summaryObj, dir] = await Promise.all([
                fetchSiteStats(),
                fetchUserSummary(username),
                fetchUserDirStats(username)
            ]);

            const stats = { ...summaryObj.stats };
            Object.entries(dir).forEach(([k, v]) => {
                if (v != null && k !== 'trust_level') stats[k] = v;
            });

            const trustLevel = dir.trust_level ?? summaryObj.trust_level ?? 0;
            const isMaintain = trustLevel >= 3;             // TL3+ retention mode
            const tierIndex  = isMaintain ? TL3_MAINTAIN_IDX : trustLevel;

            /* dynamic thresholds for TL2→3 (also for TL3 retention) */
            if (tierIndex === 2) {
                TL_REQUIREMENTS[2].posts_read_count =
                    Math.min(Math.floor(site.about.stats.posts_30_days / 4), 20000);
                TL_REQUIREMENTS[2].topics_entered =
                    Math.min(Math.floor(site.about.stats.topics_30_days / 4), 500);
            }

            paintStats(tierIndex, stats);
        } catch (e) {
            console.error('[TL-Tracker] refresh error', e);
        }
    }

  /* ---------- SPA hooks ---------- */

  refresh();
  if ('onurlchange' in window) {
    window.addEventListener('urlchange', e => {
      if (/\/u\/[^/]+\/summary/.test(e.url)) refresh();
    });
  } else {
    const { pushState, replaceState } = history;
    const check = () => /\/u\/[^/]+\/summary/.test(location.pathname) && refresh();
    history.pushState = function (...a) { pushState.apply(this, a); check(); };
    history.replaceState = function (...a) { replaceState.apply(this, a); check(); };
    addEventListener('popstate', check);
  }
})();
