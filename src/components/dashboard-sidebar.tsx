"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { logoutAction } from "@/app/login/actions";

interface NavigationItem {
  href: string;
  label: string;
  caption?: string;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

interface DashboardSidebarProps {
  activeHref: string;
  sections: NavigationSection[];
  brandEyebrow: string;
  brandTitle: string;
  brandCaption: string;
  brandLogoUrl: string;
  brandName: string;
  displayName: string;
  initials: string;
  roleLabel: string;
  userPhotoUrl?: string;
}

const SIDEBAR_SCROLL_KEY = "ope-dashboard-sidebar-scroll-top";
const SIDEBAR_OPEN_STATE_KEY = "ope-dashboard-sidebar-open-state";

function normalizeNavHref(href: string) {
  return href.split("#")[0]?.split("?")[0] ?? href;
}

function buildDefaultOpenState(sections: NavigationSection[], activeHref: string) {
  return Object.fromEntries(
    sections
      .filter((section) => section.items.length > 1)
      .map((section) => [
        section.label,
        section.items.some((item) => normalizeNavHref(item.href) === activeHref),
      ]),
  ) as Record<string, boolean>;
}

export function DashboardSidebar({
  activeHref,
  sections,
  brandEyebrow,
  brandTitle,
  brandCaption,
  brandLogoUrl,
  brandName,
  displayName,
  initials,
  roleLabel,
  userPhotoUrl,
}: DashboardSidebarProps) {
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    buildDefaultOpenState(sections, activeHref),
  );

  useEffect(() => {
    const defaults = buildDefaultOpenState(sections, activeHref);
    const savedStateRaw = window.sessionStorage.getItem(SIDEBAR_OPEN_STATE_KEY);

    if (!savedStateRaw) {
      setOpenSections(defaults);
      return;
    }

    try {
      const savedState = JSON.parse(savedStateRaw) as Record<string, boolean>;
      const mergedState = { ...savedState };

      Object.entries(defaults).forEach(([sectionLabel, shouldBeOpen]) => {
        if (shouldBeOpen) {
          mergedState[sectionLabel] = true;
        } else if (!(sectionLabel in mergedState)) {
          mergedState[sectionLabel] = false;
        }
      });

      setOpenSections(mergedState);
    } catch {
      setOpenSections(defaults);
    }
  }, [activeHref, sections]);

  useEffect(() => {
    window.sessionStorage.setItem(SIDEBAR_OPEN_STATE_KEY, JSON.stringify(openSections));
  }, [openSections]);

  useEffect(() => {
    const sidebar = sidebarRef.current;

    if (!sidebar) {
      return;
    }

    const savedScrollTop = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? "0");

    if (savedScrollTop > 0) {
      requestAnimationFrame(() => {
        if (sidebarRef.current) {
          sidebarRef.current.scrollTop = savedScrollTop;
        }
      });
    }
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className="sidebar"
      onScroll={(event) => {
        window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(event.currentTarget.scrollTop));
      }}
    >
      <div className="brand-card">
        <div className="brand-mark image-brand-mark">
          <img src={brandLogoUrl} alt={`${brandName} logo`} className="brand-image" />
        </div>
        <div>
          <p className="eyebrow">{brandEyebrow}</p>
          <h1>{brandTitle}</h1>
          <p className="muted">{brandCaption}</p>
        </div>
      </div>

      <nav className="nav-list" aria-label="Primary">
        {sections.map((section) =>
          section.items.length === 1 ? (
            <div key={section.label} className="nav-section">
              <p className="nav-section-title">{section.label}</p>
              <div className="nav-section-items">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={normalizeNavHref(item.href) === activeHref ? "nav-item active" : "nav-item"}
                  >
                    <span className="nav-item-label">{item.label}</span>
                    {item.caption ? <span className="nav-item-caption">{item.caption}</span> : null}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <section
              key={section.label}
              className={openSections[section.label] ? "nav-dropdown open" : "nav-dropdown"}
            >
              <button
                type="button"
                className="nav-dropdown-summary"
                aria-expanded={openSections[section.label] ? "true" : "false"}
                onClick={() =>
                  setOpenSections((current) => ({
                    ...current,
                    [section.label]: !current[section.label],
                  }))
                }
              >
                <span className="nav-dropdown-label">{section.label}</span>
                <span className="nav-section-badge">{section.items.length}</span>
              </button>
              {openSections[section.label] ? (
                <div className="nav-section-items nav-dropdown-items">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={normalizeNavHref(item.href) === activeHref ? "nav-item active" : "nav-item"}
                    >
                      <span className="nav-item-label">{item.label}</span>
                      {item.caption ? <span className="nav-item-caption">{item.caption}</span> : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ),
        )}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-id">
          <span className={userPhotoUrl ? "sidebar-avatar image" : "sidebar-avatar"}>
            {userPhotoUrl ? <img src={userPhotoUrl} alt={`${displayName} profile`} className="sidebar-avatar-image" /> : initials || "U"}
          </span>
          <div>
            <strong>{displayName}</strong>
            <span className="muted">{roleLabel}</span>
          </div>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="secondary-button sidebar-signout">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
