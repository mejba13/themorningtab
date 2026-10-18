/** Synthetic editorial copy for layout verification, never saved to a user's profile. */
export const newsletterFixture = `import React from 'react';
export default function PersonalizedHomepage() {
  const stories = [
    ['AI Briefs', 'ai', [
      ['Read the release notes before changing your agent stack', 'Compare capability changes with your existing evaluations before rolling out a new model.', 'Anthropic', 'https://example.org/ai/release'],
      ['A practical reading list for tool-using agents', 'Review tool boundaries and failure handling before adding another integration.', 'Developer documentation', 'https://example.org/ai/tools']
    ]],
    ['Dev Stack', 'dev', [
      ['Keep framework upgrades small and observable', 'Separate dependency updates from product changes so regressions are easier to isolate.', 'Engineering notes', 'https://example.org/dev/frameworks'],
      ['Make database performance part of the release review', 'Inspect expensive queries against realistic data before increasing application capacity.', 'Database notes', 'https://example.org/dev/database']
    ]],
    ['Security Watch', 'security', [
      ['Review the patch window for exposed services', 'Prioritize internet-facing systems and validate mitigations before deployment.', 'Security advisory fixture', 'https://example.org/security/advisory']
    ]]
  ];
  return <main className="mt-edition">
    <header className="mt-masthead"><p className="mt-dateline">Design verification · Fixture edition</p><h1>The Morning Tab</h1><p className="mt-deck">An independent view of AI, software, and the work ahead.</p></header>
    <nav className="mt-nav" aria-label="In this edition"><a href="#ai">AI Briefs</a><a href="#dev">Dev Stack</a><a href="#security">Security Watch</a></nav>
    <section className="mt-lead" aria-label="Lead story"><article className="mt-story"><h2><a href="https://example.org/lead">The next chapter of AI starts with better engineering</a></h2><p>A useful morning brief connects the technical details to the decisions you need to make. This is sample editorial copy for testing the reading experience.</p><div className="mt-meta"><a href="https://example.org/lead">Editorial fixture</a><span>Time unavailable</span></div></article><aside className="mt-aside"><h3><a href="https://example.org/desk">From the developer's desk</a></h3><p>Less noise, more context. A focused edition for people building and running software businesses.</p><div className="mt-meta"><a href="https://example.org/desk">Desk fixture</a><span>Time unavailable</span></div></aside></section>
    {stories.map(([name, id, items]) => <section className="mt-section" id={id} key={id}><h2>{name}</h2><div className="mt-grid">{items.map(([title, summary, source, url]) => <article className={'mt-story' + (id === 'security' ? ' mt-critical' : '')} key={url}>{id === 'security' && <div className="mt-action">Action needed</div>}<h3><a href={url}>{title}</a></h3><p>{summary}</p><div className="mt-meta"><a href={url}>{source}</a><span>Time unavailable</span></div></article>)}</div></section>)}
    <section className="mt-ideas"><h2>Content Ideas</h2><ul><li><a href="https://example.org/ai/tools">What makes an agent integration ready for production?</a></li><li><a href="https://example.org/dev/frameworks">A framework upgrade should not become a rewrite.</a></li><li><a href="https://example.org/dev/database">The query review that belongs in your release checklist.</a></li></ul></section>
    <footer className="mt-footer">Fixture edition for design verification. These are not live news stories.</footer>
  </main>;
}`;
