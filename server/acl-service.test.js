import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AclService } from "./acl-service.js";
import { createAclStore } from "./acl-store.js";

function createSampleState() {
  const now = Date.now();
  return {
    folders: [
      { id: "f1", name: "Team", parentId: null, createdAt: now, updatedAt: now },
      { id: "f2", name: "Engineering", parentId: "f1", createdAt: now, updatedAt: now },
      { id: "f3", name: "Private", parentId: null, createdAt: now, updatedAt: now },
    ],
    notes: [
      {
        id: "n1",
        title: "Roadmap",
        folderId: "f2",
        content: "team-shared",
        fileName: "Team/Engineering/Roadmap.md",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: "n2",
        title: "Ops",
        folderId: "f3",
        content: "private-note",
        fileName: "Private/Ops.md",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
    ui: { expandedFolderIds: ["f1", "f2", "f3"] },
  };
}

async function createHarness() {
  const storageRootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tui-notes-acl-test-"));
  const store = await createAclStore({ storageRootDir });
  const service = new AclService({
    store,
    authModeProvider: () => "enforce",
    logger: { warn() {} },
  });
  return {
    storageRootDir,
    store,
    service,
    async dispose() {
      await store.close?.();
      await fs.rm(storageRootDir, { recursive: true, force: true });
    },
  };
}

function user(email, userId = "") {
  return {
    id: email || userId || "anonymous",
    userId,
    email,
    groups: [],
    isAuthenticated: Boolean(email || userId),
    displayName: email || userId || "anonymous",
  };
}

test("bootstrap owner gets inherited owner access for full workspace", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const alice = user("alice@example.com");
    const bootstrapped = await harness.service.ensureBootstrapOwner(alice);
    assert.equal(bootstrapped, true);

    const snapshot = await harness.service.createSnapshot();
    const actions = ["read", "write", "manage"];
    for (const action of actions) {
      const decision = harness.service.evaluate(snapshot, alice, {
        action,
        resourceType: "note",
        resourceExternalId: "n2",
        mode: "enforce",
      });
      assert.equal(decision.allowed, true, `owner should allow ${action}`);
    }
  } finally {
    await harness.dispose();
  }
});

test("viewer on folder sees only granted subtree", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const alice = user("alice@example.com");
    await harness.service.ensureBootstrapOwner(alice);

    await harness.service.grantBinding({
      actorUser: alice,
      bindingInput: {
        resourceType: "folder",
        resourceExternalId: "f1",
        subjectType: "user",
        subjectId: "bob@example.com",
        role: "viewer",
        inherit: true,
      },
      mode: "enforce",
    });

    const filtered = await harness.service.filterStateForUser(state, user("bob@example.com"), {
      mode: "enforce",
    });

    assert.deepEqual(
      filtered.folders.map((folder) => folder.id).sort(),
      ["f1", "f2"],
    );
    assert.deepEqual(filtered.notes.map((note) => note.id), ["n1"]);
  } finally {
    await harness.dispose();
  }
});

test("viewer cannot write within granted subtree", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const alice = user("alice@example.com");
    await harness.service.ensureBootstrapOwner(alice);
    await harness.service.grantBinding({
      actorUser: alice,
      bindingInput: {
        resourceType: "folder",
        resourceExternalId: "f1",
        subjectType: "user",
        subjectId: "bob@example.com",
        role: "viewer",
        inherit: true,
      },
      mode: "enforce",
    });

    const bob = user("bob@example.com");
    const visibleState = await harness.service.filterStateForUser(state, bob, {
      mode: "enforce",
    });
    visibleState.notes[0].content = "try-write";
    visibleState.notes[0].updatedAt = Date.now();

    await assert.rejects(
      () =>
        harness.service.mergeScopedStateForWrite({
          currentFullState: state,
          incomingScopedState: visibleState,
          user: bob,
          mode: "enforce",
        }),
      (error) => Number(error?.status) === 403,
    );
  } finally {
    await harness.dispose();
  }
});

test("editor write merges visible changes without clobbering hidden notes", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const alice = user("alice@example.com");
    await harness.service.ensureBootstrapOwner(alice);
    await harness.service.grantBinding({
      actorUser: alice,
      bindingInput: {
        resourceType: "folder",
        resourceExternalId: "f1",
        subjectType: "user",
        subjectId: "bob@example.com",
        role: "editor",
        inherit: true,
      },
      mode: "enforce",
    });

    const bob = user("bob@example.com");
    const visibleState = await harness.service.filterStateForUser(state, bob, {
      mode: "enforce",
    });
    visibleState.notes[0].content = "edited-by-bob";
    visibleState.notes[0].updatedAt = Date.now();

    const merged = await harness.service.mergeScopedStateForWrite({
      currentFullState: state,
      incomingScopedState: visibleState,
      user: bob,
      mode: "enforce",
    });

    const note1 = merged.notes.find((note) => note.id === "n1");
    const note2 = merged.notes.find((note) => note.id === "n2");
    assert.equal(note1?.content, "edited-by-bob");
    assert.equal(note2?.content, "private-note");
  } finally {
    await harness.dispose();
  }
});

test("editor cannot manage ACL bindings", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const alice = user("alice@example.com");
    await harness.service.ensureBootstrapOwner(alice);
    await harness.service.grantBinding({
      actorUser: alice,
      bindingInput: {
        resourceType: "folder",
        resourceExternalId: "f1",
        subjectType: "user",
        subjectId: "bob@example.com",
        role: "editor",
        inherit: true,
      },
      mode: "enforce",
    });

    await assert.rejects(
      () =>
        harness.service.grantBinding({
          actorUser: user("bob@example.com"),
          bindingInput: {
            resourceType: "folder",
            resourceExternalId: "f1",
            subjectType: "user",
            subjectId: "charlie@example.com",
            role: "viewer",
            inherit: true,
          },
          mode: "enforce",
        }),
      (error) => Number(error?.status) === 403,
    );
  } finally {
    await harness.dispose();
  }
});

