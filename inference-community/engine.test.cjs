const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { normalizeReading, getVisiblePosts, hasNumericHeat } = require("./engine.js");

function makePosts() {
  return [
    { id: "paged", title: "PagedAttention：KV 缓存管理", author: "Woosuk Kwon", platform: "hn", platformLabel: "Hacker News", category: "kv-attention", categoryTitle: "KV Cache 与 Attention", level: "进阶", summary: "虚拟内存与连续批处理", whyRead: "理解分页如何提高并发吞吐", tags: ["vLLM", "KV cache"], publishedAt: "2023-09-14", rank: 2, heat: { likes: 102, comments: 16 } },
    { id: "quant", title: "量化从入门到实战", author: "张三", platform: "zhihu", platformLabel: "知乎", category: "quantization", level: "入门", summary: "INT8 与权重量化", whyRead: "比较精度与显存的取舍", tags: ["GPTQ", "INT8"], publishedAt: "2025-07-01", rank: 1, heat: { likes: null, comments: null } },
    { id: "zero", title: "KV cache 的另一种实现", author: "Alice", platform: "hn", platformLabel: "Hacker News", category: "kv-attention", level: "进阶", summary: "推理服务代码阅读", whyRead: "追踪缓存布局", tags: ["vLLM"], publishedAt: "2026-10-16", rank: 4, heat: { likes: 0, comments: 0 } },
    { id: "comments", title: "Speculative decoding 实测", author: "Bob", platform: "hn", platformLabel: "Hacker News", category: "speculative", level: "深入", summary: "投机解码的接受率", whyRead: "比较不同请求负载", tags: ["MTP"], publishedAt: "2026-10-15", rank: 3, heat: { likes: null, comments: 30 } },
    { id: "unknown", title: "CUDA kernel 调优", author: "Carol", platform: "hn", platformLabel: "Hacker News", category: "kernels-parallel", level: "深入", summary: "算子融合与访存", whyRead: "通过 profiling 找到瓶颈", tags: ["CUDA"], publishedAt: "", rank: 5, heat: { likes: null, comments: null } },
  ];
}

const ids = posts => posts.map(post => post.id);

test("reading normalization ignores corrupt containers, unknown IDs and non-boolean values", () => {
  const posts = makePosts();
  for (const raw of [undefined, null, [], true, 1, "{}", "not JSON"]) {
    assert.deepEqual(normalizeReading(posts, raw), {});
  }
  const raw = {
    paged: { saved: true, read: "true", extra: true },
    quant: { saved: 1, read: true },
    zero: { saved: false, read: false },
    comments: [true, true], unknown: "read", deleted: { saved: true, read: true },
  };
  const expected = { paged: { saved: true, read: false }, quant: { saved: false, read: true } };
  assert.deepEqual(normalizeReading(posts, raw), expected);
  assert.deepEqual(normalizeReading(posts, expected), expected);
  assert.equal(raw.paged.read, "true");
  const arrayMap = [];
  arrayMap.paged = { saved: true };
  assert.deepEqual(normalizeReading(posts, arrayMap), {});
  assert.deepEqual(normalizeReading(posts, { paged: Object.assign([], { saved: true }) }), {});
});

test("inherited IDs and inherited status flags do not create progress", () => {
  const posts = makePosts();
  assert.deepEqual(normalizeReading(posts, Object.create({ paged: { saved: true } })), {});
  assert.deepEqual(normalizeReading(posts, { paged: Object.create({ saved: true, read: true }) }), {});
  const hostile = JSON.parse('{"__proto__":{"saved":true,"read":false}}');
  const normalized = normalizeReading([{ id: "__proto__" }], hostile);
  assert.equal(Object.getPrototypeOf(normalized), Object.prototype);
  assert.equal(Object.hasOwn(normalized, "__proto__"), true);
  assert.deepEqual(normalized.__proto__, { saved: true, read: false });
});

