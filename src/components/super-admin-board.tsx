"use client";

import { useMemo, useState } from "react";

import { formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import { isSchoolAdminRole, ROLE_LABEL } from "@/lib/auth";
import type {
  NotificationItem,
  PlatformSettings,
  SchoolPortfolioItem,
  StaffAccount,
} from "@/lib/types";

interface SuperAdminBoardProps {
  schools: SchoolPortfolioItem[];
  notifications: NotificationItem[];
  accounts: StaffAccount[];
  platformSettings: PlatformSettings;
}

interface CreateSchoolDraft {
  name: string;
  schoolCode: string;
  portalSlug: string;
  plan: string;
  status: SchoolPortfolioItem["status"];
  students: string;
  storageQuotaGb: string;
  renewalDate: string;
  notes: string;
  schoolAdminName: string;
  schoolAdminEmail: string;
}

const BLANK_CREATE_SCHOOL: CreateSchoolDraft = {
  name: "",
  schoolCode: "",
  portalSlug: "",
  plan: "Trial",
  status: "trial",
  students: "0",
  storageQuotaGb: "5",
  renewalDate: "2026-05-31",
  notes: "",
  schoolAdminName: "",
  schoolAdminEmail: "",
};

function schoolStatusTone(status: SchoolPortfolioItem["status"]) {
  if (status === "active") {
    return "status-approved";
  }

  if (status === "trial") {
    return "status-submitted";
  }

  if (status === "expired") {
    return "status-corrections_requested";
  }

  return "status-locked";
}

function addDays(dateText: string, days: number) {
  const base = new Date(dateText);

  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function SuperAdminBoard({
  schools,
  notifications,
  accounts,
  platformSettings,
}: SuperAdminBoardProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SchoolPortfolioItem["status"] | "all">("all");
  const [localSchools, setLocalSchools] = useState(schools);
  const [localAccounts, setLocalAccounts] = useState(accounts);
  const [settings, setSettings] = useState(platformSettings);
  const [createDraft, setCreateDraft] = useState<CreateSchoolDraft>(BLANK_CREATE_SCHOOL);
  const [accountScopeDrafts, setAccountScopeDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      accounts.map((account) => [account.id, (account.grantedSchoolCodes ?? []).join(", ")]),
    ),
  );
  const [feedback, setFeedback] = useState(
    "Platform controls are live. Create schools, update subscriptions, manage school-admin accounts, and save app-wide settings here.",
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const filteredSchools = useMemo(
    () =>
      localSchools.filter((school) => {
        const normalizedQuery = query.trim().toLowerCase();
        const matchesStatus = statusFilter === "all" || school.status === statusFilter;
        const matchesQuery =
          normalizedQuery === "" ||
          school.name.toLowerCase().includes(normalizedQuery) ||
          school.portalSlug.toLowerCase().includes(normalizedQuery) ||
          school.schoolCode.toLowerCase().includes(normalizedQuery);

        return matchesStatus && matchesQuery;
      }),
    [localSchools, query, statusFilter],
  );
  const schoolNameByCode = useMemo(
    () => new Map(localSchools.map((school) => [school.schoolCode, school.name])),
    [localSchools],
  );
  const schoolAdminAccounts = useMemo(
    () =>
      localAccounts.filter(
        (account) => account.schoolCode !== "PLATFORM" && isSchoolAdminRole(account.role),
      ),
    [localAccounts],
  );
  const metrics = useMemo(
    () => ({
      schools: localSchools.length,
      activeSubscriptions: localSchools.filter((school) => school.status === "active").length,
      students: localSchools.reduce((sum, school) => sum + school.students, 0),
      storageUsedGb: localSchools.reduce((sum, school) => sum + school.storageUsedGb, 0),
    }),
    [localSchools],
  );

  function updateLocalSchool<K extends keyof SchoolPortfolioItem>(
    schoolId: string,
    field: K,
    value: SchoolPortfolioItem[K],
  ) {
    setLocalSchools((current) =>
      current.map((school) => (school.id === schoolId ? { ...school, [field]: value } : school)),
    );
  }

  async function saveSchool(schoolId: string, extraUpdates?: Partial<SchoolPortfolioItem>) {
    const school = localSchools.find((item) => item.id === schoolId);

    if (!school) {
      return;
    }

    setBusyKey(`school:${schoolId}`);

    try {
      const response = await fetch(`/api/super-admin/schools/${encodeURIComponent(schoolId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...school,
          ...extraUpdates,
        }),
      });
      const payload = (await response.json()) as { error?: string; school?: SchoolPortfolioItem };

      if (!response.ok || !payload.school) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalSchools((current) =>
        current.map((item) => (item.id === payload.school?.id ? payload.school : item)),
      );
      setFeedback(`${payload.school.name} was updated successfully.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save this school right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function extendSubscription(schoolId: string) {
    const school = localSchools.find((item) => item.id === schoolId);

    if (!school) {
      return;
    }

    const nextRenewalDate = addDays(school.renewalDate, 30);
    updateLocalSchool(schoolId, "renewalDate", nextRenewalDate);
    updateLocalSchool(schoolId, "status", "active");
    await saveSchool(schoolId, {
      renewalDate: nextRenewalDate,
      status: "active",
      notes: `${school.notes} Subscription extended by 30 days on ${new Date().toISOString().slice(0, 10)}.`,
    });
  }

  async function createSchool() {
    if (!settings.allowSchoolOnboarding) {
      setFeedback("School onboarding is currently disabled in platform settings. Re-enable it before creating a new tenant.");
      return;
    }

    setBusyKey("create-school");

    try {
      const response = await fetch("/api/super-admin/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createDraft,
          students: Number(createDraft.students) || 0,
          storageQuotaGb: Number(createDraft.storageQuotaGb) || 5,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        school?: SchoolPortfolioItem;
        account?: StaffAccount;
      };

      if (!response.ok || !payload.school || !payload.account) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalSchools((current) => [...current, payload.school!]);
      setLocalAccounts((current) => [...current, payload.account!]);
      setAccountScopeDrafts((current) => ({ ...current, [payload.account!.id]: "" }));
      setCreateDraft(BLANK_CREATE_SCHOOL);
      setFeedback(
        `${payload.school.name} was created with ${payload.account.fullName} as the school admin. Default password: Admin@123.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not create the school right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function savePlatformSettings() {
    setBusyKey("platform-settings");

    try {
      const response = await fetch("/api/super-admin/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          updatedAt: new Date().toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string; settings?: PlatformSettings };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setSettings(payload.settings);
      setFeedback("Platform settings saved. App-wide switches now reflect the latest super-admin decision.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save platform settings.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveSchoolAdminAccount(accountId: string, nextStatus?: StaffAccount["status"]) {
    const account = localAccounts.find((item) => item.id === accountId);

    if (!account) {
      return;
    }

    setBusyKey(`account:${accountId}`);

    try {
      const grantedSchoolCodes = (accountScopeDrafts[accountId] ?? "")
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      const response = await fetch(`/api/super-admin/staff-accounts/${encodeURIComponent(accountId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus ?? account.status,
          grantedSchoolCodes,
        }),
      });
      const payload = (await response.json()) as { error?: string; account?: StaffAccount };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalAccounts((current) =>
        current.map((item) => (item.id === payload.account?.id ? payload.account : item)),
      );
      setAccountScopeDrafts((current) => ({
        ...current,
        [payload.account!.id]: (payload.account!.grantedSchoolCodes ?? []).join(", "),
      }));
      setFeedback(
        `${payload.account.fullName} is now ${resultStatusLabel(payload.account.status).toLowerCase()} with access to ${
          payload.account.grantedSchoolCodes?.length
            ? payload.account.grantedSchoolCodes.join(", ")
            : "their primary school only"
        }.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update this school-admin account.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <section className="surface-card">
        <div className="callout-banner">
          <strong>{feedback}</strong>
          <p className="muted">
            Schools, subscriptions, school-admin status, granted cross-school scope, and platform switches now save as live platform data.
          </p>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-label">Schools</p>
          <h3>{metrics.schools}</h3>
          <p className="muted">Managed tenants</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Active subscriptions</p>
          <h3>{metrics.activeSubscriptions}</h3>
          <p className="muted">Currently billable schools</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Students</p>
          <h3>{metrics.students}</h3>
          <p className="muted">Across all schools</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Storage used</p>
          <h3>{metrics.storageUsedGb.toFixed(1)} GB</h3>
          <p className="muted">Across all tenant schools</p>
        </article>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Platform Controls</p>
              <h3>App-wide switches and owner broadcast</h3>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={busyKey === "platform-settings"}
              onClick={() => void savePlatformSettings()}
            >
              {busyKey === "platform-settings" ? "Saving..." : "Save platform settings"}
            </button>
          </div>
          <div className="stack-list">
            <label className="comparison-card">
              <span>Maintenance mode</span>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    maintenanceMode: event.target.checked,
                  }))
                }
              />
            </label>
            <label className="comparison-card">
              <span>Allow school onboarding</span>
              <input
                type="checkbox"
                checked={settings.allowSchoolOnboarding}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    allowSchoolOnboarding: event.target.checked,
                  }))
                }
              />
            </label>
            <label className="comparison-card">
              <span>Allow student portal access</span>
              <input
                type="checkbox"
                checked={settings.allowPortalAccess}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    allowPortalAccess: event.target.checked,
                  }))
                }
              />
            </label>
            <label>
              Support email
              <input
                value={settings.supportEmail}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    supportEmail: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Owner broadcast
              <textarea
                value={settings.ownerBroadcast}
                rows={4}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    ownerBroadcast: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Create School</p>
              <h3>Provision a new tenant and its school-admin login</h3>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={busyKey === "create-school" || !settings.allowSchoolOnboarding}
              onClick={() => void createSchool()}
            >
              {busyKey === "create-school" ? "Creating..." : "Create school"}
            </button>
          </div>
          <div className="grid-layout two-wide">
            <label>
              School name
              <input
                value={createDraft.name}
                onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              School code
              <input
                value={createDraft.schoolCode}
                onChange={(event) => setCreateDraft((current) => ({ ...current, schoolCode: event.target.value }))}
              />
            </label>
            <label>
              Portal slug
              <input
                value={createDraft.portalSlug}
                onChange={(event) => setCreateDraft((current) => ({ ...current, portalSlug: event.target.value }))}
              />
            </label>
            <label>
              Plan
              <input
                value={createDraft.plan}
                onChange={(event) => setCreateDraft((current) => ({ ...current, plan: event.target.value }))}
              />
            </label>
            <label>
              Status
              <select
                value={createDraft.status}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    status: event.target.value as SchoolPortfolioItem["status"],
                  }))
                }
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <label>
              Students
              <input
                type="number"
                min={0}
                value={createDraft.students}
                onChange={(event) => setCreateDraft((current) => ({ ...current, students: event.target.value }))}
              />
            </label>
            <label>
              Storage quota (GB)
              <input
                type="number"
                min={1}
                step="0.1"
                value={createDraft.storageQuotaGb}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, storageQuotaGb: event.target.value }))
                }
              />
            </label>
            <label>
              Renewal date
              <input
                type="date"
                value={createDraft.renewalDate}
                onChange={(event) => setCreateDraft((current) => ({ ...current, renewalDate: event.target.value }))}
              />
            </label>
            <label>
              School-admin name
              <input
                value={createDraft.schoolAdminName}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, schoolAdminName: event.target.value }))
                }
              />
            </label>
            <label>
              School-admin email
              <input
                type="email"
                value={createDraft.schoolAdminEmail}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, schoolAdminEmail: event.target.value }))
                }
              />
            </label>
          </div>
          <label>
            Provisioning note
            <textarea
              value={createDraft.notes}
              rows={3}
              onChange={(event) => setCreateDraft((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
        </article>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">School Portfolio</p>
            <h3>Live tenant schools, subscription state, and follow-up notes</h3>
          </div>
        </div>

        <div className="toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by school, code, or portal slug"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as SchoolPortfolioItem["status"] | "all")}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="card-grid">
          {filteredSchools.map((school) => {
            const schoolAdminAccount = schoolAdminAccounts.find(
              (account) => account.schoolCode === school.schoolCode,
            );

            return (
              <article key={school.id} className="leader-card feature">
                <div className="audit-header">
                  <div>
                    <strong>{school.name}</strong>
                    <p className="muted">
                      {school.schoolCode} - {school.portalSlug}
                    </p>
                  </div>
                  <span className={`status-pill ${schoolStatusTone(school.status)}`}>
                    {resultStatusLabel(school.status)}
                  </span>
                </div>

                <div className="grid-layout two-wide">
                  <label>
                    Plan
                    <input
                      value={school.plan}
                      onChange={(event) => updateLocalSchool(school.id, "plan", event.target.value)}
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={school.status}
                      onChange={(event) =>
                        updateLocalSchool(
                          school.id,
                          "status",
                          event.target.value as SchoolPortfolioItem["status"],
                        )
                      }
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                  <label>
                    Students
                    <input
                      type="number"
                      min={0}
                      value={school.students}
                      onChange={(event) =>
                        updateLocalSchool(school.id, "students", Number(event.target.value) || 0)
                      }
                    />
                  </label>
                  <label>
                    Storage used (GB)
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={school.storageUsedGb}
                      onChange={(event) =>
                        updateLocalSchool(school.id, "storageUsedGb", Number(event.target.value) || 0)
                      }
                    />
                  </label>
                  <label>
                    Storage quota (GB)
                    <input
                      type="number"
                      min={1}
                      step="0.1"
                      value={school.storageQuotaGb}
                      onChange={(event) =>
                        updateLocalSchool(school.id, "storageQuotaGb", Number(event.target.value) || 1)
                      }
                    />
                  </label>
                  <label>
                    Renewal date
                    <input
                      type="date"
                      value={school.renewalDate}
                      onChange={(event) => updateLocalSchool(school.id, "renewalDate", event.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Follow-up note
                  <textarea
                    rows={3}
                    value={school.notes}
                    onChange={(event) => updateLocalSchool(school.id, "notes", event.target.value)}
                  />
                </label>

                <div className="stack-list compact">
                  <div className="comparison-card">
                    <span>Last follow-up</span>
                    <strong>{formatDateOnly(school.lastFollowUpAt)}</strong>
                  </div>
                  <div className="comparison-card">
                    <span>School admin</span>
                    <strong>
                      {schoolAdminAccount
                        ? `${schoolAdminAccount.fullName} (${resultStatusLabel(schoolAdminAccount.status)})`
                        : "Not provisioned yet"}
                    </strong>
                  </div>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busyKey === `school:${school.id}`}
                    onClick={() => void extendSubscription(school.id)}
                  >
                    Extend +30 days
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busyKey === `school:${school.id}`}
                    onClick={() =>
                      void saveSchool(school.id, {
                        status: school.status === "suspended" ? "active" : "suspended",
                      })
                    }
                  >
                    {school.status === "suspended" ? "Reactivate school" : "Suspend school"}
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busyKey === `school:${school.id}`}
                    onClick={() => void saveSchool(school.id)}
                  >
                    {busyKey === `school:${school.id}` ? "Saving..." : "Save school"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">School Admin Control</p>
            <h3>Role separation, account status, and cross-school access exceptions</h3>
          </div>
        </div>
        <div className="card-grid">
          {schoolAdminAccounts.map((account) => (
            <article key={account.id} className="leader-card feature">
              <div className="audit-header">
                <div>
                  <strong>{account.fullName}</strong>
                  <p className="muted">{account.email}</p>
                </div>
                <span
                  className={`status-pill ${
                    account.status === "active" ? "status-approved" : "status-locked"
                  }`}
                >
                  {resultStatusLabel(account.status)}
                </span>
              </div>

              <p>
                {ROLE_LABEL[account.role]} for {schoolNameByCode.get(account.schoolCode) ?? account.schoolCode}
              </p>
              <p className="muted">Primary school scope: {account.schoolCode}</p>

              <label>
                Extra school access
                <input
                  value={accountScopeDrafts[account.id] ?? ""}
                  placeholder="Comma-separated school codes"
                  onChange={(event) =>
                    setAccountScopeDrafts((current) => ({
                      ...current,
                      [account.id]: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyKey === `account:${account.id}`}
                  onClick={() =>
                    void saveSchoolAdminAccount(
                      account.id,
                      account.status === "active" ? "disabled" : "active",
                    )
                  }
                >
                  {account.status === "active" ? "Disable account" : "Reactivate account"}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={busyKey === `account:${account.id}`}
                  onClick={() => void saveSchoolAdminAccount(account.id)}
                >
                  {busyKey === `account:${account.id}` ? "Saving..." : "Save scope"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Owner Activity</p>
            <h3>Recent support, billing, and publication signals</h3>
          </div>
        </div>
        <div className="timeline">
          {notifications.map((item) => (
            <article key={item.id} className="timeline-item">
              <strong>{item.title}</strong>
              <p>{item.message}</p>
              <span>
                {item.audience} - {formatDateOnly(item.timestamp)}
              </span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