test("authenticated user gets personal Home folder with owner access", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const bob = user("bob@example.com");
    const ensured = await harness.service.ensureUserHomeFolder(state, bob, { mode: "enforce" });
    assert.equal(Boolean(ensured.homeFolderId), true);
    assert.equal(ensured.changed, true);

    const homeFolder = ensured.state.folders.find((folder) => folder.id === ensured.homeFolderId);
    assert.ok(homeFolder);
    assert.equal(homeFolder.name, "bob");
    assert.equal(homeFolder.parentId, null);

    const filtered = await harness.service.filterStateForUser(ensured.state, bob, {
      mode: "enforce",
    });
    assert.equal(filtered.folders.some((folder) => folder.id === ensured.homeFolderId), true);

    const capabilities = await harness.service.getCapabilitiesForResource(bob, {
      resourceType: "folder",
      resourceExternalId: ensured.homeFolderId,
      mode: "enforce",
    });
    assert.equal(capabilities.canRead, true);
    assert.equal(capabilities.canWrite, true);
    assert.equal(capabilities.canManage, true);
  } finally {
    await harness.dispose();
  }
});

test("home folder remains stable across identity header variants", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const bobWithEmail = user("bob@example.com", "bob");
    const ensuredFirst = await harness.service.ensureUserHomeFolder(state, bobWithEmail, { mode: "enforce" });
    assert.equal(Boolean(ensuredFirst.homeFolderId), true);

    const bobUserOnly = user("", "bob");
    const ensuredSecond = await harness.service.ensureUserHomeFolder(ensuredFirst.state, bobUserOnly, { mode: "enforce" });

    assert.equal(ensuredSecond.homeFolderId, ensuredFirst.homeFolderId);
    assert.equal(ensuredSecond.state.folders.filter((folder) => folder.name === "bob").length >= 1, true);

    const filtered = await harness.service.filterStateForUser(ensuredSecond.state, bobUserOnly, {
      mode: "enforce",
    });
    assert.equal(filtered.folders.some((folder) => folder.id === ensuredSecond.homeFolderId), true);
  } finally {
    await harness.dispose();
  }
});

test("owner cannot revoke own owner binding", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const alice = user("alice@example.com");
    await harness.service.ensureBootstrapOwner(alice);

    const bindings = await harness.store.listBindings();
    const aliceOwnerBinding = bindings.find(
      (binding) =>
        binding.resourceType === "workspace" &&
        binding.resourceExternalId === "main" &&
        binding.subjectType === "user" &&
        binding.subjectId === "alice@example.com" &&
        binding.role === "owner",
    );
    assert.ok(aliceOwnerBinding?.id, "expected bootstrap owner binding for alice");

    await assert.rejects(
      () =>
        harness.service.revokeBinding({
          actorUser: alice,
          bindingId: aliceOwnerBinding.id,
          mode: "enforce",
        }),
      (error) =>
        Number(error?.status) === 400 &&
        String(error?.message || "").includes("cannot revoke own owner"),
    );

    const bobViewer = await harness.service.grantBinding({
      actorUser: alice,
      bindingInput: {
        resourceType: "folder",
        resourceExternalId: "f1",
        subjectType: "user",
        subjectId: "bob@example.com",
        role: "viewer",
        inherit: true,
      },
      mode: "enforce",
    });

    const deleted = await harness.service.revokeBinding({
      actorUser: alice,
      bindingId: bobViewer.id,
      mode: "enforce",
    });
    assert.equal(deleted, true);
  } finally {
    await harness.dispose();
  }
});

test("stale unchanged note payload does not clobber newer note content", async () => {
  const harness = await createHarness();
  try {
    const state = createSampleState();
    await harness.service.syncResourcesFromState(state);

    const alice = user("alice@example.com");
    await harness.service.ensureBootstrapOwner(alice);
    await harness.service.grantBinding({
      actorUser: alice,
      bindingInput: {
        resourceType: "folder",
        resourceExternalId: "f1",
        subjectType: "user",
        subjectId: "bob@example.com",
        role: "editor",
        inherit: true,
      },
      mode: "enforce",
    });

    const bob = user("bob@example.com");
    const visibleBaseline = await harness.service.filterStateForUser(state, bob, {
      mode: "enforce",
    });

    // Simulate server moving ahead (alice edited n1 after bob took baseline).
    const currentFullState = {
      ...state,
      notes: state.notes.map((note) =>
        note.id === "n1"
          ? {
            ...note,
            content: "alice-newer-content",
            updatedAt: note.updatedAt + 10_000,
          }
          : { ...note }),
    };

    // Bob submits a stale snapshot where n1 is unchanged vs his baseline.
    // Only UI expansion changes in his payload.
    const incomingScopedState = {
      ...visibleBaseline,
      ui: {
        expandedFolderIds: ["f1"],
      },
    };

    const merged = await harness.service.mergeScopedStateForWrite({
      currentFullState,
      incomingScopedState,
      user: bob,
      mode: "enforce",
    });

    const note = merged.notes.find((item) => item.id === "n1");
    assert.equal(note?.content, "alice-newer-content");
  } finally {
    await harness.dispose();
  }
});
