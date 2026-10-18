/** Shared editorial styles; no remote fonts or image dependencies. */
export const NEWSLETTER_CSS = `
.mt-edition {
  --paper: #fff; --ink: #18212b; --muted: #546170; --rule: #d6dde5;
  --serif: "Source Serif 4", Georgia, serif;
  --sans: "Source Sans 3", Arial, sans-serif;
  --accent: #174fa3; --wash: #f3f6fa; --alert: #a7252d;
  box-sizing: border-box; min-height: 100vh; background: var(--paper); color: var(--ink);
  font: 400 16px/1.5 var(--serif);
  font-optical-sizing: auto; -webkit-font-smoothing: antialiased;
  padding: 32px max(24px, calc((100% - 1240px) / 2));
}
.mt-edition *, .mt-edition *::before, .mt-edition *::after { box-sizing: border-box; }
.mt-edition a { color: var(--accent); text-underline-offset: .2em; }
.mt-edition a:hover { text-decoration: underline; text-decoration-thickness: 2px; }
.mt-edition a:focus-visible { outline: 3px solid var(--accent); outline-offset: 5px; }
.mt-edition h1, .mt-edition h2, .mt-edition h3, .mt-edition p { margin: 0; }
.mt-edition h1, .mt-edition h2, .mt-edition h3 {
  font-family: var(--serif);
  font-weight: 600; text-wrap: balance; line-height: 1.18;
}
.mt-edition h1 { font-size: clamp(42px, 6.5vw, 80px); letter-spacing: -.045em; }
.mt-edition h2 { font-size: clamp(28px, 2.8vw, 36px); letter-spacing: -.02em; }
.mt-edition h3 { font-size: 22px; letter-spacing: -.02em; line-height: 1.22; }
.mt-edition h2 a, .mt-edition h3 a { color: inherit; text-decoration: none; }
.mt-edition p { max-width: 68ch; }
.mt-edition .mt-masthead {
  text-align: left; min-height: 270px; padding: 32px 40px 48px;
  background: #f5f3ed var(--mt-masthead-art, none) right bottom / cover no-repeat;
  color: #18212b; border: 1px solid #d6d3ca;
}
.mt-edition .mt-masthead h1 { max-width: 75%; font-size: clamp(40px, 4.5vw, 64px); letter-spacing: -.04em; }
.mt-edition .mt-masthead .mt-dateline { margin: 0 0 22px; color: #4c5865; max-width: 65%; }
.mt-edition .mt-masthead .mt-deck { margin: 18px 0 0; max-width: 52%; color: #4c5865; }
.mt-edition .mt-dateline { font-family: var(--sans); font-size: 13px; color: var(--muted); margin: 0 auto 18px; }
.mt-edition .mt-deck { font-family: var(--sans); color: var(--muted); margin: 14px auto 0; font-size: 16px; }
.mt-edition .mt-nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 0 28px; font-family: var(--sans); font-weight: 600;
  padding: 4px 0; border-bottom: 2px solid var(--ink); }
.mt-edition .mt-nav a { display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; text-decoration: none; }
.mt-edition .mt-lead { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 32px; padding: 28px 0; border-bottom: 1px solid var(--rule); align-items: start; }
.mt-edition .mt-lead > :only-child { grid-column: 1 / -1; max-width: 860px; }
.mt-edition .mt-lead p { margin-top: 12px; font-size: 17px; line-height: 1.5; }
.mt-edition .mt-aside { border-left: 1px solid var(--rule); padding-left: 24px; }
.mt-edition .mt-aside p { font-size: 16px; }
.mt-edition .mt-section { padding: 24px 0 32px; border-bottom: 1px solid var(--rule); scroll-margin-top: 24px; }
.mt-edition .mt-section > h2 { font: 700 18px/1.25 var(--sans); letter-spacing: .01em; margin-bottom: 20px; }
.mt-edition .mt-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 32px; }
.mt-edition .mt-story { min-width: 0; }
.mt-edition .mt-story p { margin-top: 10px; }
.mt-edition .mt-grid > .mt-story { padding-top: 16px; border-top: 1px solid var(--rule); }
.mt-edition .mt-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px;
  margin-top: 10px; font: 400 13px/1.4 var(--sans); color: var(--muted); }
.mt-edition .mt-meta a { display: inline-flex; align-items: center; min-height: 44px; }
.mt-edition .mt-critical { border-left: 3px solid var(--alert); padding: 4px 0 4px 20px; }
.mt-edition .mt-action { color: var(--alert); font: 700 14px/1.4 var(--sans); margin-bottom: 10px; }
.mt-edition .mt-ideas { background: var(--wash); padding: 28px; margin-top: 32px; }
.mt-edition .mt-ideas h2 { font: 700 18px/1.25 var(--sans); margin-bottom: 18px; }
.mt-edition .mt-ideas li { margin: 12px 0; padding-left: 4px; }
.mt-edition .mt-footer { padding-top: 28px; color: var(--muted); font: 400 13px/1.5 var(--sans); }
.mt-edition img { display: block; max-width: 100%; height: auto; border-radius: 3px; }
.mt-edition figure { margin: 0; }
.mt-edition figcaption { font-size: 13px; color: var(--muted); margin-top: 8px; }
.mt-edition a, .mt-edition p { overflow-wrap: anywhere; }
@media (prefers-color-scheme: dark) {
  .mt-edition { --paper: #141a22; --ink: #edf1f6; --muted: #b4bfcc;
    --rule: #3a4656; --accent: #a4c8ff; --wash: #202a37; --alert: #ffa6ab; }
}
@media (max-width: 700px) {
  .mt-edition { padding: 28px 22px 40px; font-size: 16px; }
  .mt-edition .mt-lead, .mt-edition .mt-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .mt-edition .mt-lead { padding: 24px 0; }
  .mt-edition .mt-aside { border-left: 0; border-top: 1px solid var(--rule); padding: 24px 0 0; }
  .mt-edition .mt-masthead {
    text-align: center; min-height: 320px; padding: 24px 18px 130px;
    background-size: auto 120px; background-position: right bottom;
  }
  .mt-edition .mt-masthead h1 { max-width: none; font-size: clamp(32px, 8vw, 48px); }
  .mt-edition .mt-masthead .mt-dateline { max-width: none; margin: 0 auto 18px; }
  .mt-edition .mt-masthead .mt-deck { max-width: 34ch; margin: 16px auto 0; font-size: 15px; }
  .mt-edition .mt-ideas { padding: 22px; }
  .mt-edition .mt-nav { gap: 0 18px; }
}
`;
