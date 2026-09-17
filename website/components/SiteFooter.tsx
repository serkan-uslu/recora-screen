import Image from "next/image";
import Link from "next/link";
import { author, product } from "@/shared/brand";
import { assetPath } from "@/website/lib/site";

export function SiteFooter() {
  return (
    <footer className="wrap footer">
      <div>
        <Link className="brand" href="/">
          <Image className="brand-icon" src={assetPath("icon.svg")} width={34} height={34} alt="" />
          {product.name}
          <span className="accent">.</span>
        </Link>
        <p>Good ideas deserve good videos.</p>
        <small id="analytics-notice">
          Cookie-free site analytics measure visits. Your projects stay on your Mac.
        </small>
      </div>
      <div>
        <span className="eyebrow">BUILT BY SERKAN USLU</span>
        <div className="footer-links">
          <a data-event="Author Link Click" data-placement="github" href={author.github}>
            GitHub ↗
          </a>
          <a data-event="Author Link Click" data-placement="linkedin" href={author.linkedin}>
            LinkedIn ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