test("saved and read states are independent and combine with other filters", () => {
  const posts = makePosts();
  const reading = { paged: { saved: true, read: true }, quant: { saved: true }, zero: { read: true } };
  assert.deepEqual(ids(getVisiblePosts(posts, { reading: "saved" }, reading)), ["quant", "paged"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { reading: "read" }, reading)), ["paged", "zero"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { reading: "saved", platform: "hn" }, reading)), ["paged"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { reading: "read", query: "另一种" }, reading)), ["zero"]);
  assert.deepEqual(getVisiblePosts(posts, { reading: "saved" }, null), []);
});

test("query uses case-insensitive whitespace-separated AND terms across fields", () => {
  const posts = makePosts();
  assert.deepEqual(ids(getVisiblePosts(posts, { query: " \n VLLM\t分页  " })), ["paged"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { query: "kv cache 进阶" })), [], "level is a separate filter");
  assert.deepEqual(ids(getVisiblePosts(posts, { query: "WOOSUK hacker  吞吐" })), ["paged"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { query: "张三 GPTQ 知乎" })), ["quant"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { query: "KV Attention" })), ["paged"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { query: "vllm 不存在" })), []);
  assert.equal(getVisiblePosts(posts, { query: "　\n\t " }).length, posts.length);
});

test("category, platform, level, query, reading and numeric heat intersect", () => {
  const posts = makePosts();
  const reading = { paged: { saved: true }, zero: { saved: true }, quant: { saved: true } };
  const filters = { query: "缓存 VLLM", category: "kv-attention", platform: "hn", level: "进阶", reading: "saved", numericHeat: true };
  assert.deepEqual(ids(getVisiblePosts(posts, filters, reading)), ["paged", "zero"]);
  assert.deepEqual(getVisiblePosts(posts, { ...filters, platform: "zhihu" }, reading), []);
  assert.deepEqual(getVisiblePosts(posts, { ...filters, level: "深入" }, reading), []);
  assert.deepEqual(getVisiblePosts(posts, { category: "KV-attention" }), [], "category match is exact");
});

test("numeric heat distinguishes known zero, unknown values and comment-only counts", () => {
  const posts = makePosts();
  assert.deepEqual(ids(getVisiblePosts(posts, { numericHeat: true })), ["paged", "comments", "zero"]);
  for (const value of [0, 1, 0.5]) {
    assert.equal(hasNumericHeat({ heat: { likes: value } }), true);
    assert.equal(hasNumericHeat({ heat: { comments: value } }), true);
  }
  for (const value of [null, undefined, -1, NaN, Infinity, -Infinity, "100", false]) {
    assert.equal(hasNumericHeat({ heat: { likes: value, comments: value } }), false);
  }
  for (const post of [null, {}, { heat: [] }, { heat: "100" }]) assert.equal(hasNumericHeat(post), false);
});

test("curated order honors finite ranks and keeps equal or missing ranks stable", () => {
  assert.deepEqual(ids(getVisiblePosts(makePosts(), {})), ["quant", "paged", "comments", "zero", "unknown"]);
  const posts = [{ id: "a" }, { id: "b", rank: 2 }, { id: "c", rank: 1 }, { id: "d", rank: 1 }, { id: "e", rank: NaN }, { id: "f", rank: "0" }];
  assert.deepEqual(ids(getVisiblePosts(posts)), ["c", "d", "b", "a", "e", "f"]);
  assert.deepEqual(ids(getVisiblePosts([{ id: "a" }, { id: "b" }, { id: "c" }])), ["a", "b", "c"]);
});

test("newest order puts empty or invalid dates last and preserves ties", () => {
  assert.deepEqual(ids(getVisiblePosts(makePosts(), { sort: "newest" })), ["zero", "comments", "quant", "paged", "unknown"]);
  const posts = [{ id: "a", publishedAt: "" }, { id: "b", publishedAt: "2026-10-16" }, { id: "c", publishedAt: "2026-10-16" }, { id: "d", publishedAt: "invalid" }];
  assert.deepEqual(ids(getVisiblePosts(posts, { sort: "newest" })), ["b", "c", "a", "d"]);
});

