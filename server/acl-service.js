import crypto from "node:crypto";
import { createBindingInput } from "./acl-store.js";

const WORKSPACE_TYPE = "workspace";
const WORKSPACE_ID = "main";

const ROLE_LEVEL = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

const ACTION_LEVEL = {
  read: ROLE_LEVEL.viewer,
  write: ROLE_LEVEL.editor,
  manage: ROLE_LEVEL.owner,
};

const HOME_FOLDER_NAME = "Home";
const HOME_FOLDER_ID_PREFIX = "home-";

function nowMs() {
  return Date.now();
}

function normalizeStatePayload(rawState) {
  const state = rawState && typeof rawState === "object" ? rawState : {};
  const folders = Array.isArray(state.folders)
    ? state.folders
      .filter((folder) => folder && folder.id != null)
      .map((folder) => ({
        id: String(folder.id),
        name: String(folder.name || "Untitled Folder"),
        parentId: folder.parentId == null ? null : String(folder.parentId),
        createdAt: Number(folder.createdAt) || nowMs(),
        updatedAt: Number(folder.updatedAt) || Number(folder.createdAt) || nowMs(),
      }))
    : [];

  const folderIds = new Set(folders.map((folder) => folder.id));

  const notes = Array.isArray(state.notes)
    ? state.notes
      .filter((note) => note && note.id != null)
      .map((note) => {
        const folderId = note.folderId == null ? null : String(note.folderId);
        return {
          id: String(note.id),
          title: String(note.title || "Untitled"),
          folderId: folderId && folderIds.has(folderId) ? folderId : null,
          content: typeof note.content === "string" ? note.content : "",
          fileName: typeof note.fileName === "string" ? note.fileName : `${String(note.id)}.md`,
          shareId: typeof note.shareId === "string" ? note.shareId.trim() || null : null,
          createdAt: Number(note.createdAt) || nowMs(),
          updatedAt: Number(note.updatedAt) || Number(note.createdAt) || nowMs(),
          deletedAt: note.deletedAt ? Number(note.deletedAt) || null : null,
        };
      })
    : [];

  const expandedFolderIds = Array.isArray(state?.ui?.expandedFolderIds)
    ? [...new Set(state.ui.expandedFolderIds.map((id) => String(id)).filter((id) => folderIds.has(id)))]
    : [];

  return {
    folders,
    notes,
    ui: { expandedFolderIds },
  };
}

function resourceKey(type, externalId) {
  return `${String(type)}:${String(externalId)}`;
}

function parseOwnerSubject(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return null;
  }
  const [subjectType, ...rest] = value.split(":");
  if (!subjectType || !rest.length) {
    return null;
  }
  const subjectId = rest.join(":").trim();
  if (!subjectId) {
    return null;
  }
  return { subjectType, subjectId };
}

function toOwnerSubject(subjectType, subjectId) {
  return `${subjectType}:${subjectId}`;
}

function listUserSubjectCandidates(user) {
  const candidates = [];
  const seen = new Set();

  const userId = String(user?.userId || "").trim();
  const email = String(user?.email || "").trim().toLowerCase();
  const preferredUsername = String(user?.preferredUsername || "").trim();
  const id = String(user?.id || "").trim();

  const push = (subjectId) => {
    const normalized = String(subjectId || "").trim();
    if (!normalized || seen.has(normalized) || normalized === "anonymous") {
      return;
    }
    seen.add(normalized);
    candidates.push({
      subjectType: "user",
      subjectId: normalized,
    });
  };

  push(email);
  push(preferredUsername);
  push(userId);
  push(id);

  return candidates;
}

function buildHomeFolderIdForSubject(subjectType, subjectId) {
  const seed = `${String(subjectType)}:${String(subjectId)}`;
  const digest = crypto
    .createHash("sha256")
    .update(seed)
    .digest("hex");
  return `${HOME_FOLDER_ID_PREFIX}${digest.slice(0, 32)}`;
}

function listHomeFolderIdsForUser(user) {
  const ids = [];
  const seen = new Set();
  for (const subject of listUserSubjectCandidates(user)) {
    const folderId = buildHomeFolderIdForSubject(subject.subjectType, subject.subjectId);
    if (seen.has(folderId)) {
      continue;
    }
    seen.add(folderId);
    ids.push(folderId);
  }
  return ids;
}

