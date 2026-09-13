import {
  ArrowRight,
  Camera,
  FileVideo,
  Folder,
  FolderOpen,
  CircleHelp,
  Keyboard,
  LoaderCircle,
  Monitor,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { formatTime } from "../../../shared/timeline";
import { ProjectThumbnail } from "./ProjectThumbnail";
import { date } from "../../lib/format";
import { type StudioController } from "../../controllers/useStudioController";
import { AuthorFooter } from "../../components/organisms/AuthorFooter";

export function ProjectsScreen({
  studio,
}: {
  studio: Pick<
    StudioController,
    | "projects"
    | "setModal"
    | "search"
    | "setSearch"
    | "sort"
    | "setSort"
    | "busy"
    | "connected"
    | "loading"
    | "initialize"
    | "openProject"
    | "importProject"
    | "renameProject"
    | "deleteProject"
    | "filtered"
    | "projectLocked"
  >;
}) {
  const {
    projects,
    setModal,
    search,
    setSearch,
    sort,
    setSort,
    busy,
    connected,
    loading,
    initialize,
    openProject,
    importProject,
    renameProject,
    deleteProject,
    filtered,
    projectLocked,
  } = studio;

  return (
    <div className="library-layout">
      <aside className="library-sidebar">
        <nav className="sidebar-navigation" aria-label="Workspace">
          <div className="workspace-label">YOUR WORKSPACE</div>
          <button className="sidebar-link selected">
            <Folder size={17} />
            All projects<span>{projects.length}</span>
          </button>
          <button className="sidebar-link" onClick={() => setModal("help")}>
            <CircleHelp size={17} />
            How to use
          </button>
          <button className="sidebar-link" onClick={() => setModal("settings")}>
            <Keyboard size={17} />
            Settings & MCP
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={22} />
            <div>
              <strong>Local by design</strong>
              <p>Your projects stay on your Mac.</p>
            </div>
          </div>
          <AuthorFooter onAbout={() => setModal("about")} />
        </div>
      </aside>
      <main className="library-main">
        <div className="library-title-row">
          <div>
            <div className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</div>
            <h1>
              Your projects<span className="accent-dot">.</span>
            </h1>
            <p>Record something worth sharing. Make it your own.</p>
          </div>
          <button
            className="button primary large"
            disabled={busy || !connected}
            onClick={() => setModal("new")}
          >
            <Plus size={18} />
            New project
          </button>
        </div>
        <div className="library-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              placeholder="Search your projects…"
              aria-label="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>⌕</kbd>
          </div>
          <div className="library-toolbar-actions">
            <button
              className="button subtle"
              disabled={busy || !connected}
              onClick={() => void importProject()}
            >
              <FolderOpen size={15} />
              Open folder
            </button>
            <label className="sort-control">
              <SlidersHorizontal size={14} />
              <select
                aria-label="Sort projects"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="modified">Last edited</option>
                <option value="created">Date created</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
        </div>
        {loading ? (
          <div className="empty-state">
            <LoaderCircle size={30} className="spin" />
            <h2>Opening your workspace</h2>
          </div>
        ) : !connected ? (
          <div className="empty-state">
            <Monitor size={36} />
            <h2>Let’s connect your workspace</h2>
            <p>
              The local recording service is unavailable. Start the desktop app
              or development service, then reconnect.
            </p>
            <button
              className="button primary"
              onClick={() => void initialize()}
            >
              <RefreshCw size={15} />
              Reconnect
            </button>
          </div>
        ) : filtered.length ? (
          <>
            <div className="section-label">
              {search ? `${filtered.length} matching projects` : "ALL PROJECTS"}
              <span>
                {filtered.length}{" "}
                {filtered.length === 1 ? "project" : "projects"}
              </span>
            </div>
            <div className="project-grid">
              {filtered.map((p, index) => (
                <article className="project-card" key={p.id}>
                  <button
                    className={`project-cover cover-${index % 4}`}
                    onClick={() => void openProject(p.id)}
                    disabled={busy}
                    aria-label={`Open ${p.name}`}
                  >
                    {p.thumbnail ? (
                      <ProjectThumbnail thumbnail={p.thumbnail} />
                    ) : (
                      <div className="cover-art">
                        <div className="cover-window">
                          <span />
                          <span />
                          <span />
                          <div>
                            <FileVideo size={31} strokeWidth={1.1} />
                          </div>
                        </div>
                        <div className="cover-orb" />
                      </div>
                    )}
                    <span className={`status-tag ${p.status}`}>
                      <span />
                      {p.status === "draft"
                        ? "Draft"
                        : p.status === "recording"
                          ? "Recording"
                          : "Ready to edit"}
                    </span>
                    {p.durationMs > 0 && (
                      <span className="duration-tag">
                        {formatTime(p.durationMs)}
                      </span>
                    )}
                  </button>
                  <div className="project-card-body">
                    <button
                      className="project-card-title"
                      onClick={() => void openProject(p.id)}
                    >
                      {p.name}
                    </button>
                    <details className="project-menu" name="studio-menu">
                      <summary aria-label={`Actions for ${p.name}`}>
                        <MoreHorizontal size={18} />
                      </summary>
                      <div>
                        <button
                          aria-label={`Rename ${p.name}`}
                          onClick={() => void renameProject(p)}
                        >
                          Rename
                        </button>
                        <button
                          aria-label={`Move ${p.name} to Trash`}
                          className="danger-text"
                          disabled={busy || projectLocked(p.id)}
                          onClick={() => void deleteProject(p)}
                        >
                          Move to Trash
                        </button>
                      </div>
                    </details>
                    <p>
                      Edited {date(p.updatedAt)}
                      <span>
                        {p.durationMs > 0
                          ? "Recording project"
                          : "No recording yet"}
                      </span>
                    </p>
                  </div>
                </article>
              ))}
              <button
                className="new-project-card"
                onClick={() => setModal("new")}
              >
                <span>
                  <Plus size={24} />
                </span>
                <strong>Start a new story</strong>
                <p>Your next idea belongs here.</p>
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-illustration">
              <div className="empty-frame">
                <Monitor size={48} strokeWidth={1.2} />
                <span>
                  <Camera size={20} />
                </span>
              </div>
              <span className="empty-spark">
                <Sparkles size={18} />
              </span>
            </div>
            <span className="eyebrow">FROM FIRST TAKE TO FINAL CUT</span>
            <h2>
              {search
                ? "No projects found"
                : "Your next great video starts here"}
            </h2>
            <p>
              {search
                ? "Try another project name."
                : "Capture your screen and camera, polish the details, and turn your know-how into something shareable."}
            </p>
            {!search && (
              <button
                className="button primary large"
                onClick={() => setModal("new")}
              >
                <Plus size={17} />
                Create your first project
                <ArrowRight size={16} />
              </button>
            )}
            <div className="empty-features">
              <span>
                <Monitor size={14} />
                Screen + camera
              </span>
              <span>
                <WandSparkles size={14} />
                AI editing
              </span>
              <span>
                <ShieldCheck size={14} />
                Local by default
              </span>
            </div>
          </div>
        )}
        <footer className="library-footer">
          <span>
            <span className={`connection-dot ${connected ? "online" : ""}`} />
            {connected
              ? "Everything saved on your device"
              : "Waiting for local service"}
          </span>
          <span>Good ideas deserve good videos.</span>
        </footer>
      </main>
    </div>
  );
}
