const AUTH_MODES = new Set(["off", "observe", "enforce"]);

function normalizeAuthMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return AUTH_MODES.has(mode) ? mode : "off";
}

export function getAuthMode() {
  return normalizeAuthMode(process.env.TUI_NOTES_AUTH_MODE || "off");
}

function parseGroups(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  return [...new Set(
    String(input || "")
      .split(/[;,\n]/)
      .map((chunk) => chunk.trim())
      .filter(Boolean),
  )];
}

function readHeader(req, names) {
  for (const name of names) {
    const value = req.headers?.[name];
    if (Array.isArray(value)) {
      const first = value.find((entry) => String(entry || "").trim());
      if (first) {
        return String(first).trim();
      }
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getIdentityFromHeaders(req) {
  const userId =
    readHeader(req, ["x-auth-request-user", "x-forwarded-user", "x-user-id", "x-user"]) || "";
  const email =
    readHeader(req, ["x-auth-request-email", "x-forwarded-email", "x-user-email", "x-email"]) || "";
  const preferredUsername =
    readHeader(
      req,
      ["x-auth-request-preferred-username", "x-preferred-username", "x-user-name", "x-username"],
    ) || "";
  const groupsRaw =
    readHeader(req, ["x-auth-request-groups", "x-forwarded-groups", "x-user-groups", "x-groups"]) || "";

  return {
    userId,
    email,
    preferredUsername,
    groups: parseGroups(groupsRaw),
  };
}

function normalizeIdentity(identity) {
  const userId = String(identity?.userId || "").trim();
  const email = String(identity?.email || "").trim().toLowerCase();
  const preferredUsername = String(identity?.preferredUsername || "").trim();
  const groups = parseGroups(identity?.groups);
  const emailLocalPart = email.includes("@") ? email.split("@")[0].trim() : email;

  const isAuthenticated = Boolean(userId || email || preferredUsername);
  const stableId = email || preferredUsername || userId || "anonymous";
  const displayName =
    preferredUsername ||
    emailLocalPart ||
    userId ||
    stableId ||
    "anonymous";

  return {
    id: stableId,
    userId,
    email,
    preferredUsername,
    groups,
    isAuthenticated,
    displayName,
  };
}

export function createAuthContext(req) {
  const mode = getAuthMode();
  const identity = normalizeIdentity(getIdentityFromHeaders(req));

  return {
    mode,
    user: identity,
    isAuthenticated: identity.isAuthenticated,
    isEnforced: mode === "enforce",
    isObserve: mode === "observe",
    isOff: mode === "off",
  };
}

export function authContextMiddleware(req, _res, next) {
  req.authContext = createAuthContext(req);
  next();
}

export function requireAuthentication(req, res, next) {
  const context = req.authContext || createAuthContext(req);
  req.authContext = context;

  if (context.isEnforced && !context.isAuthenticated) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  next();
}
