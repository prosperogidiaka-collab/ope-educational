"use client";

import { useMemo, useState } from "react";

import { formatDate, isExpired } from "@/lib/calculations";
import type { Coupon, StudentSummary } from "@/lib/types";

interface CouponManagerProps {
  coupons: Coupon[];
  students: StudentSummary[];
  canManage?: boolean;
}

function generateCouponCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function CouponManager({ coupons, students, canManage = true }: CouponManagerProps) {
  const [inventory, setInventory] = useState(coupons);
  const [regNumber, setRegNumber] = useState(students[0]?.bundle.student.regNumber ?? "");
  const [maxViews, setMaxViews] = useState(3);
  const studentByRegNumber = useMemo(
    () =>
      new Map(
        students.map((student) => [student.bundle.student.regNumber, student.bundle.student.fullName]),
      ),
    [students],
  );

  const totals = useMemo(
    () => ({
      active: inventory.filter((coupon) => coupon.active && !isExpired(coupon.expiresAt)).length,
      exhausted: inventory.filter((coupon) => coupon.usedViews >= coupon.maxViews).length,
      expiring: inventory.filter((coupon) => isExpired(coupon.expiresAt)).length,
      suspicious: inventory.filter((coupon) => coupon.failedAttempts >= 3).length,
    }),
    [inventory],
  );

  function createCoupon() {
    if (!canManage || !regNumber) {
      return;
    }

    setInventory((current) => [
      {
        id: `coupon_${current.length + 1}`,
        regNumber,
        code: generateCouponCode(),
        session: current[0]?.session ?? "Current Session",
        term: current[0]?.term ?? "Current Term",
        maxViews,
        usedViews: 0,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
        active: true,
        failedAttempts: 0,
      },
      ...current,
    ]);
  }

  function toggleCoupon(id: string) {
    if (!canManage) {
      return;
    }

    setInventory((current) =>
      current.map((coupon) =>
        coupon.id === id
          ? {
              ...coupon,
              active: !coupon.active,
              revokedReason: coupon.active ? "Revoked manually by admin." : undefined,
            }
          : coupon,
      ),
    );
  }

  function simulateView(id: string) {
    if (!canManage) {
      return;
    }

    setInventory((current) =>
      current.map((coupon) =>
        coupon.id === id && coupon.usedViews < coupon.maxViews
          ? { ...coupon, usedViews: coupon.usedViews + 1 }
          : coupon,
      ),
    );
  }

  function regenerateCoupon(id: string) {
    if (!canManage) {
      return;
    }

    setInventory((current) =>
      current.map((coupon) =>
        coupon.id === id
          ? {
              ...coupon,
              code: generateCouponCode(),
              usedViews: 0,
              failedAttempts: 0,
              active: true,
            }
          : coupon,
      ),
    );
  }

  return (
    <div className="grid-layout two-wide">
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Coupon Engine</p>
            <h3>Generate portal access codes</h3>
          </div>
        </div>

        <div className="callout-banner">
          <strong>
            {canManage
              ? "Coupon controls are active for this account."
              : "Coupon details are visible here, but coupon issuance and revocation are restricted to the school admin."}
          </strong>
        </div>

        <div className="inline-metrics">
          <div>
            <span>Active codes</span>
            <strong>{totals.active}</strong>
          </div>
          <div>
            <span>Exhausted codes</span>
            <strong>{totals.exhausted}</strong>
          </div>
          <div>
            <span>Expired codes</span>
            <strong>{totals.expiring}</strong>
          </div>
          <div>
            <span>Suspicious access</span>
            <strong>{totals.suspicious}</strong>
          </div>
        </div>

        <div className="form-grid">
          <label>
            <span>Student</span>
            <select value={regNumber} onChange={(event) => setRegNumber(event.target.value)}>
              {students.map((student) => (
                <option key={student.bundle.student.regNumber} value={student.bundle.student.regNumber}>
                  {student.bundle.student.fullName} ({student.bundle.student.regNumber})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Max views</span>
            <input
              type="number"
              min={1}
              max={10}
              value={maxViews}
              onChange={(event) => setMaxViews(Number(event.target.value) || 1)}
              disabled={!canManage}
            />
          </label>
        </div>

        <button type="button" className="primary-button" onClick={createCoupon} disabled={!canManage}>
          Generate secure coupon
        </button>
      </section>

      <section className="surface-card span-two">
        <div className="section-head">
          <div>
            <p className="eyebrow">Inventory</p>
            <h3>Issued coupon codes</h3>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Code</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((coupon) => {
                const exhausted = coupon.usedViews >= coupon.maxViews;
                const expired = isExpired(coupon.expiresAt);

                return (
                  <tr key={coupon.id}>
                    <td>
                      <strong>{studentByRegNumber.get(coupon.regNumber) ?? "Student record"}</strong>
                      <p className="muted">{coupon.regNumber}</p>
                    </td>
                    <td>{coupon.code}</td>
                    <td>
                      <span
                        className={
                          expired || exhausted || !coupon.active || coupon.failedAttempts >= 3
                            ? "status-pill status-flagged"
                            : "status-pill status-approved"
                        }
                      >
                        {expired
                          ? "expired"
                          : exhausted
                            ? "exhausted"
                            : coupon.failedAttempts >= 3
                              ? "risk"
                              : coupon.active
                                ? "active"
                                : "disabled"}
                      </span>
                    </td>
                    <td>
                      <details className="table-disclosure">
                        <summary className="table-disclosure-summary">Open coupon details</summary>
                        <div className="disclosure-grid">
                          <div className="key-value-grid">
                            <div className="key-value-card">
                              <span>Session</span>
                              <strong>{coupon.session}</strong>
                            </div>
                            <div className="key-value-card">
                              <span>Term</span>
                              <strong>{coupon.term}</strong>
                            </div>
                            <div className="key-value-card">
                              <span>Usage</span>
                              <strong>
                                {coupon.usedViews} / {coupon.maxViews}
                              </strong>
                            </div>
                            <div className="key-value-card">
                              <span>Failed attempts</span>
                              <strong>{coupon.failedAttempts}</strong>
                            </div>
                            <div className="key-value-card">
                              <span>Expiry</span>
                              <strong>{formatDate(coupon.expiresAt)}</strong>
                            </div>
                            <div className="key-value-card">
                              <span>Revocation note</span>
                              <strong>{coupon.revokedReason ?? "No revocation note"}</strong>
                            </div>
                          </div>
                          <div className="button-row">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => toggleCoupon(coupon.id)}
                              disabled={!canManage}
                            >
                              {coupon.active ? "Revoke" : "Restore"}
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => simulateView(coupon.id)}
                              disabled={!canManage}
                            >
                              Simulate view
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => regenerateCoupon(coupon.id)}
                              disabled={!canManage}
                            >
                              Regenerate
                            </button>
                          </div>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
