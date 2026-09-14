import { author } from "@/shared/brand";
import { useAuthorLinks } from "@/src/controllers/useAuthorLinks";
import { ArrowUpRight } from "lucide-react";
import { Dialog } from "@/src/components/organisms/Dialog";

export function AuthorFooter({ onAbout }: { onAbout: () => void }) {
  return (
    <div className="author-card">
      <small>BUILT BY</small>
      <button className="author-profile" onClick={onAbout} aria-label={`About ${author.name}`}>
        <span className="author-avatar" aria-hidden="true">
          SU
        </span>
        <span className="author-identity">
          <strong>{author.name}</strong>
          <span>Creator</span>
        </span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { error, open } = useAuthorLinks();
  return (
    <Dialog
      title="About Serkan Uslu"
      subtitle="Creator of Screen Recorder. Built for people who share what they know."
      onClose={onClose}
    >
      <div className="about-links">
        {(
          [
            [
              "PROJECT",
              [
                [
                  "Screen Recorder on GitHub",
                  "Explore the source, report an issue, or contribute to the project.",
                  author.repository,
                ],
              ],
            ],
            [
              "CREATOR",
              [
                ["GitHub profile", "Discover Serkan’s other open-source work.", author.github],
                ["Medium", "Read articles about software, products, and AI.", author.medium],
                ["serkanuslu.com", "See Serkan’s work and current projects.", author.website],
              ],
            ],
            [
              "CONTACT",
              [
                [
                  author.email,
                  "Send questions, feedback, or collaboration ideas.",
                  `mailto:${author.email}`,
                ],
              ],
            ],
          ] as const
        ).map(([title, links]) => (
          <section className="about-section" key={title}>
            <h3>{title}</h3>
            {links.map(([label, description, href]) => (
              <a
                className="about-link"
                key={href}
                href={href}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => open(e, href)}
              >
                <strong>{label}</strong>
                <span>{description}</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            ))}
          </section>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}
