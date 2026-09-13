import { author } from "../../../shared/brand";
import { useAuthorLinks } from "../../controllers/useAuthorLinks";
import { ArrowUpRight } from "lucide-react";
import { Dialog } from "./Dialog";

export function AuthorFooter({ onAbout }: { onAbout: () => void }) {
  const { error, open } = useAuthorLinks();
  return <div className="author-card">
    <small>BUILT BY</small>
    <button className="author-profile" onClick={onAbout} aria-label={`About ${author.name}`}>
      <span className="author-avatar" aria-hidden="true">SU</span>
      <span className="author-identity">
        <strong>{author.name}</strong>
        <span>Creator</span>
      </span>
      <ArrowUpRight size={14} aria-hidden="true" />
    </button>
    <div className="author-links">{[["GitHub", author.repository], ["serkanuslu.com", author.website]].map(([label, href]) =>
      <a key={href} href={href} target="_blank" rel="noreferrer" onClick={e => open(e, href!)}>{label}</a>)}</div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { error, open } = useAuthorLinks();
  return <Dialog title="About Serkan Uslu" subtitle="Creator of Screen Recorder. Built for people who share what they know." onClose={onClose}>
    <p>Questions, feedback, or ideas? Get in touch.</p>
    <div className="about-links">{[["GitHub profile", author.github], ["Medium", author.medium], ["serkanuslu.com", author.website], [author.email, `mailto:${author.email}`]].map(([label, href]) =>
      <a className="button secondary" key={href} href={href} target="_blank" rel="noreferrer" onClick={e => open(e, href!)}>{label}</a>)}</div>
    {error && <p role="alert">{error}</p>}
  </Dialog>;
}