test("heat order is only available inside one platform and treats unknown likes as last", () => {
  const posts = makePosts();
  assert.deepEqual(ids(getVisiblePosts(posts, { platform: "hn", sort: "heat" })), ["paged", "zero", "comments", "unknown"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { platform: "all", sort: "heat" })), ["quant", "paged", "comments", "zero", "unknown"]);
  assert.deepEqual(ids(getVisiblePosts(posts, { sort: "heat" })), ["quant", "paged", "comments", "zero", "unknown"]);
  const ties = [
    { id: "bad", platform: "hn", heat: { likes: Infinity, comments: "100" } },
    { id: "a", platform: "hn", heat: { likes: 2, comments: 1 } },
    { id: "b", platform: "hn", heat: { likes: 2, comments: 10 } },
    { id: "c", platform: "hn", heat: { likes: 2, comments: null } },
    { id: "d", platform: "hn", heat: { likes: 2, comments: 0 } },
    { id: "e", platform: "hn", heat: { likes: 2, comments: 1 } },
  ];
  assert.deepEqual(ids(getVisiblePosts(ties, { platform: "hn", sort: "heat" })), ["b", "a", "e", "d", "c", "bad"]);
});

test("filtering and sorting return a fresh array without mutating posts, filters or storage", () => {
  const posts = makePosts();
  const snapshot = JSON.stringify(posts);
  for (const post of posts) { Object.freeze(post.tags); Object.freeze(post.heat); Object.freeze(post); }
  Object.freeze(posts);
  const filters = Object.freeze({ platform: "hn", sort: "heat", reading: "saved", query: "" });
  const reading = Object.freeze({ paged: Object.freeze({ saved: true }) });
  const visible = getVisiblePosts(posts, filters, reading);
  assert.deepEqual(ids(visible), ["paged"]);
  assert.equal(visible[0], posts[0]);
  assert.notEqual(visible, posts);
  assert.equal(JSON.stringify(posts), snapshot);
  assert.deepEqual(getVisiblePosts(null), []);
});

test("engine exports the same API through the browser global", () => {
  const source = fs.readFileSync(path.join(__dirname, "engine.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  assert.deepEqual(Object.keys(context.window.CommunityEngine).sort(), ["getVisiblePosts", "hasNumericHeat", "normalizeReading"]);
  assert.equal(context.window.CommunityEngine.hasNumericHeat({ heat: { likes: 0 } }), true);
  assert.equal(context.window.CommunityEngine.getVisiblePosts([{ id: "test" }], {}).length, 1);
});

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "posts.json"), "utf8"));
const categoryIds = ["foundations", "kv-attention", "serving", "quantization", "kernels-parallel", "speculative"];
const platformIds = ["zhihu", "hn", "github", "reddit", "v2ex", "huggingface"];
const levels = ["入门", "进阶", "深入"];

function assertNonemptyString(value, message) {
  assert.equal(typeof value, "string", message);
  assert.ok(value.trim().length > 0, message);
}

function assertCalendarDate(value, message) {
  assert.equal(typeof value, "string", message);
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, message);
  const date = new Date(value + "T00:00:00Z");
  assert.ok(Number.isFinite(date.getTime()), message);
  assert.equal(date.toISOString().slice(0, 10), value, message);
}

function assertHttps(value, message) {
  assertNonemptyString(value, message);
  const url = new URL(value);
  assert.equal(url.protocol, "https:", message);
  assert.ok(url.hostname, message);
  assert.ok(url.hostname !== "csdn.net" && !url.hostname.endsWith(".csdn.net"), message + " must exclude CSDN");
  assert.equal(url.username, "", message);
  assert.equal(url.password, "", message);
  return url;
}

test("published catalog covers six communities and six valid categories with unique identities", () => {
  assert.ok(Array.isArray(catalog.posts) && catalog.posts.length > 0);
  assertNonemptyString(catalog.meta.title, "catalog title");
  assertNonemptyString(catalog.meta.selection, "selection policy");
  assert.ok(Number.isSafeInteger(catalog.meta.version) && catalog.meta.version > 0);
  assertCalendarDate(catalog.meta.checkedAt, "catalog checkedAt");
  assert.deepEqual(catalog.categories.map(category => category.id).sort(), [...categoryIds].sort());
  assert.deepEqual([...new Set(catalog.posts.map(post => post.platform))].sort(), [...platformIds].sort());
  assert.deepEqual([...new Set(catalog.posts.map(post => post.category))].sort(), [...categoryIds].sort());
  for (const field of ["id", "url", "rank"]) {
    assert.equal(new Set(catalog.posts.map(post => post[field])).size, catalog.posts.length, field + " must be unique");
  }
  for (const category of catalog.categories) {
    assertNonemptyString(category.title, category.id + " title");
    assertNonemptyString(category.description, category.id + " description");
  }
});

