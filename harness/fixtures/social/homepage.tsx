import React from 'react';

// Fixture homepage: a Social Pulse section the way the agent is told to write
// one. The harness inlines the pulse and a fixed "now" so screenshots are stable.
const PULSE = /*__PULSE__*/ null;
const NOW = new Date(/*__NOW__*/ null);

const LABELS = { youtube: 'YouTube', x: 'X', linkedin: 'LinkedIn', pinterest: 'Pinterest', instagram: 'Instagram' };
const MARKS = { youtube: '▶', x: '𝕏', linkedin: 'in', pinterest: 'P', instagram: '◎' };

function ago(iso) {
  if (!iso) return null;
  const m = Math.max(0, Math.round((NOW.getTime() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

const css = `
  :root { --bg:#f6f7f9; --card:#fff; --ink:#14171c; --muted:#5d6573; --line:#e3e6eb; --accent:#0a66c2; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0e1116; --card:#171b22; --ink:#e8ebf0; --muted:#98a1ae; --line:#272d37; --accent:#6cb2ff; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 72px 16px 48px; }
  .pulse-grid { display:grid; gap:14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; display:flex; flex-direction:column; text-decoration:none; color:inherit; transition: transform .15s, border-color .15s; min-width:0; }
  .card:hover { transform: translateY(-2px); border-color: var(--accent); }
  .thumb { width:100%; aspect-ratio: 16/9; object-fit: cover; display:block; background: var(--line); }
  .body { padding:12px 14px 14px; display:flex; flex-direction:column; gap:6px; }
  .text { font-size:14.5px; line-height:1.45; overflow-wrap:anywhere; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
  .meta { font-size:12px; color:var(--muted); display:flex; gap:6px; flex-wrap:wrap; }
  .pill { font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--accent); }
  h2.group { font-size:15px; margin:28px 0 10px; display:flex; align-items:center; gap:8px; }
  .mark { display:inline-grid; place-items:center; width:24px; height:24px; border-radius:6px; background:var(--accent); color:var(--card); font-size:12px; font-weight:800; }
  .quiet { color:var(--muted); font-size:13px; margin:4px 0 0; }
`;

export default function PersonalizedHomepage() {
  const groups = Object.keys(PULSE.platforms);
  return (
    <div>
      <style>{css}</style>
      <main className="wrap">
        <h1 style={{ fontSize: 30, margin: '0 0 4px' }}>Social Pulse</h1>
        <p className="quiet">Latest posts about {PULSE.topics.join(', ')}.</p>
        {groups.map((p) => {
          const items = PULSE.items.filter((i) => i.platform === p);
          const status = PULSE.platforms[p];
          return (
            <section key={p} aria-label={LABELS[p]}>
              <h2 className="group"><span className="mark" aria-hidden="true">{MARKS[p]}</span>{LABELS[p]}</h2>
              {items.length === 0 ? (
                <p className="quiet">No posts: {status.status}{status.detail ? ` (${status.detail})` : ''}.</p>
              ) : (
                <div className="pulse-grid">
                  {items.map((i) => (
                    <a key={i.url} className="card" href={i.url} target="_blank" rel="noreferrer" data-platform={p}>
                      {i.thumbnail && <img className="thumb" src={i.thumbnail} alt="" loading="lazy" />}
                      <div className="body">
                        <span className="pill">{LABELS[p]}</span>
                        <span className="text">{i.text}</span>
                        <span className="meta">
                          {i.author && <span>{i.author}</span>}
                          {i.publishedAt && <span>· {ago(i.publishedAt)}</span>}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
