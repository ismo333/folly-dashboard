"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { FOLLY_PRODUCTIONS_URL } from "@/lib/links";

// Mirrors the section menu on follyproductions.com, with What's On added.
const SITE_SECTIONS = [
  { id: "hero", title: "Home" },
  { id: "in-development", title: "In Development" },
  { id: "about", title: "About" },
  { id: "archive", title: "Recent Work" },
  { id: "profile", title: "Team" },
  { id: "contact", title: "Contact" }
];

export type MenuAction = { label: string; onSelect: () => void };

export function SiteHeader({
  className = "",
  actions,
  menuActions = []
}: {
  className?: string;
  actions?: ReactNode;
  menuActions?: MenuAction[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className={`site-header ${className}`}>
      <div className="site-brand">
        <a className="site-lockup-link" href={FOLLY_PRODUCTIONS_URL} aria-label="Folly Productions website">
          <span className="site-lockup" aria-hidden="true" />
        </a>
        <span className="site-section-title">/ What’s On</span>
      </div>
      <div className="site-header-end">
        {actions}
        <button
          type="button"
          className="site-menu-button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <div className="site-menu" role="dialog" aria-modal="true" aria-label="Folly menu">
          <button
            type="button"
            className="site-menu-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>
          <nav>
            <ul>
              {SITE_SECTIONS.map((section) => (
                <li key={section.id}>
                  <a href={`${FOLLY_PRODUCTIONS_URL}#${section.id}`}>{section.title}</a>
                </li>
              ))}
              <li>
                <Link href="/" className="active" aria-current="page" onClick={() => setMenuOpen(false)}>
                  What’s On
                </Link>
              </li>
            </ul>
            {menuActions.length > 0 && (
              <div className="site-menu-actions">
                {menuActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      action.onSelect();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`site-footer ${className}`}>
      <div className="site-horse-track" aria-hidden="true">
        <div className="site-horse-runner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/folly-horse.png" alt="" />
        </div>
      </div>
      <div className="site-footer-bar">
        <p>Based in London &amp; New York</p>
      </div>
    </footer>
  );
}
