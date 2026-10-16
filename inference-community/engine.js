(function (root, factory) {
  "use strict";
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.CommunityEngine = engine;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isCount = value => typeof value === "number" && Number.isFinite(value) && value >= 0;

  function normalizeReading(posts, raw) {
    const normalized = {};
    if (!Array.isArray(posts) || !isRecord(raw)) return normalized;

    for (const post of posts) {
      if (!post || typeof post.id !== "string" || !hasOwn(raw, post.id)) continue;
      const entry = raw[post.id];
      if (!isRecord(entry)) continue;
      const saved = hasOwn(entry, "saved") && entry.saved === true;
      const read = hasOwn(entry, "read") && entry.read === true;
      if (saved || read) {
        // Defining the key also keeps a post ID such as "__proto__" an ordinary entry.
        Object.defineProperty(normalized, post.id, {
          value: { saved, read }, enumerable: true, writable: true, configurable: true,
        });
      }
    }
    return normalized;
  }

  function hasNumericHeat(post) {
    const heat = post && post.heat;
    return isRecord(heat) && (isCount(heat.likes) || isCount(heat.comments));
  }

  function searchableText(post) {
    const fields = [post.title, post.author, post.summary, post.whyRead,
      post.platformLabel, post.categoryTitle, post.categoryLabel];
    if (Array.isArray(post.tags)) fields.push(...post.tags);
    return fields.filter(value => typeof value === "string").join(" ").toLowerCase();
  }

  function dateValue(post) {
    if (typeof post.publishedAt !== "string" || !post.publishedAt.trim()) return -Infinity;
    const value = Date.parse(post.publishedAt);
    return Number.isFinite(value) ? value : -Infinity;
  }

  function compareCount(first, second, key) {
    const a = first.heat && first.heat[key];
    const b = second.heat && second.heat[key];
    const aKnown = isCount(a);
    const bKnown = isCount(b);
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    return aKnown ? b - a : 0;
  }

  function compareCurated(first, second) {
    const a = first.post.rank;
    const b = second.post.rank;
    const aRanked = typeof a === "number" && Number.isFinite(a);
    const bRanked = typeof b === "number" && Number.isFinite(b);
    if (aRanked !== bRanked) return aRanked ? -1 : 1;
    return (aRanked ? a - b : 0) || first.index - second.index;
  }

  function getVisiblePosts(posts, filters, reading) {
    if (!Array.isArray(posts)) return [];
    const settings = isRecord(filters) ? filters : {};
    const progress = normalizeReading(posts, reading);
    const terms = typeof settings.query === "string"
      ? settings.query.trim().toLowerCase().split(/\s+/u).filter(Boolean) : [];
    const platform = settings.platform || "all";
    const sort = settings.sort === "heat" && platform === "all" ? "curated" : settings.sort;

    const visible = posts.map((post, index) => ({ post, index })).filter(({ post }) => {
      if (!isRecord(post)) return false;
      for (const field of ["category", "platform", "level"]) {
        if (settings[field] && settings[field] !== "all" && post[field] !== settings[field]) return false;
      }
      if (settings.numericHeat && !hasNumericHeat(post)) return false;
      if (settings.reading === "saved" || settings.reading === "read") {
        if (!hasOwn(progress, post.id) || !progress[post.id][settings.reading]) return false;
      }
      if (terms.length) {
        const text = searchableText(post);
        if (!terms.every(term => text.includes(term))) return false;
      }
      return true;
    });

    visible.sort((first, second) => {
      if (sort === "newest") {
        const a = dateValue(first.post);
        const b = dateValue(second.post);
        if (a !== b) return a > b ? -1 : 1;
        return first.index - second.index;
      }
      if (sort === "heat") {
        return compareCount(first.post, second.post, "likes")
          || compareCount(first.post, second.post, "comments")
          || first.index - second.index;
      }
      return compareCurated(first, second);
    });

    return visible.map(entry => entry.post);
  }

  return { normalizeReading, getVisiblePosts, hasNumericHeat };
});
