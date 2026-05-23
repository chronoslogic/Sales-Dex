import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Cloud,
  DoorOpen,
  Eye,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Terminal,
  UserRoundCog,
  X
} from "lucide-react";
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
  localLastUsedAt: string;
  isDefault: boolean;
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
};

type OrgMetadata = {
  alias: string;
  client: string;
  environment: Environment;
  riskLevel: RiskLevel;
  notes: string;
};

type ApiResponse<T> = T & {
  ok: boolean;
  message?: string;
};

const emptyMetadata: OrgMetadata = {
  alias: "",
  client: "",
  environment: "Unknown",
  riskLevel: "Medium",
  notes: ""
};

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
  const [loginAlias, setLoginAlias] = useState("");
  const [loginUrl, setLoginUrl] = useState("https://login.salesforce.com");
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const selectedOrg = useMemo(
    () => orgs.find((org) => (org.alias || org.username) === selectedTarget) || null,
    [orgs, selectedTarget]
  );

  const filteredOrgs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orgs.filter((org) => {
      const matchesEnvironment = environmentFilter === "All" || org.effectiveEnvironment === environmentFilter;
      if (!normalizedQuery) return matchesEnvironment;

      const haystack = [
        org.client,
        org.alias,
        org.username,
        org.orgId,
        org.instanceUrl,
        org.connectedStatus,
        org.riskLevel
      ]
        .join(" ")
        .toLowerCase();

      return matchesEnvironment && haystack.includes(normalizedQuery);
    });
  }, [environmentFilter, orgs, query]);

  const stats = useMemo(() => {
    const production = orgs.filter((org) => org.effectiveEnvironment === "Production").length;
    const sandbox = orgs.filter((org) => org.effectiveEnvironment === "Sandbox").length;
    const highRisk = orgs.filter((org) => org.riskLevel === "High").length;
    const connected = orgs.filter((org) => org.connectedStatus.toLowerCase().includes("connect")).length;
    return { total: orgs.length, production, sandbox, highRisk, connected };
  }, [orgs]);

  const loadOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const data = await api<ApiResponse<{ orgs: Org[] }>>("/local-api/orgs");
      setOrgs(data.orgs || []);
      if (!data.ok) {
        setNotice({ type: "error", text: data.message || "Unable to list Salesforce CLI orgs." });
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
    setLoadingDetails(true);
    setDetails(null);
    try {
      const data = await api<ApiResponse<{ details: OrgDetails }>>(`/local-api/orgs/${encodeURIComponent(target)}`);
      setDetails(data.details);
      setMetadata({
        alias: target,
        client: data.details.client || "",
        environment: data.details.environment || "Unknown",
        riskLevel: data.details.riskLevel || "Medium",
        notes: data.details.notes || ""
      });
      if (!data.ok) {
        setNotice({ type: "warning", text: data.message || "Unable to validate this org right now." });
      }
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (selectedTarget) {
      void loadDetails(selectedTarget);
    }
  }, [loadDetails, selectedTarget]);

  function selectOrg(org: Org) {
    const target = org.alias || org.username;
    setSelectedTarget(target);
    setMetadata({
      alias: target,
      client: org.client || "",
      environment: org.effectiveEnvironment || "Unknown",
      riskLevel: org.riskLevel || "Medium",
      notes: org.notes || ""
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
      await loadOrgs();
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusyAction("");
    }
  }

  async function runAction(action: "open" | "default" | "logout", target: string) {
    if (!target) return;

    if (action === "logout") {
      const confirmed = window.confirm(
        `This will disconnect "${target}" from the local Salesforce CLI only. It will not change Salesforce data. Continue?`
      );
      if (!confirmed) return;
    }

    const actionOrg = orgs.find((org) => (org.alias || org.username) === target) || selectedOrg;

    if (action === "default" && actionOrg?.effectiveEnvironment === "Production") {
      const confirmed = window.confirm(
        `You are setting a production org as the default target: ${target}. Confirm this is the correct client before continuing.`
      );
      if (!confirmed) return;
    }

    setBusyAction(action);
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

  async function login() {
    setBusyAction("login");
    try {
      const data = await api<ApiResponse<{ message: string }>>("/local-api/actions/login", {
        method: "POST",
        body: JSON.stringify({ alias: loginAlias, instanceUrl: loginUrl })
      });
      if (!data.ok) {
        setNotice({ type: "error", text: data.message || "Login did not complete." });
        return;
      }
      setNotice({ type: "success", text: data.message || "Login completed." });
      setLoginAlias("");
      setLoginModalOpen(false);
      await loadOrgs();
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
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
            <p>AI-ready Salesforce org command center for teams moving across clients all day.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="connection-chip">
            <span className="pulse" />
            {stats.connected}/{stats.total} connected
          </div>
          <button className="button primary" onClick={() => setLoginModalOpen(true)}>
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
        <section className={`notice ${notice.type}`} role="status">
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notice.text}</span>
          <button className="icon-button" onClick={() => setNotice(null)} aria-label="Close notice">
            <X size={16} />
          </button>
        </section>
      )}

      <section className="summary-grid" aria-label="Org summary">
        <Stat label="Connected orgs" value={stats.total} />
        <Stat label="Production" value={stats.production} tone="danger" />
        <Stat label="Sandboxes" value={stats.sandbox} tone="ok" />
        <Stat label="High risk" value={stats.highRisk} tone="warning" />
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
            onCopy={copyText}
            onOpen={(target) => runAction("open", target)}
            onDefault={(target) => runAction("default", target)}
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
          onMetadataChange={setMetadata}
          onSave={saveMetadata}
          onRefresh={() => selectedTarget && loadDetails(selectedTarget)}
          onCopy={copyText}
          onOpen={(target) => runAction("open", target)}
          onDefault={(target) => runAction("default", target)}
          onLogout={(target) => runAction("logout", target)}
          busyAction={busyAction}
        />
      </Modal>

      <Modal title="New connection" icon={<LogIn size={18} />} open={loginModalOpen} onClose={() => setLoginModalOpen(false)} compact>
        <section className="login-panel">
          <label>
            Alias
            <input value={loginAlias} onChange={(event) => setLoginAlias(event.target.value)} placeholder="client-prod" />
          </label>
          <label>
            Login URL
            <select value={loginUrl} onChange={(event) => setLoginUrl(event.target.value)}>
              <option value="https://login.salesforce.com">Production</option>
              <option value="https://test.salesforce.com">Sandbox</option>
            </select>
          </label>
          <button className="button primary full" onClick={login} disabled={!loginAlias || busyAction === "login"}>
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
    <div className="salesdex-mark" aria-label="Sales Dex">
      <div className="mark-cloud">
        <Cloud size={34} />
        <span>SF</span>
      </div>
      <div className="mark-core">
        <Sparkles size={18} />
      </div>
    </div>
  );
}

