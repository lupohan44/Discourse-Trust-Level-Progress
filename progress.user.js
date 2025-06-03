// ==UserScript==
// @name         Discourse Trust-Level Progress Tracker
// @namespace    https://github.com/lupohan44/Discourse-Trust-Level-Progress
// @version      2025-06-03
// @description  Shows how many requirements you still need to reach the next trust level on any Discourse forum (Profile → Summary page).
// @author       Hua
// @match        *://*/u/*/summary*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discourse.org
// @grant        window.onurlchange
// @require      https://scriptcat.org/lib/513/2.0.0/ElementGetter.js
// ==/UserScript==

(() => {
  'use strict';

  /*************************************************************************
   * Utilities
   *************************************************************************/

  /**
   * Build the API base path.
   * Supports forums hosted in a sub-directory, e.g. https://example.com/forum.
   */
  function getApiBase() {
    const { origin, pathname } = location;
    // Matches "/forum/u/username/summary" → baseDir = "/forum"
    const match = pathname.match(/^\/([^/]+)\/u\//);
    const baseDir = match ? `/${match[1]}` : '';
    return origin + baseDir;
  }

  /** API root, e.g. "https://discuss.example.com" or "https://example.com/forum" */
  const API_BASE = getApiBase();

  /** Extract the current profile’s username from the URL. */
  function getUsername() {
    const match = location.pathname.match(/\/u\/([^/?#]+)\//);
    return match ? match[1] : null;
  }

  /*************************************************************************
   * Trust-level requirements (Discourse defaults)
   * Feel free to tweak these values if your community uses custom settings.
   *************************************************************************/
  const TL_REQUIREMENTS = {
    0: { topics_entered: 5, posts_read_count: 30, time_read: 60 * 10 },
    1: {
      days_visited: 15,
      likes_given: 1,
      likes_received: 1,
      posts_count: 3,
      topics_entered: 20,
      posts_read_count: 100,
      time_read: 60 * 60
    },
    2: {
      days_visited: 50,
      // These three are dynamically updated at runtime
      posts_read_count: 0,
      topics_entered: 0,
      likes_given: 30,
      likes_received: 20,
      posts_count: 10
    }
  };

  /**
   * CSS selectors for stats elements on the Summary page.
   * Keys must match the property names used by the Discourse API.
   */
  const SUMMARY_SELECTORS = {
    days_visited:    'li.stats-days-visited    > div > span > span',
    likes_given:     'li.stats-likes-given     > a   > div > span > span',
    likes_received:  'li.stats-likes-received  > div > span > span',
    posts_count:     'li.stats-posts-count     > a   > div > span > span',
    topics_entered:  'li.stats-topics-entered  > div > span > span',
    posts_read_count:'li.stats-posts-read      > div > span > span',
    time_read:       'li.stats-time-read       > div > span'
  };

  /*************************************************************************
   * API helpers
   *************************************************************************/

  /** Fetch site-wide statistics (needed for TL3 dynamic thresholds). */
  const fetchSiteStats = () =>
    fetch(`${API_BASE}/about.json`, { credentials: 'same-origin' })
      .then(r => {
        if (!r.ok) throw new Error(`about.json ${r.status}`);
        return r.json();
      });

  /** Fetch the summary & stats for the given user. */
  const fetchUserSummary = username =>
    fetch(`${API_BASE}/u/${username}/summary.json`, { credentials: 'same-origin' })
      .then(r => {
        if (!r.ok) throw new Error(`summary.json ${r.status}`);
        return r.json();
      });

  /*************************************************************************
   * Core logic
   *************************************************************************/

  /**
   * Update the stats on the page, colouring them green when the target is met.
   * @param {Object} user         – user object from API
   * @param {Object} summaryStats – user_summary object from API
   */
  function paintStats(user, summaryStats) {
    const target = TL_REQUIREMENTS[user.trust_level] ?? TL_REQUIREMENTS[0];

    Object.keys(target).forEach(stat => {
      elmGetter
        .get(SUMMARY_SELECTORS[stat])
        .then(el => {
          const current = summaryStats[stat];
          const needed  = target[stat];

          el.textContent =
            stat === 'time_read'
              ? `${current} / ${needed} seconds`
              : `${current} / ${needed}`;

          el.style.color = Number(current) >= Number(needed) ? 'green' : 'red';
        })
        .catch(() => {
          /* Selector missing on this forum/theme – safe to ignore */
        });
    });
  }

  /**
   * Refresh the displayed progress (fetches site + user data in parallel).
   */
  async function refresh() {
    const username = getUsername();
    if (!username) return;

    try {
      const [site, user] = await Promise.all([
        fetchSiteStats(),
        fetchUserSummary(username)
      ]);

      const siteStats   = site.about.stats;
      const summary     = user.user_summary;
      const userObj     = (user.users && user.users[0]) || { trust_level: 0 };

      // Dynamic thresholds for TL3 (user.trust_level === 2)
      if (userObj.trust_level === 2) {
        TL_REQUIREMENTS[2].posts_read_count = Math.min(
          Math.floor(siteStats.posts_30_days   / 4),
          20000
        );
        TL_REQUIREMENTS[2].topics_entered = Math.min(
          Math.floor(siteStats.topics_30_days  / 4),
          500
        );
      }

      paintStats(userObj, summary);
    } catch (err) {
      console.error('[TL-Tracker] refresh() failed:', err);
    }
  }

  /*************************************************************************
   * SPA navigation hooks
   *************************************************************************/

  // Initial load
  refresh();

  // Modern browsers: native `urlchange` event
  if (window.onurlchange !== undefined) {
    window.addEventListener('urlchange', e => {
      if (/\/u\/[^/]+\/summary/.test(e.url)) refresh();
    });
  } else {
    // Fallback: patch history API + popstate
    const { pushState, replaceState } = history;

    const checkRoute = () => {
      if (/\/u\/[^/]+\/summary/.test(location.pathname)) refresh();
    };

    history.pushState = function (...args) {
      pushState.apply(this, args);
      checkRoute();
    };

    history.replaceState = function (...args) {
      replaceState.apply(this, args);
      checkRoute();
    };

    window.addEventListener('popstate', checkRoute);
  }
})();
