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
          <Link href="/documentation/" data-event="Navigation Click" data-placement="footer-docs">
            Documentation ↗
          </Link>
          <a data-event="Author Link Click" data-placement="repository" href={author.repository}>
            GitHub ↗
          </a>
          <a data-event="Author Link Click" data-placement="medium" href={author.medium}>
            Medium ↗
          </a>
          <a data-event="Author Link Click" data-placement="website" href={author.website}>
            serkanuslu.com ↗
          </a>
        </div>
        <a href={`mailto:${author.email}`} data-event="Contact Click" data-placement="footer">
          Questions? {author.email}
        </a>
        <p className="fine">Open source · {product.license} license</p>
      </div>
    </footer>
  );
}