function toHomeFolderName(user) {
  const looksMachineId = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return false;
    }
    return (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized) ||
      /^[0-9a-f]{24,}$/i.test(normalized)
    );
  };

  const preferredUsername = String(user?.preferredUsername || "").trim();
  const email = String(user?.email || "").trim().toLowerCase();
  const displayName = String(user?.displayName || "").trim();
  const userId = String(user?.userId || "").trim();

  const selectSource =
    preferredUsername ||
    (email.includes("@") ? email.split("@")[0].trim() : email) ||
    (!looksMachineId(displayName) ? displayName : "") ||
    (!looksMachineId(userId) ? userId : "");

  if (!selectSource) {
    return HOME_FOLDER_NAME;
  }

  const normalized = String(selectSource).split("@")[0].trim();
  return normalized || HOME_FOLDER_NAME;
}

function getUserSubjectIds(user) {
  const ids = new Set();

  for (const candidate of listUserSubjectCandidates(user)) {
    ids.add(candidate.subjectId);
    ids.add(`user:${candidate.subjectId}`);
    if (candidate.subjectId.includes("@")) {
      ids.add(`email:${candidate.subjectId}`);
    }
  }

  return ids;
}

function getGroupSubjectIds(user) {
  const groups = Array.isArray(user?.groups) ? user.groups : [];
  const ids = new Set();
  for (const group of groups) {
    const value = String(group || "").trim();
    if (!value) {
      continue;
    }
    ids.add(value);
    ids.add(`group:${value}`);
  }
  return ids;
}

function matchesActorSubject(binding, actorUser) {
  if (!binding || !actorUser) {
    return false;
  }

  if (binding.subjectType === "public") {
    return binding.subjectId === "*";
  }

  if (binding.subjectType === "user") {
    return getUserSubjectIds(actorUser).has(String(binding.subjectId || "").trim());
  }

  if (binding.subjectType === "group") {
    return getGroupSubjectIds(actorUser).has(String(binding.subjectId || "").trim());
  }

  return false;
}

function cloneState(state) {
  return {
    folders: state.folders.map((folder) => ({ ...folder })),
    notes: state.notes.map((note) => ({ ...note })),
    ui: {
      expandedFolderIds: Array.isArray(state?.ui?.expandedFolderIds)
        ? [...state.ui.expandedFolderIds]
        : [],
    },
  };
}

function buildFolderChildrenMap(folders) {
  const children = new Map();
  for (const folder of folders) {
    const key = folder.parentId || "__root__";
    if (!children.has(key)) {
      children.set(key, []);
    }
    children.get(key).push(folder.id);
  }
  return children;
}

function collectDescendantFolderIds(folderId, childrenMap) {
  const visited = new Set();
  const stack = [String(folderId)];

  while (stack.length) {
    const current = stack.pop();
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const children = childrenMap.get(current) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        stack.push(childId);
      }
    }
  }

  return visited;
}

export class AclService {
  constructor({ store, authModeProvider, logger = console }) {
    this.store = store;
    this.authModeProvider = authModeProvider;
    this.logger = logger;
  }

  getAuthMode() {
    return typeof this.authModeProvider === "function" ? this.authModeProvider() : "off";
  }