function OrgTable({
  orgs,
  selectedTarget,
  loading,
  busyAction,
  onSelect,
  onCopy,
  onOpen,
  onDefault
}: {
  orgs: Org[];
  selectedTarget: string;
  loading: boolean;
  busyAction: string;
  onSelect: (org: Org) => void;
  onCopy: (value: string, label: string) => void;
  onOpen: (target: string) => void;
  onDefault: (target: string) => void;
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
            <th>Client</th>
            <th>Alias</th>
            <th>Username</th>
            <th>Org ID</th>
            <th>Instance URL</th>
            <th>Type</th>
            <th>Status</th>
            <th>Last log in at</th>
            <th>Default</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((org) => {
            const target = org.alias || org.username;
            const selected = selectedTarget === target;
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
                <td className="muted date-cell">{formatDate(org.localLastUsedAt || org.lastUsed)}</td>
                <td>{org.isDefault ? <DefaultBadge /> : <span className="muted">-</span>}</td>
                <td>
                  <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                    <IconAction label="Copy alias" onClick={() => onCopy(target, "Alias")} disabled={!target}>
                      <Clipboard size={15} />
                    </IconAction>
                    <IconAction label="Open org" onClick={() => onOpen(target)} disabled={!target || busyAction === "open"}>
                      <DoorOpen size={15} />
                    </IconAction>
                    <IconAction label="Set default" onClick={() => onDefault(target)} disabled={!target || busyAction === "default"}>
                      <Star size={15} />
                    </IconAction>
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
  onDefault,
  onLogout
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
  onDefault: (target: string) => void;
  onLogout: (target: string) => void;
}) {
  const target = details?.alias || selectedOrg?.alias || selectedOrg?.username || metadata.alias;

  return (
    <section className="details-panel">
      {loading && <span className="spinner modal-spinner" aria-label="Loading details" />}

      {!target ? (
        <EmptyState title="Select an org" description="Choose a row to validate connection status and edit client information." compact />
      ) : (
        <>
          <div className="modal-grid">
            <div>
              <div className="section-heading">
                <Eye size={17} />
                <h3>Org details</h3>
              </div>
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
                />
              </label>
              <label>
                Alias
                <input
                  value={metadata.alias}
                  onChange={(event) => onMetadataChange({ ...metadata, alias: event.target.value })}
                  placeholder="client-prod"
                />
              </label>
              <div className="form-row">
                <label>
                  Environment
                  <select
                    value={metadata.environment}
                    onChange={(event) => onMetadataChange({ ...metadata, environment: event.target.value as Environment })}
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
                />
              </label>
              <button className="button primary full" onClick={onSave} disabled={!metadata.alias || busyAction === "save"}>
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
            <button className="button secondary" onClick={() => onOpen(target)} disabled={busyAction === "open"}>
              <DoorOpen size={16} />
              Open
            </button>
            <button className="button secondary" onClick={() => onDefault(target)} disabled={busyAction === "default"}>
              <Star size={16} />
              Default
            </button>
            <button className="button secondary" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={16} />
              Status
            </button>
            <button className="button danger" onClick={() => onLogout(target)} disabled={busyAction === "logout"}>
              <LogOut size={16} />
              Disconnect
            </button>
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
  const tone = normalized.includes("connect") || normalized.includes("active") ? "connected" : normalized.includes("expire") ? "expired" : "unknown";
  return <span className={`badge status ${tone}`}>{status || "Unknown"}</span>;
}

function DefaultBadge() {
  return (
    <span className="default-badge">
      <Star size={13} />
      Default
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
  disabled
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="icon-action" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
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
