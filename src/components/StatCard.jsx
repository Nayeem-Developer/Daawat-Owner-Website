export default function StatCard({
  title,
  value,
  tone = "default",
  onClick,
  active = false,
  children,
}) {
  const classes = `stat-card ${tone} ${onClick ? "clickable" : ""} ${active ? "active" : ""}`;

  return (
    <article className={classes} onClick={onClick}>
      <div className="stat-card-inner">
        <div className="stat-card-top">
          <p className="stat-card-title">{title}</p>
          {active ? <span className="stat-card-badge">Selected</span> : null}
        </div>
        <h3 className="stat-card-value">{value}</h3>
        {children ? <div className="stat-card-extra">{children}</div> : null}
      </div>
    </article>
  );
}