  async syncResourcesFromState(rawState) {
    const state = normalizeStatePayload(rawState);
    const now = nowMs();

    const resources = [
      {
        type: WORKSPACE_TYPE,
        externalId: WORKSPACE_ID,
        parentType: null,
        parentExternalId: null,
        ownerSubject: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const folder of state.folders) {
      resources.push({
        type: "folder",
        externalId: folder.id,
        parentType: folder.parentId ? "folder" : WORKSPACE_TYPE,
        parentExternalId: folder.parentId || WORKSPACE_ID,
        ownerSubject: null,
        createdAt: Number(folder.createdAt) || now,
        updatedAt: Number(folder.updatedAt) || Number(folder.createdAt) || now,
      });
    }

    for (const note of state.notes) {
      resources.push({
        type: "note",
        externalId: note.id,
        parentType: note.folderId ? "folder" : WORKSPACE_TYPE,
        parentExternalId: note.folderId || WORKSPACE_ID,
        ownerSubject: null,
        createdAt: Number(note.createdAt) || now,
        updatedAt: Number(note.updatedAt) || Number(note.createdAt) || now,
      });
    }

    await this.store.replaceResources(resources);
    return resources;
  }

  async ensureBootstrapOwner(user) {
    const hasBindings = await this.store.hasBindings();
    if (hasBindings) {
      return false;
    }

    const bootstrapEmail = String(process.env.TUI_NOTES_BOOTSTRAP_OWNER_EMAIL || "")
      .trim()
      .toLowerCase();
    const bootstrapUserId = String(process.env.TUI_NOTES_BOOTSTRAP_OWNER_USER || "").trim();

    let subjectType = "";
    let subjectId = "";

    if (bootstrapUserId) {
      subjectType = "user";
      subjectId = bootstrapUserId;
    } else if (bootstrapEmail) {
      subjectType = "user";
      subjectId = bootstrapEmail;
    } else if (String(user?.email || "").trim()) {
      subjectType = "user";
      subjectId = String(user.email).trim().toLowerCase();
    } else if (String(user?.userId || "").trim()) {
      subjectType = "user";
      subjectId = String(user.userId).trim();
    } else {
      return false;
    }

    await this.store.putBinding(
      createBindingInput({
        resourceType: WORKSPACE_TYPE,
        resourceExternalId: WORKSPACE_ID,
        subjectType,
        subjectId,
        role: "owner",
        inherit: true,
        createdBy: "system",
      }),
    );

    return true;
  }

  getUserHomeFolderId(user, { state = null } = {}) {
    const homeFolderIds = listHomeFolderIdsForUser(user);
    if (!homeFolderIds.length) {
      return null;
    }

    if (state && Array.isArray(state.folders)) {
      const existing = state.folders.find((folder) => homeFolderIds.includes(String(folder?.id || "")));
      if (existing?.id) {
        return String(existing.id);
      }

      const homeFolderName = toHomeFolderName(user);
      const byName = state.folders.find(
        (folder) => String(folder?.name || "").trim() === homeFolderName && (folder?.parentId ?? null) === null,
      );
      if (byName?.id) {
        return String(byName.id);
      }
    }

    return homeFolderIds[0];
  }

  async ensureUserHomeFolder(rawState, user, { mode = this.getAuthMode() } = {}) {
    const state = normalizeStatePayload(rawState);
    const subjects = listUserSubjectCandidates(user);
    if (!subjects.length || mode === "off") {
      return { state, changed: false, homeFolderId: null };
    }

    const subjectKeySet = new Set(subjects.map((subject) => `${subject.subjectType}:${subject.subjectId}`));
    const homeFolderIdCandidates = listHomeFolderIdsForUser(user);
    const knownHomeIds = new Set(homeFolderIdCandidates);

    const existingBindings = await this.store.listBindings();
    for (const binding of existingBindings) {
      if (binding.resourceType !== "folder" || binding.role !== "owner" || binding.inherit !== true) {
        continue;
      }
      const subjectKey = `${binding.subjectType}:${binding.subjectId}`;
      if (!subjectKeySet.has(subjectKey)) {
        continue;
      }
      const resourceId = String(binding.resourceExternalId || "").trim();
      if (resourceId) {
        knownHomeIds.add(resourceId);
      }
    }

    let homeFolder = state.folders.find((folder) => knownHomeIds.has(String(folder.id))) || null;
    const homeFolderId = homeFolder ? String(homeFolder.id) : homeFolderIdCandidates[0];
    const homeFolderName = toHomeFolderName(user);
    const now = nowMs();
    let changed = false;

    if (!homeFolder) {
      homeFolder = {
        id: homeFolderId,
        name: homeFolderName,
        parentId: null,
        createdAt: now,
        updatedAt: now,
      };
      state.folders.push(homeFolder);
      changed = true;
    } else {
      const shouldRename =
        homeFolderName !== HOME_FOLDER_NAME ||
        !String(homeFolder.name || "").trim() ||
        homeFolder.name === HOME_FOLDER_NAME;
      if (shouldRename && homeFolder.name !== homeFolderName) {
        homeFolder.name = homeFolderName;
        homeFolder.updatedAt = now;
        changed = true;
      }
      if (homeFolder.parentId !== null) {
        homeFolder.parentId = null;
        homeFolder.updatedAt = now;
        changed = true;
      }
    }

    if (!state.ui.expandedFolderIds.includes(homeFolderId)) {
      state.ui.expandedFolderIds.push(homeFolderId);
      changed = true;
    }

    await this.syncResourcesFromState(state);

    const currentBindings = await this.store.listBindingsForResource("folder", homeFolderId);
    const ownerBindingKeys = new Set(
      currentBindings
        .filter((binding) => binding.role === "owner" && binding.inherit === true)
        .map((binding) => `${binding.subjectType}:${binding.subjectId}`),
    );

    for (const subject of subjects) {
      const ownerKey = `${subject.subjectType}:${subject.subjectId}`;
      if (ownerBindingKeys.has(ownerKey)) {
        continue;
      }
      await this.store.putBinding(
        createBindingInput({
          resourceType: "folder",
          resourceExternalId: homeFolderId,
          subjectType: subject.subjectType,
          subjectId: subject.subjectId,
          role: "owner",
          inherit: true,
          createdBy: "system",
        }),
      );
      ownerBindingKeys.add(ownerKey);
      changed = true;
    }

    return {
      state,
      changed,
      homeFolderId,
    };
  }

  async createSnapshot() {
    const resources = await this.store.listResources();
    const bindings = await this.store.listBindings();

    const resourceByKey = new Map();
    const bindingsByResourceKey = new Map();

    for (const resource of resources) {
      resourceByKey.set(resourceKey(resource.type, resource.externalId), resource);
    }

    for (const binding of bindings) {
      const key = resourceKey(binding.resourceType, binding.resourceExternalId);
      if (!bindingsByResourceKey.has(key)) {
        bindingsByResourceKey.set(key, []);
      }
      bindingsByResourceKey.get(key).push(binding);
    }

    return {
      resources,
      bindings,
      resourceByKey,
      bindingsByResourceKey,
    };
  }

  getResourcePath(snapshot, resourceType, externalId) {
    const path = [];
    const visited = new Set();
    let key = resourceKey(resourceType, externalId);

    while (key && snapshot.resourceByKey.has(key) && !visited.has(key)) {
      visited.add(key);
      const resource = snapshot.resourceByKey.get(key);
      path.push(resource);

      if (!resource.parentType || !resource.parentExternalId) {
        break;
      }

      key = resourceKey(resource.parentType, resource.parentExternalId);
    }

    return path;
  }

  evaluate(snapshot, user, { action, resourceType, resourceExternalId, mode = this.getAuthMode() }) {
    if (mode === "off") {
      return {
        allowed: true,
        role: "owner",
        observedDenied: false,
        reason: "auth-off",
      };
    }

    const required = ACTION_LEVEL[action] || ACTION_LEVEL.read;
    const path = this.getResourcePath(snapshot, resourceType, resourceExternalId);

    if (!path.length) {
      const denied = {
        allowed: false,
        role: null,
        observedDenied: mode === "observe",
        reason: "resource-not-found",
      };
      if (mode === "observe") {
        return { ...denied, allowed: true };
      }
      return denied;
    }

    const userSubjectIds = getUserSubjectIds(user);
    const groupSubjectIds = getGroupSubjectIds(user);

    let maxRoleLevel = 0;
    let maxRole = null;

    for (let depth = 0; depth < path.length; depth += 1) {
      const resource = path[depth];
      const isDirect = depth === 0;

      const owner = parseOwnerSubject(resource.ownerSubject);
      if (owner) {
        const ownerMatched =
          (owner.subjectType === "user" && userSubjectIds.has(owner.subjectId)) ||
          (owner.subjectType === "group" && groupSubjectIds.has(owner.subjectId));
        if (ownerMatched) {
          maxRoleLevel = ROLE_LEVEL.owner;
          maxRole = "owner";
          break;
        }
      }

      const key = resourceKey(resource.type, resource.externalId);
      const resourceBindings = snapshot.bindingsByResourceKey.get(key) || [];

      for (const binding of resourceBindings) {
        if (!isDirect && binding.inherit === false) {
          continue;
        }

        let matched = false;
        if (binding.subjectType === "public") {
          matched = binding.subjectId === "*";
        } else if (binding.subjectType === "user") {
          matched = userSubjectIds.has(binding.subjectId);
        } else if (binding.subjectType === "group") {
          matched = groupSubjectIds.has(binding.subjectId);
        }

        if (!matched) {
          continue;
        }

        const roleLevel = ROLE_LEVEL[binding.role] || 0;
        if (roleLevel > maxRoleLevel) {
          maxRoleLevel = roleLevel;
          maxRole = binding.role;
        }
      }
    }

    const isAllowed = maxRoleLevel >= required;
    if (isAllowed) {
      return {
        allowed: true,
        role: maxRole,
        observedDenied: false,
        reason: "ok",
      };
    }

    if (mode === "observe") {
      return {
        allowed: true,
        role: maxRole,
        observedDenied: true,
        reason: "insufficient-role",
      };
    }

    return {
      allowed: false,
      role: maxRole,
      observedDenied: false,
      reason: "insufficient-role",
    };
  }

  async getCapabilitiesForResource(user, { resourceType, resourceExternalId, mode = this.getAuthMode() }) {
    const snapshot = await this.createSnapshot();
    const canRead = this.evaluate(snapshot, user, {
      action: "read",
      resourceType,
      resourceExternalId,
      mode,
    }).allowed;
    const canWrite = this.evaluate(snapshot, user, {
      action: "write",
      resourceType,
      resourceExternalId,
      mode,
    }).allowed;
    const canManage = this.evaluate(snapshot, user, {
      action: "manage",
      resourceType,
      resourceExternalId,
      mode,
    }).allowed;

    return {
      canRead,
      canWrite,
      canManage,
    };
  }

  async filterStateForUser(rawState, user, { mode = this.getAuthMode() } = {}) {
    const state = normalizeStatePayload(rawState);
    if (mode === "off" || mode === "observe") {
      return cloneState(state);
    }

    const snapshot = await this.createSnapshot();
    const readableFolderIds = new Set();
    const readableNoteIds = new Set();

    for (const folder of state.folders) {
      const decision = this.evaluate(snapshot, user, {
        action: "read",
        resourceType: "folder",
        resourceExternalId: folder.id,
        mode,
      });
      if (decision.allowed) {
        readableFolderIds.add(folder.id);
      }
    }

    for (const note of state.notes) {
      const decision = this.evaluate(snapshot, user, {
        action: "read",
        resourceType: "note",
        resourceExternalId: note.id,
        mode,
      });
      if (decision.allowed) {
        readableNoteIds.add(note.id);
        if (note.folderId) {
          readableFolderIds.add(note.folderId);
        }
      }
    }

    const folderById = new Map(state.folders.map((folder) => [folder.id, folder]));
    for (const folderId of [...readableFolderIds]) {
      let currentId = folderById.get(folderId)?.parentId || null;
      while (currentId && folderById.has(currentId)) {
        if (readableFolderIds.has(currentId)) {
          currentId = folderById.get(currentId)?.parentId || null;
          continue;
        }
        readableFolderIds.add(currentId);
        currentId = folderById.get(currentId)?.parentId || null;
      }
    }

    const filteredFolders = state.folders.filter((folder) => readableFolderIds.has(folder.id));
    const filteredNotes = state.notes.filter((note) => readableNoteIds.has(note.id));
    const filteredFolderIds = new Set(filteredFolders.map((folder) => folder.id));

    return {
      folders: filteredFolders,
      notes: filteredNotes.map((note) => ({
        ...note,
        folderId: note.folderId && filteredFolderIds.has(note.folderId) ? note.folderId : null,
      })),
      ui: {
        expandedFolderIds: (state.ui?.expandedFolderIds || []).filter((id) => filteredFolderIds.has(id)),
      },
    };
  }

  async assertAllowed(user, { action, resourceType, resourceExternalId, mode = this.getAuthMode(), snapshot = null }) {
    const localSnapshot = snapshot || (await this.createSnapshot());
    const decision = this.evaluate(localSnapshot, user, {
      action,
      resourceType,
      resourceExternalId,
      mode,
    });

    if (decision.observedDenied) {
      this.logger.warn?.(
        `[tui.notes.2026][auth][observe] deny would trigger: action=${action} resource=${resourceType}:${resourceExternalId} user=${user?.displayName || user?.id || "unknown"}`,
      );
    }

    if (!decision.allowed) {
      const error = new Error("Forbidden");
      error.status = 403;
      error.details = {
        action,
        resourceType,
        resourceExternalId,
        reason: decision.reason,
      };
      throw error;
    }

    return decision;
  }

  async mergeScopedStateForWrite({
    currentFullState,
    incomingScopedState,
    user,
    mode = this.getAuthMode(),
  }) {
    if (mode === "off" || mode === "observe") {
      return normalizeStatePayload(incomingScopedState);
    }

    const currentNormalized = normalizeStatePayload(currentFullState);
    const incomingNormalized = normalizeStatePayload(incomingScopedState);
    const visibleBaseline = await this.filterStateForUser(currentNormalized, user, { mode });
    const snapshot = await this.createSnapshot();

    const fullState = cloneState(currentNormalized);

    const fullFolderById = new Map(fullState.folders.map((folder) => [folder.id, folder]));
    const fullNoteById = new Map(fullState.notes.map((note) => [note.id, note]));

    const baselineFolderById = new Map(visibleBaseline.folders.map((folder) => [folder.id, folder]));
    const baselineNoteById = new Map(visibleBaseline.notes.map((note) => [note.id, note]));

    const incomingFolderById = new Map(incomingNormalized.folders.map((folder) => [folder.id, folder]));
    const incomingNoteById = new Map(incomingNormalized.notes.map((note) => [note.id, note]));

    for (const incomingFolder of incomingNormalized.folders) {
      if (fullFolderById.has(incomingFolder.id) && !baselineFolderById.has(incomingFolder.id)) {
        const error = new Error("Forbidden folder mutation.");
        error.status = 403;
        throw error;
      }
    }
    for (const incomingNote of incomingNormalized.notes) {
      if (fullNoteById.has(incomingNote.id) && !baselineNoteById.has(incomingNote.id)) {
        const error = new Error("Forbidden note mutation.");
        error.status = 403;
        throw error;
      }
    }

    const now = nowMs();
    const protectedHomeFolderId = this.getUserHomeFolderId(user, { state: currentNormalized });

    for (const [folderId, baselineFolder] of baselineFolderById.entries()) {
      if (protectedHomeFolderId && folderId === protectedHomeFolderId) {
        continue;
      }
      if (!incomingFolderById.has(folderId)) {
        await this.assertAllowed(user, {
          action: "write",
          resourceType: "folder",
          resourceExternalId: folderId,
          mode,
          snapshot,
        });

        const childrenMap = buildFolderChildrenMap(fullState.folders);
        const toDelete = collectDescendantFolderIds(folderId, childrenMap);

        fullState.folders = fullState.folders.filter((folder) => !toDelete.has(folder.id));

        for (const note of fullState.notes) {
          if (note.folderId && toDelete.has(note.folderId)) {
            note.folderId = null;
            if (!note.deletedAt) {
              note.deletedAt = now;
            }
            note.updatedAt = now;
          }
        }

        fullFolderById.clear();
        for (const folder of fullState.folders) {
          fullFolderById.set(folder.id, folder);
        }
      } else {
        const incomingFolder = incomingFolderById.get(folderId);
        const fullFolder = fullFolderById.get(folderId);
        if (!fullFolder) {
          continue;
        }

        const changed =
          String(fullFolder.name) !== String(incomingFolder.name) ||
          String(fullFolder.parentId || "") !== String(incomingFolder.parentId || "");

        if (!changed) {
          continue;
        }

        await this.assertAllowed(user, {
          action: "write",
          resourceType: "folder",
          resourceExternalId: folderId,
          mode,
          snapshot,
        });

        const nextParentId = incomingFolder.parentId && fullFolderById.has(incomingFolder.parentId)
          ? incomingFolder.parentId
          : null;

        fullFolder.name = incomingFolder.name;
        fullFolder.parentId = nextParentId;
        fullFolder.updatedAt = Number(incomingFolder.updatedAt) || now;
      }
    }

    for (const incomingFolder of incomingNormalized.folders) {
      if (fullFolderById.has(incomingFolder.id)) {
        continue;
      }

      const parentId = incomingFolder.parentId && fullFolderById.has(incomingFolder.parentId)
        ? incomingFolder.parentId
        : null;

      if (parentId) {
        await this.assertAllowed(user, {
          action: "write",
          resourceType: "folder",
          resourceExternalId: parentId,
          mode,
          snapshot,
        });
      } else {
        await this.assertAllowed(user, {
          action: "write",
          resourceType: WORKSPACE_TYPE,
          resourceExternalId: WORKSPACE_ID,
          mode,
          snapshot,
        });
      }

      const nextFolder = {
        ...incomingFolder,
        parentId,
        createdAt: Number(incomingFolder.createdAt) || now,
        updatedAt: Number(incomingFolder.updatedAt) || now,
      };
      fullState.folders.push(nextFolder);
      fullFolderById.set(nextFolder.id, nextFolder);
    }

    for (const [noteId] of baselineNoteById.entries()) {
      if (incomingNoteById.has(noteId)) {
        continue;
      }

      await this.assertAllowed(user, {
        action: "write",
        resourceType: "note",
        resourceExternalId: noteId,
        mode,
        snapshot,
      });

      fullState.notes = fullState.notes.filter((note) => note.id !== noteId);
      fullNoteById.delete(noteId);
    }

    for (const [noteId, incomingNote] of incomingNoteById.entries()) {
      const fullNote = fullNoteById.get(noteId);
      if (!fullNote) {
        const folderId = incomingNote.folderId && fullFolderById.has(incomingNote.folderId)
          ? incomingNote.folderId
          : null;

        if (folderId) {
          await this.assertAllowed(user, {
            action: "write",
            resourceType: "folder",
            resourceExternalId: folderId,
            mode,
            snapshot,
          });
        } else {
          await this.assertAllowed(user, {
            action: "write",
            resourceType: WORKSPACE_TYPE,
            resourceExternalId: WORKSPACE_ID,
            mode,
            snapshot,
          });
        }

        const nextNote = {
          ...incomingNote,
          folderId,
          createdAt: Number(incomingNote.createdAt) || now,
          updatedAt: Number(incomingNote.updatedAt) || now,
          deletedAt: incomingNote.deletedAt ? Number(incomingNote.deletedAt) || null : null,
          shareId: typeof incomingNote.shareId === "string" ? incomingNote.shareId.trim() || null : null,
        };

        fullState.notes.push(nextNote);
        fullNoteById.set(nextNote.id, nextNote);
        continue;
      }

      const baselineNote = baselineNoteById.get(noteId);
      const incomingShareId =
        typeof incomingNote.shareId === "string" && incomingNote.shareId.trim()
          ? incomingNote.shareId.trim()
          : null;
      const baselineShareId =
        baselineNote && typeof baselineNote.shareId === "string" && baselineNote.shareId.trim()
          ? baselineNote.shareId.trim()
          : null;
      const noteChangedAgainstBaseline =
        !baselineNote ||
        String(incomingNote.title || "") !== String(baselineNote.title || "") ||
        String(incomingNote.folderId || "") !== String(baselineNote.folderId || "") ||
        String(incomingNote.content || "") !== String(baselineNote.content || "") ||
        String(incomingNote.fileName || "") !== String(baselineNote.fileName || "") ||
        String(incomingNote.deletedAt || "") !== String(baselineNote.deletedAt || "") ||
        incomingShareId !== baselineShareId;

      if (!noteChangedAgainstBaseline) {
        continue;
      }

      const incomingUpdatedAt = Number(incomingNote.updatedAt) || 0;
      const currentUpdatedAt = Number(fullNote.updatedAt) || 0;
      if (incomingUpdatedAt > 0 && currentUpdatedAt > 0 && incomingUpdatedAt < currentUpdatedAt) {
        continue;
      }

      await this.assertAllowed(user, {
        action: "write",
        resourceType: "note",
        resourceExternalId: noteId,
        mode,
        snapshot,
      });

      const targetFolderId = incomingNote.folderId && fullFolderById.has(incomingNote.folderId)
        ? incomingNote.folderId
        : null;

      if (targetFolderId && targetFolderId !== fullNote.folderId) {
        await this.assertAllowed(user, {
          action: "write",
          resourceType: "folder",
          resourceExternalId: targetFolderId,
          mode,
          snapshot,
        });
      }

      fullNote.title = incomingNote.title;
      fullNote.folderId = targetFolderId;
      fullNote.content = incomingNote.content;
      fullNote.fileName = incomingNote.fileName;
      fullNote.shareId =
        incomingShareId || fullNote.shareId || null;
      fullNote.deletedAt = incomingNote.deletedAt ? Number(incomingNote.deletedAt) || null : null;
      fullNote.updatedAt = Number(incomingNote.updatedAt) || now;
    }

    const fullFolderIds = new Set(fullState.folders.map((folder) => folder.id));
    fullState.notes = fullState.notes.map((note) => ({
      ...note,
      folderId: note.folderId && fullFolderIds.has(note.folderId) ? note.folderId : null,
    }));

    fullState.ui = {
      expandedFolderIds: Array.isArray(currentNormalized.ui?.expandedFolderIds)
        ? [...currentNormalized.ui.expandedFolderIds]
        : [],
    };

    return fullState;
  }

  async grantBinding({ actorUser, bindingInput, mode = this.getAuthMode() }) {
    const resourceType = String(bindingInput?.resourceType || "").trim();
    const resourceExternalId = String(bindingInput?.resourceExternalId || "").trim();
    const role = String(bindingInput?.role || "").trim();
    const subjectType = String(bindingInput?.subjectType || "").trim();
    const subjectId = String(bindingInput?.subjectId || "").trim();
    const inherit = bindingInput?.inherit !== false;

    if (!resourceType || !resourceExternalId || !role || !subjectType || !subjectId) {
      const error = new Error("Invalid ACL grant payload.");
      error.status = 400;
      throw error;
    }

    if (!ROLE_LEVEL[role]) {
      const error = new Error("Unsupported role.");
      error.status = 400;
      throw error;
    }

    if (!["user", "group", "public"].includes(subjectType)) {
      const error = new Error("Unsupported subject type.");
      error.status = 400;
      throw error;
    }

    const snapshot = await this.createSnapshot();
    await this.assertAllowed(actorUser, {
      action: "manage",
      resourceType,
      resourceExternalId,
      mode,
      snapshot,
    });

    const binding = await this.store.putBinding(
      createBindingInput({
        id: bindingInput?.id,
        resourceType,
        resourceExternalId,
        subjectType,
        subjectId,
        role,
        inherit,
        createdBy: actorUser?.id || actorUser?.email || "unknown",
      }),
    );

    return binding;
  }

  async revokeBinding({ actorUser, bindingId, mode = this.getAuthMode() }) {
    const id = String(bindingId || "").trim();
    if (!id) {
      const error = new Error("Binding id is required.");
      error.status = 400;
      throw error;
    }

    const allBindings = await this.store.listBindings();
    const existing = allBindings.find((binding) => binding.id === id);
    if (!existing) {
      return false;
    }

    const snapshot = await this.createSnapshot();
    await this.assertAllowed(actorUser, {
      action: "manage",
      resourceType: existing.resourceType,
      resourceExternalId: existing.resourceExternalId,
      mode,
      snapshot,
    });

    const isSelfOwnerBinding =
      String(existing.role || "").trim().toLowerCase() === "owner" &&
      matchesActorSubject(existing, actorUser);
    if (isSelfOwnerBinding) {
      const error = new Error("Owner cannot revoke own owner access.");
      error.status = 400;
      throw error;
    }

    return this.store.deleteBinding(id);
  }

  async listBindingsForResource({ actorUser, resourceType, resourceExternalId, mode = this.getAuthMode() }) {
    const snapshot = await this.createSnapshot();
    await this.assertAllowed(actorUser, {
      action: "manage",
      resourceType,
      resourceExternalId,
      mode,
      snapshot,
    });

    return this.store.listBindingsForResource(resourceType, resourceExternalId);
  }

  async listEffectiveBindingsForResource({
    actorUser,
    resourceType,
    resourceExternalId,
    mode = this.getAuthMode(),
  }) {
    const snapshot = await this.createSnapshot();
    await this.assertAllowed(actorUser, {
      action: "manage",
      resourceType,
      resourceExternalId,
      mode,
      snapshot,
    });

    const path = this.getResourcePath(snapshot, resourceType, resourceExternalId);
    const directBindings = await this.store.listBindingsForResource(resourceType, resourceExternalId);
    const effectiveBindings = [];

    for (let depth = 0; depth < path.length; depth += 1) {
      const resource = path[depth];
      const key = resourceKey(resource.type, resource.externalId);
      const resourceBindings = snapshot.bindingsByResourceKey.get(key) || [];
      const isDirect = depth === 0;

      for (const binding of resourceBindings) {
        if (!isDirect && binding.inherit === false) {
          continue;
        }
        const isSelfOwnerBinding =
          String(binding.role || "").trim().toLowerCase() === "owner" &&
          matchesActorSubject(binding, actorUser);
        effectiveBindings.push({
          ...binding,
          relation: isDirect ? "direct" : "inherited",
          sourceResourceType: resource.type,
          sourceResourceExternalId: resource.externalId,
          canRevoke: Boolean(binding.id) && !isSelfOwnerBinding,
        });
      }
    }

    effectiveBindings.sort((left, right) => {
      const byRelation = left.relation.localeCompare(right.relation);
      if (byRelation !== 0) {
        return byRelation;
      }
      const bySubjectType = String(left.subjectType || "").localeCompare(String(right.subjectType || ""));
      if (bySubjectType !== 0) {
        return bySubjectType;
      }
      const bySubjectId = String(left.subjectId || "").localeCompare(String(right.subjectId || ""));
      if (bySubjectId !== 0) {
        return bySubjectId;
      }
      return String(left.id || "").localeCompare(String(right.id || ""));
    });

    return {
      directBindings,
      effectiveBindings,
    };
  }

  async getViewerContext(user, { mode = this.getAuthMode(), state = null } = {}) {
    return {
      authMode: mode,
      workspace: await this.getCapabilitiesForResource(user, {
        resourceType: WORKSPACE_TYPE,
        resourceExternalId: WORKSPACE_ID,
        mode,
      }),
      user: {
        id: user?.id || "anonymous",
        userId: user?.userId || "",
        email: user?.email || "",
        preferredUsername: user?.preferredUsername || "",
        groups: Array.isArray(user?.groups) ? user.groups : [],
        isAuthenticated: Boolean(user?.isAuthenticated),
        displayName: user?.displayName || user?.email || user?.userId || user?.id || "anonymous",
      },
      homeFolderId: this.getUserHomeFolderId(user, { state }),
    };
  }
}

export function getWorkspaceResource() {
  return {
    type: WORKSPACE_TYPE,
    externalId: WORKSPACE_ID,
  };
}

export function toOwnerSubjectFromUser(user) {
  if (String(user?.email || "").trim()) {
    return toOwnerSubject("user", String(user.email).trim().toLowerCase());
  }
  if (String(user?.userId || "").trim()) {
    return toOwnerSubject("user", String(user.userId).trim());
  }
  return null;
}
