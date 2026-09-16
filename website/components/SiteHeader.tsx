"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { product } from "@/shared/brand";
import { assetPath } from "@/website/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [active, setActive] = useState(pathname.startsWith("/documentation") ? "docs" : "");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/documentation")) {
      setActive("docs");
      return;
    }
    const sections = ["features", "workflow", "mcp"]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    const update = () => {
      const current = sections
        .filter((section) => section.getBoundingClientRect().top <= 150)
        .at(-1);
      setActive(current?.id ?? "");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("hashchange", update);
    };
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="nav wrap">
        <Link className="brand" href="/" aria-label={`${product.name} home`}>
          <Image className="brand-icon" src={assetPath("icon.svg")} width={34} height={34} alt="" />
          {product.name}
          <span className="accent">.</span>
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
          Menu
        </button>
        <nav
          id="main-navigation"
          className={menuOpen ? "open" : undefined}
          aria-label="Main navigation"
        >
          <Link
            className={active === "features" ? "selected" : undefined}
            aria-current={active === "features" ? "location" : undefined}
            href="/#features"
            data-event="Navigation Click"
            data-placement="features"
            onClick={() => {
              setActive("features");
              setMenuOpen(false);
            }}
          >
            Features
          </Link>
          <Link
            className={active === "workflow" ? "selected" : undefined}
            aria-current={active === "workflow" ? "location" : undefined}
            href="/#workflow"
            data-event="Navigation Click"
            data-placement="workflow"
            onClick={() => {
              setActive("workflow");
              setMenuOpen(false);
            }}
          >
            How it works
          </Link>
          <Link
            className={active === "mcp" ? "selected" : undefined}
            aria-current={active === "mcp" ? "location" : undefined}
            href="/#mcp"
            data-event="Navigation Click"
            data-placement="mcp"
            onClick={() => {
              setActive("mcp");
              setMenuOpen(false);
            }}
          >
            MCP
          </Link>
          <Link
            className={active === "docs" ? "selected" : undefined}
            aria-current={active === "docs" ? "page" : undefined}
            href="/documentation/"
            data-event="Navigation Click"
            data-placement="documentation"
            onClick={() => {
              setActive("docs");
              setMenuOpen(false);
            }}
          >
            Docs
          </Link>
          <Link
            className="mobile-download"
            href="/#download"
            data-event="Navigation Click"
            data-placement="mobile-nav-download"
            onClick={() => setMenuOpen(false)}
          >
            Get the app <span>↗</span>
          </Link>
        </nav>
        <Link
          className="button small nav-download"
          href="/#download"
          data-event="Navigation Click"
          data-placement="nav-download"
        >
          Get the app <span>↗</span>
        </Link>
      </div>
    </header>
  );
}
