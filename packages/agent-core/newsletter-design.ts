/** Shared editorial styles; no remote fonts or image dependencies. */
export const NEWSLETTER_CSS = `
.mt-edition {
  --paper: #fff; --ink: #18212b; --muted: #546170; --rule: #d6dde5;
  --accent: #174fa3; --wash: #f3f6fa; --alert: #a7252d;
  box-sizing: border-box; min-height: 100vh; background: var(--paper); color: var(--ink);
  font: 17px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 32px max(24px, calc((100% - 1160px) / 2));
}
.mt-edition *, .mt-edition *::before, .mt-edition *::after { box-sizing: border-box; }
.mt-edition a { color: var(--accent); text-underline-offset: .2em; }
.mt-edition a:hover { text-decoration: underline; text-decoration-thickness: 2px; }
.mt-edition a:focus-visible { outline: 3px solid var(--accent); outline-offset: 5px; }
.mt-edition h1, .mt-edition h2, .mt-edition h3, .mt-edition p { margin: 0; }
.mt-edition h1, .mt-edition h2, .mt-edition h3 {
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  font-weight: 600; text-wrap: balance; line-height: 1.15;
}
.mt-edition h1 { font-size: clamp(42px, 6.5vw, 80px); letter-spacing: -.045em; }
.mt-edition h2 { font-size: clamp(30px, 3.5vw, 46px); letter-spacing: -.025em; }
.mt-edition h3 { font-size: clamp(23px, 2.2vw, 28px); letter-spacing: -.015em; }
.mt-edition h2 a, .mt-edition h3 a { color: inherit; text-decoration: none; }
.mt-edition p { max-width: 68ch; }
.mt-edition .mt-masthead {
  text-align: left; min-height: 320px; padding: 40px 44px 64px;
  background: #f5f3ed var(--mt-masthead-art, none) right bottom / cover no-repeat;
  color: #18212b; border: 1px solid #d6d3ca;
}
.mt-edition .mt-masthead h1 { max-width: 75%; font-size: clamp(40px, 5vw, 72px); }
.mt-edition .mt-masthead .mt-dateline { margin: 0 0 22px; color: #4c5865; max-width: 65%; }
.mt-edition .mt-masthead .mt-deck { margin: 18px 0 0; max-width: 52%; color: #4c5865; }
.mt-edition .mt-dateline { font-size: 13px; color: var(--muted); margin: 0 auto 18px; }
.mt-edition .mt-deck { color: var(--muted); margin: 14px auto 0; font-size: 16px; }
.mt-edition .mt-nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 24px;
  padding: 12px 0; border-bottom: 1px solid var(--rule); }
.mt-edition .mt-nav a { display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; text-decoration: none; }
.mt-edition .mt-lead { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
  gap: 40px; padding: 40px 0; border-bottom: 1px solid var(--rule); align-items: start; }
.mt-edition .mt-lead > :only-child { grid-column: 1 / -1; max-width: 860px; }
.mt-edition .mt-lead p { margin-top: 18px; font-size: 18px; }
.mt-edition .mt-aside { border-left: 1px solid var(--rule); padding-left: 28px; }
.mt-edition .mt-aside p { font-size: 16px; }
.mt-edition .mt-section { padding: 34px 0; border-bottom: 1px solid var(--rule); scroll-margin-top: 24px; }
.mt-edition .mt-section > h2 { font-size: 27px; margin-bottom: 24px; }
.mt-edition .mt-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 30px 44px; }
.mt-edition .mt-story { min-width: 0; }
.mt-edition .mt-story p { margin-top: 12px; }
.mt-edition .mt-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px;
  margin-top: 14px; font-size: 13px; line-height: 1.6; color: var(--muted); }
.mt-edition .mt-meta a { display: inline-flex; align-items: center; min-height: 44px; }
.mt-edition .mt-critical { border-left: 3px solid var(--alert); padding: 4px 0 4px 20px; }
.mt-edition .mt-action { color: var(--alert); font-size: 14px; font-weight: 700; margin-bottom: 10px; }
.mt-edition .mt-ideas { background: var(--wash); padding: 28px; margin-top: 32px; }
.mt-edition .mt-ideas h2 { font-size: 27px; margin-bottom: 18px; }
.mt-edition .mt-ideas li { margin: 12px 0; padding-left: 4px; }
.mt-edition .mt-footer { padding-top: 28px; color: var(--muted); font-size: 13px; }
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
  .mt-edition .mt-lead { padding: 30px 0; }
  .mt-edition .mt-aside { border-left: 0; border-top: 1px solid var(--rule); padding: 24px 0 0; }
  .mt-edition .mt-masthead {
    text-align: center; min-height: 370px; padding: 28px 20px 160px;
    background-size: auto 150px; background-position: right bottom;
  }
  .mt-edition .mt-masthead h1 { max-width: none; font-size: clamp(36px, 9vw, 52px); }
  .mt-edition .mt-masthead .mt-dateline { max-width: none; margin: 0 auto 18px; }
  .mt-edition .mt-masthead .mt-deck { max-width: 34ch; margin: 16px auto 0; font-size: 15px; }
  .mt-edition .mt-ideas { padding: 22px; }
  .mt-edition .mt-nav { gap: 0 18px; }
}
`;
