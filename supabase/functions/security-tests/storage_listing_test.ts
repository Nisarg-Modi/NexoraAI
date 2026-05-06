// Security tests: verify that unauthenticated (anon) clients cannot enumerate
// files in public-facing storage buckets (avatars, stream-media, moments) via
// the storage.objects listing API. Direct public URL reads of known paths
// remain allowed for `avatars` and `stream-media` (those are public buckets);
// only enumeration is blocked.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = "https://jtlnhmpxytlgljnuspan.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0bG5obXB4eXRsZ2xqbnVzcGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0Mzk0MTYsImV4cCI6MjA3NTAxNTQxNn0.ofWfleYaOZCTvLxlG8Q1Uxg-lk_vZ8R4MdSwpK5wxuM";

const anon = () =>
  createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function expectEmptyList(bucket: string) {
  const { data, error } = await anon().storage.from(bucket).list("", {
    limit: 1000,
  });
  // Either an explicit error, or an empty list — both indicate enumeration is blocked.
  if (error) {
    assert(error, `expected error or empty list for bucket ${bucket}`);
    return;
  }
  assertEquals(
    data?.length ?? 0,
    0,
    `Anon must not enumerate files in bucket "${bucket}", got ${data?.length} entries`,
  );
}

Deno.test("anon cannot enumerate files in 'avatars' bucket", async () => {
  await expectEmptyList("avatars");
});

Deno.test("anon cannot enumerate files in 'stream-media' bucket", async () => {
  await expectEmptyList("stream-media");
});

Deno.test("anon cannot enumerate files in 'moments' bucket", async () => {
  await expectEmptyList("moments");
});

Deno.test("anon cannot enumerate files inside a guessed user folder (avatars)", async () => {
  const { data, error } = await anon().storage.from("avatars").list(
    "00000000-0000-0000-0000-000000000000",
    { limit: 1000 },
  );
  if (!error) {
    assertEquals(data?.length ?? 0, 0);
  }
});

Deno.test("anon cannot enumerate files inside a guessed user folder (moments)", async () => {
  const { data, error } = await anon().storage.from("moments").list(
    "00000000-0000-0000-0000-000000000000",
    { limit: 1000 },
  );
  if (!error) {
    assertEquals(data?.length ?? 0, 0);
  }
});
