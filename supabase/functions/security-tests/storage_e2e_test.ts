// End-to-end storage access checks:
//  1. Direct public URL reads still work for `avatars` and `stream-media`
//     (public buckets bypass RLS for object fetches).
//  2. The listing API, when called as an authenticated user, only returns
//     files owned by that user (its own user_id folder), and never enumerates
//     other users' folders.
//  3. The listing API as an anon user returns nothing.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ??
  "https://jtlnhmpxytlgljnuspan.supabase.co";
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0bG5obXB4eXRsZ2xqbnVzcGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0Mzk0MTYsImV4cCI6MjA3NTAxNTQxNn0.ofWfleYaOZCTvLxlG8Q1Uxg-lk_vZ8R4MdSwpK5wxuM";

// Known existing public avatar file (used to verify direct public URL reads).
const KNOWN_AVATAR_PATH =
  "2d1af903-056e-49fa-84b6-e7137bf04691/1770371243873.jpeg";
const KNOWN_AVATAR_OWNER = "2d1af903-056e-49fa-84b6-e7137bf04691";

const anon = () =>
  createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

Deno.test("public avatar URL is fetchable without auth", async () => {
  const url =
    `${SUPABASE_URL}/storage/v1/object/public/avatars/${KNOWN_AVATAR_PATH}`;
  const res = await fetch(url);
  await res.arrayBuffer(); // consume body
  assertEquals(res.status, 200, `expected 200 from public avatar URL`);
  const ctype = res.headers.get("content-type") ?? "";
  assert(
    ctype.startsWith("image/"),
    `expected image content-type, got ${ctype}`,
  );
});

Deno.test("getPublicUrl + fetch resolves for known avatar", async () => {
  const { data } = anon().storage.from("avatars").getPublicUrl(
    KNOWN_AVATAR_PATH,
  );
  const res = await fetch(data.publicUrl);
  await res.arrayBuffer();
  assertEquals(res.status, 200);
});

Deno.test("anon listing does not leak any avatar files", async () => {
  const { data, error } = await anon().storage.from("avatars").list("", {
    limit: 1000,
  });
  if (!error) {
    assertEquals(data?.length ?? 0, 0, "anon must not enumerate root");
  }
  const { data: subData, error: subError } = await anon().storage.from(
    "avatars",
  ).list(KNOWN_AVATAR_OWNER, { limit: 1000 });
  if (!subError) {
    assertEquals(
      subData?.length ?? 0,
      0,
      "anon must not enumerate another user's folder",
    );
  }
});

Deno.test(
  "authenticated user can only list their own folder, not others'",
  async () => {
    // Sign up an ephemeral user.
    const client = anon();
    const email = `test-${crypto.randomUUID()}@nexora-tests.local`;
    const password = `Pw_${crypto.randomUUID()}!Aa1`;

    const { data: signUp, error: signUpError } = await client.auth.signUp({
      email,
      password,
    });

    // If email confirmation is on, signUp returns a user but no session — we
    // need a session to test as an authenticated user. Try to sign in directly.
    if (signUpError || !signUp.session) {
      const { data: signIn, error: signInError } = await client.auth
        .signInWithPassword({ email, password });
      if (signInError || !signIn.session) {
        console.warn(
          "Skipping authenticated listing test (cannot establish session):",
          signUpError?.message ?? signInError?.message,
        );
        return;
      }
    }

    const { data: userData } = await client.auth.getUser();
    const myUserId = userData.user?.id;
    assert(myUserId, "expected an authenticated user id");

    // Listing root: must NOT return another user's files. Either empty or only
    // entries inside the caller's own folder.
    for (const bucket of ["avatars", "stream-media", "moments"]) {
      const { data, error } = await client.storage.from(bucket).list("", {
        limit: 1000,
      });
      if (error) continue;
      for (const entry of data ?? []) {
        // entries at root are folders/files; for our owner-scoped policies,
        // any entry at root must be the caller's own user-id folder.
        assertEquals(
          entry.name,
          myUserId,
          `bucket '${bucket}' leaked entry '${entry.name}' to user ${myUserId}`,
        );
      }
    }

    // Listing another user's folder must return empty.
    const { data: otherFolder, error: otherErr } = await client.storage.from(
      "avatars",
    ).list(KNOWN_AVATAR_OWNER, { limit: 1000 });
    if (!otherErr) {
      assertEquals(
        otherFolder?.length ?? 0,
        0,
        "authenticated user must not enumerate another user's folder",
      );
    }

    // Public URL still fetchable for that known avatar even while listing is denied.
    const url =
      `${SUPABASE_URL}/storage/v1/object/public/avatars/${KNOWN_AVATAR_PATH}`;
    const res = await fetch(url);
    await res.arrayBuffer();
    assertEquals(
      res.status,
      200,
      "authenticated user should still resolve direct public URL",
    );

    await client.auth.signOut();
  },
);
