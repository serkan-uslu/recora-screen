export function PanelIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="panel-intro">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
