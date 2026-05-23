import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Clipboard,
  DoorOpen,
  Eye,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Star,
  Terminal,
  UserRoundCog,
  X
} from "lucide-react";
import salesDexLogo from "./assets/sales-dex-logo.svg";
import "./styles.css";

type Environment = "Production" | "Sandbox" | "Unknown";
type RiskLevel = "Low" | "Medium" | "High";

type Org = {
  id: string;
  alias: string;
  username: string;
  orgId: string;
  instanceUrl: string;
  loginUrl: string;
  environment: Environment;
  effectiveEnvironment: Environment;
  connectedStatus: string;
  lastUsed: string;
  lastCliLoginAt: string;
  localLastUsedAt: string;
  favorite: boolean;
  client: string;
  riskLevel: RiskLevel;
  notes: string;
};

type OrgDetails = {
  target: string;
  username: string;
  alias: string;
  orgId: string;
  instanceUrl: string;
  loginUrl: string;
  connectedStatus: string;
  environment: Environment;
  apiVersion: string;
  client: string;
  riskLevel: RiskLevel;
  notes: string;
  favorite: boolean;
};

type OrgMetadata = {
  alias: string;
  client: string;
  environment: Environment;
  riskLevel: RiskLevel;
  notes: string;
  favorite: boolean;
};

type ApiResponse<T> = T & {
  ok: boolean;
  message?: string;
};

type PromptOrgContext = {
  alias?: string;
  username?: string;
  orgId?: string;
  instanceUrl?: string;
  loginUrl?: string;
  effectiveEnvironment?: Environment;
  environment?: Environment;
  connectedStatus?: string;
  client?: string;
  riskLevel?: RiskLevel;
};

type SortKey = "client" | "alias" | "username" | "orgId" | "instanceUrl" | "type" | "status" | "lastLogin" | "favorite";
type SortDirection = "asc" | "desc";
type SortState = {
  key: SortKey;
  direction: SortDirection;
};

const loginAliasPattern = /^[a-zA-Z0-9._-]{1,90}$/;
const noticeTitleByType = {
  success: "Success",
  warning: "Warning",
  error: "Error"
} as const;

const emptyMetadata: OrgMetadata = {
  alias: "",
  client: "",
  environment: "Unknown",
  riskLevel: "Medium",
  notes: "",
  favorite: false
};

const textSorter = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function defaultSortDirection(key: SortKey): SortDirection {
  return key === "favorite" || key === "lastLogin" ? "desc" : "asc";
}

function getSortValue(org: Org, key: SortKey): string | number {
  switch (key) {
    case "client":
      return org.client || "Unassigned";
    case "alias":
      return org.alias || "";
    case "username":
      return org.username || "";
    case "orgId":
      return org.orgId || "";
    case "instanceUrl":
      return org.instanceUrl || "";
    case "type":
      return org.effectiveEnvironment || "Unknown";
    case "status":
      return org.connectedStatus || "";
    case "lastLogin":
      return Date.parse(org.lastCliLoginAt || "") || 0;
    case "favorite":
      return org.favorite ? 1 : 0;
  }
}

function compareOrgs(left: Org, right: Org, sortState: SortState) {
  const leftValue = getSortValue(left, sortState.key);
  const rightValue = getSortValue(right, sortState.key);
  const direction = sortState.direction === "asc" ? 1 : -1;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return (leftValue - rightValue) * direction;
  }

  return textSorter.compare(String(leftValue), String(rightValue)) * direction;
}

function isDisconnectedStatus(status: string) {
  return status.toLowerCase().includes("disconnect");
}

function isConnectedStatus(status: string) {
  const normalized = status.toLowerCase();
  return !isDisconnectedStatus(status) && (normalized.includes("connect") || normalized.includes("active"));
}

