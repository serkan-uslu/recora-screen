import Image from "next/image";
import Link from "next/link";
import { product } from "@/shared/brand";
import { assetPath } from "@/website/lib/site";

export function SiteHeader() {
  return (
    <header className="nav wrap">
      <Link className="brand" href="/" aria-label={`${product.name} home`}>
        <Image className="brand-icon" src={assetPath("icon.svg")} width={34} height={34} alt="" />
        {product.name}
        <span className="accent">.</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#features" data-event="Navigation Click" data-placement="features">
          Features
        </Link>
        <Link href="/#workflow" data-event="Navigation Click" data-placement="workflow">
          How it works
        </Link>
        <Link href="/#mcp" data-event="Navigation Click" data-placement="mcp">
          MCP
        </Link>
        <Link href="/documentation/" data-event="Navigation Click" data-placement="documentation">
          Docs
        </Link>
      </nav>
      <Link
        className="button small"
        href="/#download"
        data-event="Navigation Click"
        data-placement="nav-download"
      >
        Get the app <span>↗</span>
      </Link>
    </header>
  );
}
