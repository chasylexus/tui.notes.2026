import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function nowMs() {
  return Date.now();
}

function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeResource(resource) {
  return {
    type: String(resource?.type || "").trim(),
    externalId: String(resource?.externalId || "").trim(),
    parentType: resource?.parentType ? String(resource.parentType).trim() : null,
    parentExternalId: resource?.parentExternalId ? String(resource.parentExternalId).trim() : null,
    ownerSubject: resource?.ownerSubject ? String(resource.ownerSubject).trim() : null,
    createdAt: Number(resource?.createdAt) || nowMs(),
    updatedAt: Number(resource?.updatedAt) || nowMs(),
  };
}

function normalizeBinding(binding) {
  return {
    id: String(binding?.id || createId()).trim(),
    resourceType: String(binding?.resourceType || "").trim(),
    resourceExternalId: String(binding?.resourceExternalId || "").trim(),
    subjectType: String(binding?.subjectType || "").trim(),
    subjectId: String(binding?.subjectId || "").trim(),
    role: String(binding?.role || "").trim(),
    inherit: binding?.inherit !== false,
    createdBy: binding?.createdBy ? String(binding.createdBy).trim() : null,
    createdAt: Number(binding?.createdAt) || nowMs(),
  };
}

function resourceKey(resourceType, resourceExternalId) {
  return `${String(resourceType)}:${String(resourceExternalId)}`;
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

class FileAclStore {
  constructor(storageRootDir) {
    this.filePath = path.join(storageRootDir, "acl.json");
    this.cache = {
      resources: [],
      bindings: [],
    };
  }

  async init() {
    const payload = readJson(this.filePath);
    if (payload && typeof payload === "object") {
      this.cache.resources = Array.isArray(payload.resources)
        ? payload.resources.map(normalizeResource)
        : [];
      this.cache.bindings = Array.isArray(payload.bindings)
        ? payload.bindings.map(normalizeBinding)
        : [];
    }
    await this.flush();
  }

  async flush() {
    writeJson(this.filePath, {
      resources: this.cache.resources,
      bindings: this.cache.bindings,
    });
  }

  async close() {
    // noop
  }

  async listResources() {
    return this.cache.resources.map((resource) => ({ ...resource }));
  }

  async replaceResources(resources) {
    const normalized = Array.isArray(resources) ? resources.map(normalizeResource) : [];
    const filtered = normalized.filter((resource) => resource.type && resource.externalId);
    const existingKeys = new Set(filtered.map((resource) => resourceKey(resource.type, resource.externalId)));

    this.cache.resources = filtered;
    this.cache.bindings = this.cache.bindings.filter((binding) =>
      existingKeys.has(resourceKey(binding.resourceType, binding.resourceExternalId)),
    );

    await this.flush();
  }

  async listBindings() {
    return this.cache.bindings.map((binding) => ({ ...binding }));
  }

  async listBindingsForResource(resourceType, resourceExternalId) {
    return this.cache.bindings
      .filter(
        (binding) =>
          binding.resourceType === resourceType &&
          binding.resourceExternalId === resourceExternalId,
      )
      .map((binding) => ({ ...binding }));
  }

  async hasBindings() {
    return this.cache.bindings.length > 0;
  }

  async putBinding(binding) {
    const normalized = normalizeBinding(binding);
    const key = resourceKey(normalized.resourceType, normalized.resourceExternalId);
    const resourceExists = this.cache.resources.some(
      (resource) => resourceKey(resource.type, resource.externalId) === key,
    );
    if (!resourceExists) {
      throw new Error("Resource not found for ACL binding.");
    }

    const nextBindings = this.cache.bindings.filter((item) => item.id !== normalized.id);
    nextBindings.push(normalized);
    this.cache.bindings = nextBindings;
    await this.flush();
    return { ...normalized };
  }

  async deleteBinding(bindingId) {
    const id = String(bindingId || "").trim();
    const previousLength = this.cache.bindings.length;
    this.cache.bindings = this.cache.bindings.filter((binding) => binding.id !== id);
    const deleted = previousLength !== this.cache.bindings.length;
    if (deleted) {
      await this.flush();
    }
    return deleted;
  }
}

class PostgresAclStore {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = null;
  }

  async init() {
    const { Pool } = await import("pg");
    this.pool = new Pool({ connectionString: this.connectionString });

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS acl_resources (
        type TEXT NOT NULL,
        external_id TEXT NOT NULL,
        parent_type TEXT,
        parent_external_id TEXT,
        owner_subject TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (type, external_id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS acl_bindings (
        id TEXT PRIMARY KEY,
        resource_type TEXT NOT NULL,
        resource_external_id TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        role TEXT NOT NULL,
        inherit BOOLEAN NOT NULL DEFAULT TRUE,
        created_by TEXT,
        created_at BIGINT NOT NULL
      )
    `);

    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS acl_bindings_resource_idx ON acl_bindings (resource_type, resource_external_id)",
    );
    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS acl_bindings_subject_idx ON acl_bindings (subject_type, subject_id)",
    );
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async listResources() {
    const result = await this.pool.query(
      "SELECT type, external_id, parent_type, parent_external_id, owner_subject, created_at, updated_at FROM acl_resources",
    );
    return result.rows.map((row) =>
      normalizeResource({
        type: row.type,
        externalId: row.external_id,
        parentType: row.parent_type,
        parentExternalId: row.parent_external_id,
        ownerSubject: row.owner_subject,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  }

  async replaceResources(resources) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM acl_resources");

      const normalized = Array.isArray(resources) ? resources.map(normalizeResource) : [];
      for (const resource of normalized) {
        if (!resource.type || !resource.externalId) {
          continue;
        }
        await client.query(
          `
          INSERT INTO acl_resources (
            type,
            external_id,
            parent_type,
            parent_external_id,
            owner_subject,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            resource.type,
            resource.externalId,
            resource.parentType,
            resource.parentExternalId,
            resource.ownerSubject,
            resource.createdAt,
            resource.updatedAt,
          ],
        );
      }

      await client.query(`
        DELETE FROM acl_bindings b
        WHERE NOT EXISTS (
          SELECT 1
          FROM acl_resources r
          WHERE r.type = b.resource_type
            AND r.external_id = b.resource_external_id
        )
      `);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listBindings() {
    const result = await this.pool.query(
      "SELECT id, resource_type, resource_external_id, subject_type, subject_id, role, inherit, created_by, created_at FROM acl_bindings",
    );
    return result.rows.map((row) =>
      normalizeBinding({
        id: row.id,
        resourceType: row.resource_type,
        resourceExternalId: row.resource_external_id,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        role: row.role,
        inherit: row.inherit,
        createdBy: row.created_by,
        createdAt: row.created_at,
      }),
    );
  }

  async listBindingsForResource(resourceType, resourceExternalId) {
    const result = await this.pool.query(
      `
      SELECT id, resource_type, resource_external_id, subject_type, subject_id, role, inherit, created_by, created_at
      FROM acl_bindings
      WHERE resource_type = $1 AND resource_external_id = $2
      `,
      [resourceType, resourceExternalId],
    );

    return result.rows.map((row) =>
      normalizeBinding({
        id: row.id,
        resourceType: row.resource_type,
        resourceExternalId: row.resource_external_id,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        role: row.role,
        inherit: row.inherit,
        createdBy: row.created_by,
        createdAt: row.created_at,
      }),
    );
  }

  async hasBindings() {
    const result = await this.pool.query("SELECT 1 FROM acl_bindings LIMIT 1");
    return result.rows.length > 0;
  }

  async putBinding(binding) {
    const normalized = normalizeBinding(binding);
    const resourceResult = await this.pool.query(
      "SELECT 1 FROM acl_resources WHERE type = $1 AND external_id = $2",
      [normalized.resourceType, normalized.resourceExternalId],
    );
    if (!resourceResult.rows.length) {
      throw new Error("Resource not found for ACL binding.");
    }

    await this.pool.query(
      `
      INSERT INTO acl_bindings (
        id,
        resource_type,
        resource_external_id,
        subject_type,
        subject_id,
        role,
        inherit,
        created_by,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id)
      DO UPDATE SET
        resource_type = EXCLUDED.resource_type,
        resource_external_id = EXCLUDED.resource_external_id,
        subject_type = EXCLUDED.subject_type,
        subject_id = EXCLUDED.subject_id,
        role = EXCLUDED.role,
        inherit = EXCLUDED.inherit,
        created_by = EXCLUDED.created_by,
        created_at = EXCLUDED.created_at
      `,
      [
        normalized.id,
        normalized.resourceType,
        normalized.resourceExternalId,
        normalized.subjectType,
        normalized.subjectId,
        normalized.role,
        normalized.inherit,
        normalized.createdBy,
        normalized.createdAt,
      ],
    );

    return normalized;
  }

  async deleteBinding(bindingId) {
    const result = await this.pool.query("DELETE FROM acl_bindings WHERE id = $1", [bindingId]);
    return result.rowCount > 0;
  }
}

export async function createAclStore({ storageRootDir }) {
  const connectionString = String(process.env.TUI_NOTES_AUTH_DB_URL || "").trim();
  const store = connectionString
    ? new PostgresAclStore(connectionString)
    : new FileAclStore(storageRootDir);

  await store.init();
  return store;
}

export function createBindingInput({
  resourceType,
  resourceExternalId,
  subjectType,
  subjectId,
  role,
  inherit,
  createdBy,
  id,
}) {
  return normalizeBinding({
    id,
    resourceType,
    resourceExternalId,
    subjectType,
    subjectId,
    role,
    inherit,
    createdBy,
  });
}
