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
