// Entry program for make.fun bounty "makefun-x-reposts-02"
// ("Get the most reposts and likes on make.fun's newest X posts").
//
// The entry itself is a set of posts on X, listed in POSTS.json next to this
// file. This program is the repository's deliverable: it reads POSTS.json,
// validates the list against the bounty's rules (at most 15 posts, every
// address a well-formed X status URL, no duplicates, all from one account
// that is not @makefunai), prints a summary of the entry, and writes the
// validated POSTS.json to the output directory for the grader.
//
// Node 22, standard library only, no network access.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MAX_POSTS = 15;
const HOUSE_HANDLE = "makefunai";

// A post address as X's Share -> Copy link gives it:
//   https://x.com/<handle>/status/<digits>
// (the same on twitter.com is accepted too).
const STATUS_URL = /^https:\/\/(x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/;

interface PostRef {
  url: string;
  handle: string;
  statusId: string;
}

function fail(message: string): never {
  console.error(`POSTS.json is not a valid entry: ${message}`);
  process.exit(1);
}

function parsePosts(data: unknown): PostRef[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    fail('expected an object of the form {"posts": [...]}');
  }
  const posts = (data as { posts?: unknown }).posts;
  if (!Array.isArray(posts)) {
    fail('the "posts" field is missing or is not an array');
  }
  if (posts.length > MAX_POSTS) {
    fail(`the list names ${posts.length} posts; at most ${MAX_POSTS} are allowed`);
  }
  const refs: PostRef[] = [];
  const seenUrls = new Set<string>();
  const handleByStatusId = new Map<string, string>();
  for (const item of posts) {
    if (typeof item !== "string") {
      fail(`every post address must be a string, got ${JSON.stringify(item)}`);
    }
    const match = STATUS_URL.exec(item.trim());
    if (!match) {
      fail(`"${item}" is not an X status address (https://x.com/<handle>/status/<id>)`);
    }
    const [, , handle, statusId] = match;
    const url = `https://x.com/${handle}/status/${statusId}`;
    if (seenUrls.has(url)) {
      fail(`duplicate post address: ${url}`);
    }
    seenUrls.add(url);
    // A status id names exactly one post by exactly one account; the same id
    // under another handle is a mis-copied address, not a second post.
    const knownHandle = handleByStatusId.get(statusId);
    if (knownHandle !== undefined && knownHandle.toLowerCase() !== handle.toLowerCase()) {
      fail(`status ${statusId} is listed under both @${knownHandle} and @${handle}`);
    }
    handleByStatusId.set(statusId, handle);
    refs.push({ url, handle, statusId });
  }
  return refs;
}

function checkOneAccount(refs: PostRef[]): string {
  if (refs.length === 0) return "(no posts yet)";
  const account = refs[0].handle.toLowerCase();
  if (account === HOUSE_HANDLE) {
    fail("the posts must be your own, not @makefunai's");
  }
  for (const ref of refs) {
    if (ref.handle.toLowerCase() !== account) {
      fail(`all posts must come from one X account; found @${refs[0].handle} and @${ref.handle}`);
    }
  }
  return `@${refs[0].handle}`;
}

function main(): void {
  const botDir = process.env.MAKEFUN_BOT_DIR ?? ".";
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const sourcePath = join(botDir, "POSTS.json");

  let raw: string;
  try {
    raw = readFileSync(sourcePath, "utf8");
  } catch {
    fail(`cannot read ${sourcePath}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    fail(`${sourcePath} is not valid JSON`);
  }

  const refs = parsePosts(data);
  const account = checkOneAccount(refs);

  console.log("make.fun bounty makefun-x-reposts-02 — entry summary");
  console.log(`  X account : ${account}`);
  console.log(`  Posts     : ${refs.length} of at most ${MAX_POSTS}`);
  for (const ref of refs) {
    console.log(`    - ${ref.url} (status ${ref.statusId})`);
  }

  // Hand the validated list to the grader, byte for byte as committed.
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "POSTS.json"), raw);
  console.log(`  Wrote ${join(outDir, "POSTS.json")}`);
}

main();