function buildCodexOrgPrompt(org: PromptOrgContext) {
  const alias = org.alias || org.username || "UNKNOWN_ALIAS";
  const commandAlias = alias.replace(/"/g, '\\"');
  const environment = org.effectiveEnvironment || org.environment || "Unknown";
  const formatValue = (value?: string) => value || "Not available";

  return [
    `You are working on Salesforce CLI org "${alias}" for this local project.`,
    "",
    "Before making any Salesforce changes, confirm the active CLI connection:",
    `1. Run: sf org display --target-org "${commandAlias}" --json`,
    "2. Verify the returned alias, username, and org ID match this context.",
    `3. If needed, set the project target with: sf config set target-org="${commandAlias}"`,
    "",
    "Expected org context:",
    `- Client: ${formatValue(org.client)}`,
    `- Alias: ${alias}`,
    `- Username: ${formatValue(org.username)}`,
    `- Org ID: ${formatValue(org.orgId)}`,
    `- Instance URL: ${formatValue(org.instanceUrl)}`,
    `- Login URL: ${formatValue(org.loginUrl)}`,
    `- Environment: ${environment}`,
    `- Connected status: ${formatValue(org.connectedStatus)}`,
    `- Risk level: ${org.riskLevel || "Medium"}`,
    "",
    "Do not start a new login unless this alias is unavailable. If the connection does not match, stop and ask me which org to use. If this is Production, ask for explicit confirmation before making changes."
  ].join("\n");
}

function getLoginValidationMessage(client: string, alias: string) {
  const normalizedClient = client.trim();
  const normalizedAlias = alias.trim();

  if (!normalizedClient) return "Enter the client name.";
  if (!normalizedAlias) return "Enter an alias.";
  if (/\s/.test(normalizedAlias)) return "Alias cannot contain spaces. Use letters, numbers, dots, hyphens, or underscores.";
  if (!loginAliasPattern.test(normalizedAlias)) return "Use a simple alias with letters, numbers, dots, hyphens, or underscores.";

  return "";
}

function App() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [details, setDetails] = useState<OrgDetails | null>(null);
  const [metadata, setMetadata] = useState<OrgMetadata>(emptyMetadata);
  const [query, setQuery] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState<"All" | Environment>("All");
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "warning" | "error"; text: string } | null>(null);
  const [loginClient, setLoginClient] = useState("");
  const [loginAlias, setLoginAlias] = useState("");
  const [loginUrl, setLoginUrl] = useState("https://login.salesforce.com");
  const [loginError, setLoginError] = useState("");
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ key: "favorite", direction: "desc" });
  const detailsRequestRef = useRef(0);
  const metadataDraftDirtyRef = useRef(false);
  const selectedTargetRef = useRef("");

  const selectedOrg = useMemo(
    () => orgs.find((org) => (org.alias || org.username) === selectedTarget) || null,
    [orgs, selectedTarget]
  );
  const canStartLogin = Boolean(loginClient.trim() && loginAlias.trim()) && busyAction !== "login";

  const filteredOrgs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orgs
      .map((org, index) => ({ org, index }))
      .filter(({ org }) => {
        const matchesEnvironment = environmentFilter === "All" || org.effectiveEnvironment === environmentFilter;
        if (!normalizedQuery) return matchesEnvironment;

        const haystack = [
          org.client,
          org.alias,
          org.username,
          org.orgId,
          org.instanceUrl,
          org.connectedStatus,
          org.riskLevel,
          org.favorite ? "favorite" : ""
        ]
          .join(" ")
          .toLowerCase();

        return matchesEnvironment && haystack.includes(normalizedQuery);
      })
      .sort((left, right) => compareOrgs(left.org, right.org, sortState) || left.index - right.index)
      .map(({ org }) => org);
  }, [environmentFilter, orgs, query, sortState]);

  const stats = useMemo(() => {
    const production = orgs.filter((org) => org.effectiveEnvironment === "Production").length;
    const sandbox = orgs.filter((org) => org.effectiveEnvironment === "Sandbox").length;
    const favorites = orgs.filter((org) => org.favorite).length;
    const connected = orgs.filter((org) => isConnectedStatus(org.connectedStatus)).length;
    return { total: orgs.length, production, sandbox, favorites, connected };
  }, [orgs]);

  const replaceMetadata = useCallback((nextMetadata: OrgMetadata) => {
    metadataDraftDirtyRef.current = false;
    setMetadata(nextMetadata);
  }, []);

  const updateMetadataFromUser = useCallback((nextMetadata: OrgMetadata) => {
    metadataDraftDirtyRef.current = true;
    setMetadata(nextMetadata);
  }, []);

  function updateSort(nextKey: SortKey) {
    setSortState((current) => ({
      key: nextKey,
      direction: current.key === nextKey ? (current.direction === "asc" ? "desc" : "asc") : defaultSortDirection(nextKey)
    }));
  }

  const loadOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const data = await api<ApiResponse<{ orgs: Org[] }>>("/local-api/orgs");
      setOrgs(data.orgs || []);
      if (!data.ok) {
        setNotice({
          type: data.orgs?.length ? "warning" : "error",
          text: data.message || "Unable to list Salesforce CLI orgs."
        });
        return;
      }
      setNotice({ type: "success", text: "Org inventory refreshed." });
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  const loadDetails = useCallback(async (target: string) => {
    if (!target) return;
    const requestId = ++detailsRequestRef.current;
    setLoadingDetails(true);
    setDetails(null);
    try {
      const data = await api<ApiResponse<{ details: OrgDetails }>>(`/local-api/orgs/${encodeURIComponent(target)}`);
      if (requestId !== detailsRequestRef.current || selectedTargetRef.current !== target) {
        return;
      }
      setDetails(data.details);
      const nextMetadata = {
        alias: target,
        client: data.details.client || "",
        environment: data.details.environment || "Unknown",
        riskLevel: data.details.riskLevel || "Medium",
        notes: data.details.notes || "",
        favorite: Boolean(data.details.favorite)
      };
      if (!metadataDraftDirtyRef.current) {
        replaceMetadata(nextMetadata);
      }
      if (!data.ok) {
        setNotice({ type: "warning", text: data.message || "Unable to validate this org right now." });
      }
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      if (requestId === detailsRequestRef.current) {
        setLoadingDetails(false);
      }
    }
  }, [replaceMetadata]);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (!notice) return;
    const timeoutByType = notice.type === "success" ? 3200 : notice.type === "warning" ? 5200 : 0;
    if (!timeoutByType) return;

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, timeoutByType);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    selectedTargetRef.current = selectedTarget;
    if (selectedTarget) {
      void loadDetails(selectedTarget);
    }
  }, [loadDetails, selectedTarget]);

  function selectOrg(org: Org) {
    const target = org.alias || org.username;
    selectedTargetRef.current = target;
    setSelectedTarget(target);
    replaceMetadata({
      alias: target,
      client: org.client || "",
      environment: org.effectiveEnvironment || "Unknown",
      riskLevel: org.riskLevel || "Medium",
      notes: org.notes || "",
      favorite: Boolean(org.favorite)
    });
  }

  async function saveMetadata() {
    setBusyAction("save");
    try {
      const data = await api<ApiResponse<{ org: OrgMetadata }>>("/local-api/orgs/metadata", {
        method: "POST",
        body: JSON.stringify(metadata)
      });
      if (!data.ok) {
        setNotice({ type: "error", text: data.message || "Unable to save the client information." });
        return;
      }
      setNotice({ type: "success", text: "Client information saved." });
      replaceMetadata(data.org);
      await loadOrgs();
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusyAction("");
    }
  }

  async function runAction(action: "open" | "logout" | "reconnect", target: string) {
    if (!target) return;

    if (action === "logout") {
      const confirmed = window.confirm(
        `This will disconnect "${target}" from the local Salesforce CLI only. It will not change Salesforce data. Continue?`
      );
      if (!confirmed) return;
    }

    setBusyAction(action === "reconnect" ? `reconnect:${target}` : action);
    try {
      const data = await api<ApiResponse<{ message: string }>>(`/local-api/actions/${action}`, {
        method: "POST",
        body: JSON.stringify({ target })
      });
      if (!data.ok) {
        setNotice({ type: "error", text: data.message || "Action did not complete." });
        return;
      }
      setNotice({ type: "success", text: data.message || "Action completed." });
      await loadOrgs();
      if (selectedTarget) {
        await loadDetails(selectedTarget);
      }
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusyAction("");
    }
  }

  async function removeOrgFromList(target: string) {
    if (!target) return;

    const confirmed = window.confirm(
      `Remove "${target}" from the local Sales Dex list? This only removes the saved local record and will not change Salesforce data.`
    );
    if (!confirmed) return;

    setBusyAction(`remove:${target}`);
    try {
      const data = await api<ApiResponse<{ message: string }>>("/local-api/orgs/remove", {
        method: "POST",
        body: JSON.stringify({ target })
      });
      if (!data.ok) {
        setNotice({ type: "error", text: data.message || "Unable to remove this org from the list." });
        return;
      }
      setNotice({ type: "success", text: data.message || "Org removed from the list." });
      if (selectedTarget === target) {
        setSelectedTarget("");
        setDetails(null);
        setDetailsModalOpen(false);
        replaceMetadata(emptyMetadata);
      }
      await loadOrgs();
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusyAction("");
    }
  }

  async function toggleFavorite(target: string, favorite: boolean) {
    if (!target) return;
    setBusyAction(`favorite:${target}`);
    try {
      const data = await api<ApiResponse<{ favorite: boolean; message: string }>>("/local-api/orgs/favorite", {
        method: "POST",
        body: JSON.stringify({ target, favorite })
      });
      if (!data.ok) {
        setNotice({ type: "error", text: data.message || "Unable to update favorite." });
        return;
      }
      setNotice({ type: "success", text: data.message || "Favorite updated." });
      setMetadata((current) => (current.alias === target ? { ...current, favorite } : current));
      await loadOrgs();
      if (selectedTarget === target) {
        await loadDetails(target);
      }
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusyAction("");
    }
  }

  async function login() {
    const validationMessage = getLoginValidationMessage(loginClient, loginAlias);
    if (validationMessage) {
      setLoginError(validationMessage);
      return;
    }

    setLoginError("");
    setBusyAction("login");
    try {
      const data = await api<ApiResponse<{ message: string }>>("/local-api/actions/login", {
        method: "POST",
        body: JSON.stringify({ alias: loginAlias.trim(), client: loginClient.trim(), instanceUrl: loginUrl })
      });
      if (!data.ok) {
        setLoginError(data.message || "Login did not complete.");
        return;
      }
      setNotice({ type: "success", text: data.message || "Login completed." });
      setLoginClient("");
      setLoginAlias("");
      setLoginModalOpen(false);
      await loadOrgs();
    } catch (error) {
      setLoginError(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <SalesDexMark />
          <div>
            <h1>Sales Dex</h1>
            <p>Salesforce org command center for teams moving across clients all day.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="connection-chip">
            <span className="pulse" />
            {stats.connected}/{stats.total} connected
          </div>
          <button
            className="button primary"
            onClick={() => {
              setLoginError("");
              setLoginModalOpen(true);
            }}
          >
            <LogIn size={16} />
            New connection
          </button>
          <button className="button secondary" onClick={loadOrgs} disabled={loadingOrgs}>
            <RefreshCw size={16} />
            {loadingOrgs ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {notice && (
        <section className={`notice ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>
            <strong>{noticeTitleByType[notice.type]}</strong>
            {notice.text}
          </span>
          <button className="icon-button" onClick={() => setNotice(null)} aria-label="Close notice">
            <X size={16} />
          </button>
        </section>
      )}

      <section className="summary-grid" aria-label="Org summary">
        <Stat label="Tracked orgs" value={stats.total} />
        <Stat label="Production" value={stats.production} tone="danger" />
        <Stat label="Sandboxes" value={stats.sandbox} tone="ok" />
        <Stat label="Favorites" value={stats.favorites} tone="warning" />
      </section>

      <section className="workspace">
        <div className="main-panel">
          <div className="toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search client, alias, username, Org ID..."
              />
            </label>
            <div className="segmented" aria-label="Environment filter">
              {(["All", "Production", "Sandbox"] as const).map((item) => (
                <button
                  key={item}
                  className={environmentFilter === item ? "active" : ""}
                  onClick={() => setEnvironmentFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <OrgTable
            orgs={filteredOrgs}
            selectedTarget={selectedTarget}
            loading={loadingOrgs}
            onSelect={(org) => {
              selectOrg(org);
              setDetailsModalOpen(true);
            }}
            onOpen={(target) => runAction("open", target)}
            onFavorite={(target, favorite) => toggleFavorite(target, favorite)}
            onLogout={(target) => runAction("logout", target)}
            onReconnect={(target) => runAction("reconnect", target)}
            onRemove={removeOrgFromList}
            onCopyCodexPrompt={(org) => copyText(buildCodexOrgPrompt(org), "Codex prompt")}
            sortState={sortState}
            onSort={updateSort}
            busyAction={busyAction}
          />
        </div>

      </section>

      <Modal title="Org details" icon={<Eye size={18} />} open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)}>
        <DetailsPanel
          details={details}
          selectedOrg={selectedOrg}
          loading={loadingDetails}
          metadata={metadata}
          onMetadataChange={updateMetadataFromUser}
          onSave={saveMetadata}
          onRefresh={() => selectedTarget && loadDetails(selectedTarget)}
          onCopy={copyText}
          onOpen={(target) => runAction("open", target)}
          onFavorite={(target, favorite) => toggleFavorite(target, favorite)}
          onLogout={(target) => runAction("logout", target)}
          onReconnect={(target) => runAction("reconnect", target)}
          onRemove={removeOrgFromList}
          onCopyCodexPrompt={(org) => copyText(buildCodexOrgPrompt(org), "Codex prompt")}
          busyAction={busyAction}
        />
      </Modal>

      <Modal title="New connection" icon={<LogIn size={18} />} open={loginModalOpen} onClose={() => setLoginModalOpen(false)} compact>
        <section className="login-panel">
          <label>
            Client name
            <input
              value={loginClient}
              onChange={(event) => {
                setLoginClient(event.target.value);
                setLoginError("");
              }}
              placeholder="Name"
              required
            />
          </label>
          <label>
            Alias
            <input
              value={loginAlias}
              onChange={(event) => {
                setLoginAlias(event.target.value);
                setLoginError("");
              }}
              placeholder="client-prod"
              required
            />
          </label>
          <label>
            Login URL
            <select value={loginUrl} onChange={(event) => setLoginUrl(event.target.value)}>
              <option value="https://login.salesforce.com">Production</option>
              <option value="https://test.salesforce.com">Sandbox</option>
            </select>
          </label>
          {loginError && (
            <div className="inline-error" role="alert">
              <AlertTriangle size={16} />
              <span>{loginError}</span>
            </div>
          )}
          <button className="button primary full" onClick={login} disabled={!canStartLogin}>
            <LogIn size={16} />
            {busyAction === "login" ? "Waiting for browser login" : "Start login"}
          </button>
        </section>
      </Modal>
    </main>
  );
}

function SalesDexMark() {
  return (
    <div className="salesdex-mark" role="img" aria-label="Sales Dex Salesforce scanner logo">
      <img src={salesDexLogo} alt="" draggable="false" />
    </div>
  );
}

function OrgTable({
  orgs,
  selectedTarget,
  loading,
  busyAction,
  onSelect,
  onOpen,
  onFavorite,
  onLogout,
  onReconnect,
  onRemove,
  onCopyCodexPrompt,
  sortState,
  onSort
}: {
  orgs: Org[];
  selectedTarget: string;
  loading: boolean;
  busyAction: string;
  onSelect: (org: Org) => void;
  onOpen: (target: string) => void;
  onFavorite: (target: string, favorite: boolean) => void;
  onLogout: (target: string) => void;
  onReconnect: (target: string) => void;
  onRemove: (target: string) => void;
  onCopyCodexPrompt: (org: PromptOrgContext) => void;
  sortState: SortState;
  onSort: (key: SortKey) => void;
}) {
  if (loading && orgs.length === 0) {
    return <EmptyState title="Loading orgs" description="Querying the local Salesforce CLI." />;
  }

  if (orgs.length === 0) {
    return (
      <EmptyState
        title="No orgs found"
        description="Use New connection to authenticate a Salesforce org."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {sortableColumns.map((column) => (
              <SortableHeader
                key={column.key}
                columnKey={column.key}
                label={column.label}
                sortState={sortState}
                onSort={onSort}
              />
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((org) => {
            const target = org.alias || org.username;
            const selected = selectedTarget === target;
            const disconnected = isDisconnectedStatus(org.connectedStatus);
            return (
              <tr key={`${org.id}-${target}`} className={selected ? "selected" : ""} onClick={() => onSelect(org)}>
                <td>
                  <strong>{org.client || "Unassigned"}</strong>
                  {org.riskLevel === "High" && (
                    <span className="risk-inline">
                      <ShieldAlert size={13} /> High
                    </span>
                  )}
                </td>
                <td>
                  <code>{org.alias || "-"}</code>
                </td>
                <td className="muted">{org.username || "-"}</td>
                <td className="muted truncate-cell">{org.orgId || "-"}</td>
                <td className="muted url-cell">{org.instanceUrl || "-"}</td>
                <td>
                  <EnvironmentBadge environment={org.effectiveEnvironment} />
                </td>
                <td>
                  <StatusBadge status={org.connectedStatus} />
                </td>
                <td className="muted date-cell">{formatDate(org.lastCliLoginAt)}</td>
                <td>{org.favorite ? <FavoriteBadge /> : <span className="muted">-</span>}</td>
                <td>
                  <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                    {disconnected ? (
                      <>
                        <IconAction
                          label="Remove from list"
                          onClick={() => onRemove(target)}
                          disabled={!target || busyAction === `remove:${target}`}
                          tone="danger"
                        >
                          <X size={15} />
                        </IconAction>
                        <IconAction
                          label="Reconnect"
                          onClick={() => onReconnect(target)}
                          disabled={!target || busyAction === `reconnect:${target}`}
                        >
                          <RefreshCw size={15} />
                        </IconAction>
                      </>
                    ) : (
                      <>
                        <IconAction
                          label="Disconnect org"
                          onClick={() => onLogout(target)}
                          disabled={!target || busyAction === "logout"}
                          tone="danger"
                        >
                          <LogOut size={15} />
                        </IconAction>
                        <IconAction label="Open org" onClick={() => onOpen(target)} disabled={!target || busyAction === "open"}>
                          <DoorOpen size={15} />
                        </IconAction>
                        <IconAction label="Copy Codex prompt" onClick={() => onCopyCodexPrompt(org)} disabled={!target}>
                          <Clipboard size={15} />
                        </IconAction>
                        <IconAction
                          label={org.favorite ? "Remove favorite" : "Add favorite"}
                          onClick={() => onFavorite(target, !org.favorite)}
                          disabled={!target || busyAction === `favorite:${target}`}
                          active={org.favorite}
                        >
                          <Star size={15} fill={org.favorite ? "currentColor" : "none"} />
                        </IconAction>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const sortableColumns: Array<{ key: SortKey; label: string }> = [
  { key: "client", label: "Client" },
  { key: "alias", label: "Alias" },
  { key: "username", label: "Username" },
  { key: "orgId", label: "Org ID" },
  { key: "instanceUrl", label: "Instance URL" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "lastLogin", label: "Last log in at" },
  { key: "favorite", label: "Favorite" }
];

function SortableHeader({
  columnKey,
  label,
  sortState,
  onSort
}: {
  columnKey: SortKey;
  label: string;
  sortState: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sortState.key === columnKey;
  const directionLabel = active ? (sortState.direction === "asc" ? "ascending" : "descending") : "none";
  const Icon = active ? (sortState.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th aria-sort={directionLabel}>
      <button className={`sort-header ${active ? "active" : ""}`} onClick={() => onSort(columnKey)}>
        <span>{label}</span>
        <Icon size={13} />
      </button>
    </th>
  );
}

function DetailsPanel({
  details,
  selectedOrg,
  metadata,
  loading,
  busyAction,
  onMetadataChange,
  onSave,
  onRefresh,
  onCopy,
  onOpen,
  onFavorite,
  onLogout,
  onReconnect,
  onRemove,
  onCopyCodexPrompt
}: {
  details: OrgDetails | null;
  selectedOrg: Org | null;
  metadata: OrgMetadata;
  loading: boolean;
  busyAction: string;
  onMetadataChange: (metadata: OrgMetadata) => void;
  onSave: () => void;
  onRefresh: () => void;
  onCopy: (value: string, label: string) => void;
  onOpen: (target: string) => void;
  onFavorite: (target: string, favorite: boolean) => void;
  onLogout: (target: string) => void;
  onReconnect: (target: string) => void;
  onRemove: (target: string) => void;
  onCopyCodexPrompt: (org: PromptOrgContext) => void;
}) {
  const target = details?.alias || selectedOrg?.alias || selectedOrg?.username || metadata.alias;
  const favorite = Boolean(details?.favorite ?? selectedOrg?.favorite ?? metadata.favorite);
  const disconnected = isDisconnectedStatus(details?.connectedStatus || selectedOrg?.connectedStatus || "");
  const metadataFieldsDisabled = loading;
  const promptOrg = {
    alias: target,
    username: details?.username || selectedOrg?.username || "",
    orgId: details?.orgId || selectedOrg?.orgId || "",
    instanceUrl: details?.instanceUrl || selectedOrg?.instanceUrl || "",
    loginUrl: details?.loginUrl || selectedOrg?.loginUrl || "",
    effectiveEnvironment: details?.environment || selectedOrg?.effectiveEnvironment || metadata.environment,
    connectedStatus: details?.connectedStatus || selectedOrg?.connectedStatus || "",
    client: metadata.client || selectedOrg?.client || "",
    riskLevel: metadata.riskLevel || selectedOrg?.riskLevel || "Medium"
  };

  return (
    <section className="details-panel">
      {loading && <span className="spinner modal-spinner" aria-label="Loading details" />}

      {!target ? (
        <EmptyState title="Select an org" description="Choose a row to validate connection status and edit client information." compact />
      ) : (
        <>
          <div className="modal-grid">
            <div>
              <div className="detail-grid">
                <Detail label="Username" value={details?.username || selectedOrg?.username || "-"} />
                <Detail label="Alias" value={target || "-"} mono />
                <Detail label="Org ID" value={details?.orgId || selectedOrg?.orgId || "-"} mono />
                <Detail label="Instance URL" value={details?.instanceUrl || selectedOrg?.instanceUrl || "-"} />
                <Detail label="Login URL" value={details?.loginUrl || selectedOrg?.loginUrl || "-"} />
                <Detail label="Connected status" value={details?.connectedStatus || selectedOrg?.connectedStatus || "-"} />
                <Detail label="Type" value={details?.environment || selectedOrg?.effectiveEnvironment || "-"} />
                <Detail label="API version" value={details?.apiVersion || "-"} />
              </div>
            </div>

            <form className="metadata-form" onSubmit={(event) => event.preventDefault()}>
              <div className="section-heading">
                <UserRoundCog size={17} />
                <h3>Client information</h3>
              </div>
              <label>
                Client
                <input
                  value={metadata.client}
                  onChange={(event) => onMetadataChange({ ...metadata, client: event.target.value })}
                  placeholder="Name"
                  disabled={metadataFieldsDisabled}
                />
              </label>
              <label>
                Alias
                <input
                  value={metadata.alias}
                  onChange={(event) => onMetadataChange({ ...metadata, alias: event.target.value })}
                  placeholder="client-prod"
                  disabled={metadataFieldsDisabled}
                />
              </label>
              <div className="form-row">
                <label>
                  Environment
                  <select
                    value={metadata.environment}
                    onChange={(event) => onMetadataChange({ ...metadata, environment: event.target.value as Environment })}
                    disabled={metadataFieldsDisabled}
                  >
                    <option value="Production">Production</option>
                    <option value="Sandbox">Sandbox</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </label>
                <label>
                  Risk level
                  <select
                    value={metadata.riskLevel}
                    onChange={(event) => onMetadataChange({ ...metadata, riskLevel: event.target.value as RiskLevel })}
                    disabled={metadataFieldsDisabled}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea
                  value={metadata.notes}
                  onChange={(event) => onMetadataChange({ ...metadata, notes: event.target.value })}
                  placeholder="Example: sensitive production org; confirm client before any deployment."
                  disabled={metadataFieldsDisabled}
                />
              </label>
              <button className="button primary full" onClick={onSave} disabled={!metadata.alias || busyAction === "save" || metadataFieldsDisabled}>
                <Save size={16} />
                Save client information
              </button>
            </form>
          </div>

          <div className="action-strip">
            <button className="button secondary" onClick={() => onCopy(target, "Alias")}>
              <Clipboard size={16} />
              Alias
            </button>
            <button className="button secondary" onClick={() => onCopy(details?.username || selectedOrg?.username || "", "Username")}>
              <Clipboard size={16} />
              Username
            </button>
            <button className="button secondary" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={16} />
              Status
            </button>
            {disconnected ? (
              <>
                <button className="button secondary" onClick={() => onReconnect(target)} disabled={busyAction === `reconnect:${target}`}>
                  <RefreshCw size={16} />
                  Reconnect
                </button>
                <button className="button danger" onClick={() => onRemove(target)} disabled={busyAction === `remove:${target}`}>
                  <X size={16} />
                  Remove from list
                </button>
              </>
            ) : (
              <>
                <button className="button secondary" onClick={() => onOpen(target)} disabled={busyAction === "open"}>
                  <DoorOpen size={16} />
                  Open
                </button>
                <button className="button secondary" onClick={() => onCopyCodexPrompt(promptOrg)} disabled={!target}>
                  <Clipboard size={16} />
                  Codex prompt
                </button>
                <button className="button secondary" onClick={() => onFavorite(target, !favorite)} disabled={busyAction === `favorite:${target}`}>
                  <Star size={16} fill={favorite ? "currentColor" : "none"} />
                  {favorite ? "Unfavorite" : "Favorite"}
                </button>
                <button className="button danger" onClick={() => onLogout(target)} disabled={busyAction === "logout"}>
                  <LogOut size={16} />
                  Disconnect
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Modal({
  open,
  title,
  icon,
  compact = false,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  icon: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const titleId = `${title.toLowerCase().replace(/\s+/g, "-")}-title`;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-card ${compact ? "modal-card-compact" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="panel-heading">
            {icon}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-button modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "ok" | "warning" }) {
  return (
    <div className={`stat ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value || "-"}</strong>
    </div>
  );
}

function EnvironmentBadge({ environment }: { environment: Environment }) {
  return <span className={`badge environment ${environment.toLowerCase()}`}>{environment}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = isDisconnectedStatus(status)
    ? "disconnected"
    : normalized.includes("connect") || normalized.includes("active")
      ? "connected"
      : normalized.includes("expire")
        ? "expired"
        : "unknown";
  return <span className={`badge status ${tone}`}>{status || "Unknown"}</span>;
}

function FavoriteBadge() {
  return (
    <span className="favorite-badge">
      <Star size={13} fill="currentColor" />
      Favorite
    </span>
  );
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <div className={`empty-state ${compact ? "is-compact" : ""}`}>
      <Terminal size={compact ? 22 : 30} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function IconAction({
  label,
  children,
  onClick,
  disabled,
  active = false,
  tone = "default"
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "default" | "danger";
}) {
  const className = ["icon-action", active ? "active" : "", tone === "danger" ? "danger" : ""].filter(Boolean).join(" ");

  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Local API communication failed.");
  }
  return data;
}

async function copyText(value: string, label: string) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  window.dispatchEvent(new CustomEvent("sales-dex-copy", { detail: `${label} copied.` }));
}

window.addEventListener("sales-dex-copy", ((event: CustomEvent<string>) => {
  const root = document.querySelector("#copy-toast");
  if (!root) return;
  root.textContent = event.detail;
  root.classList.add("visible");
  window.setTimeout(() => root.classList.remove("visible"), 1500);
}) as EventListener);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const rootElement = document.getElementById("root") as HTMLElement & { salesDexRoot?: ReturnType<typeof createRoot> };
rootElement.salesDexRoot = rootElement.salesDexRoot || createRoot(rootElement);

rootElement.salesDexRoot.render(
  <React.StrictMode>
    <App />
    <div id="copy-toast" className="copy-toast" role="status" />
  </React.StrictMode>
);