test("every published post has its required schema, source links and valid publication dates", () => {
  for (const post of catalog.posts) {
    for (const field of ["id", "title", "platform", "platformLabel", "author", "category", "categoryTitle", "summary", "whyRead", "evidenceNote"]) {
      assertNonemptyString(post[field], post.id + " " + field);
    }
    assert.ok(categoryIds.includes(post.category), post.id + " category");
    assert.equal(post.categoryTitle, catalog.categories.find(category => category.id === post.category).title, post.id + " category label");
    assert.ok(platformIds.includes(post.platform), post.id + " platform");
    assert.ok(levels.includes(post.level), post.id + " level");
    assert.ok(["public", "login"].includes(post.access), post.id + " access");
    assert.ok(Number.isSafeInteger(post.minutes) && post.minutes > 0, post.id + " reading time");
    assert.ok(Number.isSafeInteger(post.rank) && post.rank > 0, post.id + " rank");
    assert.ok(Array.isArray(post.tags) && post.tags.length > 0, post.id + " tags");
    for (const tag of post.tags) assertNonemptyString(tag, post.id + " tag");
    assert.ok(Array.isArray(post.qualitySignals) && post.qualitySignals.length >= 2, post.id + " quality evidence");
    for (const signal of post.qualitySignals) assertNonemptyString(signal, post.id + " quality signal");
    assert.equal(typeof post.publishedAt, "string", post.id + " publication date or explicit unknown");
    for (const field of ["publishedAt", "updatedAt"]) {
      if (post[field]) {
        assertCalendarDate(post[field], post.id + " " + field);
        assert.ok(post[field] <= catalog.meta.checkedAt, post.id + " " + field + " must not be after verification");
      }
    }
    assertHttps(post.url, post.id + " original post");
    if (post.relatedUrl !== undefined) {
      assert.equal(typeof post.relatedUrl, "string", post.id + " related link or explicit unknown");
      if (post.relatedUrl) {
        const related = assertHttps(post.relatedUrl, post.id + " related link");
        assert.doesNotMatch(related.pathname, /\.(?:gguf|ggml|safetensors|ckpt|bin|pt|pth|onnx|h5)(?:\/|$)/i, post.id + " related link must not download model weights");
        if (["huggingface.co", "hf.co"].includes(related.hostname)) {
          assert.ok(!related.pathname.includes("/resolve/"), post.id + " must link to technical content rather than a direct model download");
        }
      }
    }
  }
});

test("heat snapshots use nonnegative integer counts or explicit null with dated HTTPS evidence", () => {
  let knownLikes = 0;
  let unknownLikes = 0;
  for (const post of catalog.posts) {
    assert.ok(post.heat && typeof post.heat === "object" && !Array.isArray(post.heat), post.id + " heat");
    for (const field of ["likes", "comments"]) {
      assert.ok(Object.hasOwn(post.heat, field), post.id + " explicit " + field);
      const count = post.heat[field];
      assert.ok(count === null || (Number.isSafeInteger(count) && count >= 0), post.id + " " + field + " must be a count or null, never an inferred zero");
    }
    if (Object.hasOwn(post.heat, "collections")) {
      assert.ok(post.heat.collections === null || (Number.isSafeInteger(post.heat.collections) && post.heat.collections >= 0), post.id + " collections");
    }
    if (post.heat.likes === null) unknownLikes += 1;
    else knownLikes += 1;
    assertNonemptyString(post.heat.label, post.id + " heat label");
    assertNonemptyString(post.heat.basis, post.id + " count source");
    assertCalendarDate(post.heat.verifiedAt, post.id + " count verification date");
    assert.ok(post.heat.verifiedAt <= catalog.meta.checkedAt, post.id + " count date must not exceed catalog date");
    assertHttps(post.heat.evidenceUrl, post.id + " count evidence");
    assert.equal(hasNumericHeat(post), post.heat.likes !== null || post.heat.comments !== null, post.id + " numeric heat classification");
  }
  assert.ok(knownLikes > 0 && unknownLikes > 0, "catalog preserves the distinction between observed likes and unknown likes");
  const numeric = getVisiblePosts(catalog.posts, { numericHeat: true });
  const expected = catalog.posts.filter(post => post.heat.likes !== null || post.heat.comments !== null);
  assert.deepEqual([...ids(numeric)].sort(), [...ids(expected)].sort());
});

test("all six Zhihu posts use original-post counts including collections", () => {
  const posts = catalog.posts.filter(post => post.platform === "zhihu");
  assert.equal(posts.length, 6);
  for (const post of posts) {
    const original = new URL(post.url);
    assert.equal(original.hostname, "zhuanlan.zhihu.com", post.id + " original domain");
    assert.match(original.pathname, /^\/p\/\d+\/?$/, post.id + " article URL");
    for (const field of ["likes", "comments", "collections"]) {
      assert.ok(Number.isSafeInteger(post.heat[field]) && post.heat[field] >= 0, post.id + " original-post " + field);
    }
    assert.match(post.heat.basis, /知乎原帖/, post.id + " original-post count attribution");
    assert.doesNotMatch(post.heat.basis, /搜索|索引|未核验/, post.id + " must use directly verified counts");
    assert.equal(post.heat.evidenceUrl, post.url, post.id + " evidence points to the original article");
    assertCalendarDate(post.updatedAt, post.id + " observed article edit date");
  }
});

test("featured reading routes resolve to existing posts with their own guidance", () => {
  assert.ok(Array.isArray(catalog.featured) && catalog.featured.length > 0);
  assert.equal(new Set(catalog.featured.map(feature => feature.postId)).size, catalog.featured.length);
  const postIds = new Set(catalog.posts.map(post => post.id));
  for (const feature of catalog.featured) {
    assert.ok(postIds.has(feature.postId), feature.postId + " featured post must exist");
    assertNonemptyString(feature.title, feature.postId + " route title");
    assertNonemptyString(feature.reason, feature.postId + " route reason");
  }
});

test("real catalog filters partition every post without omissions and never mix community heat", () => {
  const posts = catalog.posts;
  assert.deepEqual([...ids(getVisiblePosts(posts, {}))].sort(), [...ids(posts)].sort());
  const partition = [];
  for (const category of categoryIds) {
    for (const platform of platformIds) {
      for (const level of levels) {
        const visible = getVisiblePosts(posts, { category, platform, level });
        assert.ok(visible.every(post => post.category === category && post.platform === platform && post.level === level));
        partition.push(...ids(visible));
      }
    }
  }
  assert.deepEqual(partition.sort(), [...ids(posts)].sort(), "every post belongs to exactly one category/platform/level intersection");
  for (const platform of platformIds) {
    const sorted = getVisiblePosts(posts, { platform, sort: "heat" });
    assert.ok(sorted.every(post => post.platform === platform));
    assert.equal(sorted.length, posts.filter(post => post.platform === platform).length);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1].heat;
      const current = sorted[index].heat;
      if (previous.likes === null) assert.equal(current.likes, null, platform + " unknown likes belong last");
      if (previous.likes !== null && current.likes !== null) assert.ok(previous.likes >= current.likes, platform + " likes descend");
      if (previous.likes === current.likes) {
        if (previous.comments === null) assert.equal(current.comments, null, platform + " unknown comments belong last on tied likes");
        if (previous.comments !== null && current.comments !== null) assert.ok(previous.comments >= current.comments, platform + " tied likes use descending comments");
      }
    }
  }
  assert.deepEqual(ids(getVisiblePosts(posts, { platform: "all", sort: "heat" })), ids(getVisiblePosts(posts, { sort: "curated" })), "cross-community heat always uses editorial order");
});
