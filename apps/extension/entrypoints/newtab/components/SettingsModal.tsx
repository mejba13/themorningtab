import { useEffect, useRef, useState } from "react";
import {
  MODEL_CHOICES,
  clampPerPlatform,
  normalizeBlockList,
  parseTopics,
  type HomepageModel,
  type SocialPulseSettings as SocialPulseConfig,
} from "@themorningtab/agent-core";
import { REBUILD_INTERVAL_CHOICES } from "@/lib/auto-rebuild";
import type { SocialPulseStatus } from "@/lib/storage";
import { SocialPulseSettings, type SocialPulseDraft } from "./SocialPulseSettings";
import "./settings.css";

export interface SettingsSave {
  prompt: string;
  blockedSites: string[];
  socialPulse: SocialPulseConfig;
  youtubeApiKey: string | null;
}

export function SettingsModal({
  initialPrompt,
  isBuilding = false,
  blockedSites,
  model,
  onChangeModel,
  autoRebuild,
  onToggleAutoRebuild,
  intervalHours,
  onChangeInterval,
  socialPulse,
  youtubeApiKey,
  socialStatus,
  onClose,
  onSave,
}: {
  initialPrompt: string;
  isBuilding?: boolean;
  blockedSites: string[];
  model: HomepageModel;
  onChangeModel: (next: HomepageModel) => void;
  autoRebuild: boolean;
  onToggleAutoRebuild: (next: boolean) => void;
  intervalHours: number;
  onChangeInterval: (next: number) => void;
  socialPulse: SocialPulseConfig;
  youtubeApiKey: string | null;
  socialStatus: SocialPulseStatus | null;
  onClose: () => void;
  onSave: (next: SettingsSave) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    promptRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  const [draft, setDraft] = useState(initialPrompt);
  const [blockedDraft, setBlockedDraft] = useState(blockedSites.join("\n"));
  const [socialDraft, setSocialDraft] = useState<SocialPulseDraft>({
    ...socialPulse,
    topics: socialPulse.topics.join(", "),
    youtubeApiKey: youtubeApiKey ?? "",
  });

  const save = () => {
    const topics = parseTopics(socialDraft.topics);
    onSave({
      prompt: draft,
      blockedSites: normalizeBlockList(blockedDraft.split("\n")),
      socialPulse: {
        enabled: socialDraft.enabled,
        topics: topics.length ? topics : ["AI"],
        platforms: socialDraft.platforms,
        perPlatform: clampPerPlatform(socialDraft.perPlatform),
      },
      youtubeApiKey: socialDraft.youtubeApiKey.trim() || null,
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className="editor-settings"
      aria-labelledby="settings-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]',
        )].filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
      }}
    >
      <header className="settings-header">
        <div>
          <div className="settings-eyebrow"><span className="edition-mark" aria-hidden="true">✳</span> THE MORNING TAB <span>/ EDITORIAL DESK</span></div>
          <h2 id="settings-title">Customize The Morning Tab</h2>
          <div className="settings-mobile-agent agent-status" role="status"><span aria-hidden="true" />{isBuilding ? "AI is building your edition" : "AI ready for your next edition"}</div>
        </div>
        <button className="settings-close" onClick={onClose} aria-label="Close settings">×</button>
      </header>
      <div className="settings-workspace">
        <aside className="settings-aside">
          <div className="settings-edition">YOUR NEXT EDITION</div>
          <h3>Less noise.<br /><em>More possibility.</em></h3>
          <p>Shape the signal. Let AI turn your reading into your next idea.</p>
          <div className={`editor-agent ${isBuilding ? "is-working" : ""}`}>
            <svg viewBox="0 0 200 150" aria-hidden="true">
              <circle className="agent-orbit" cx="100" cy="75" r="65" />
              <circle className="agent-orbit inner" cx="100" cy="75" r="49" />
              <path className="agent-ray" d="M20 75h25m110 0h25M100 0v20m0 110v20" />
              <g className="agent-paper"><rect x="61" y="32" width="78" height="91" rx="5" />
                <path d="M72 48h56M72 54h56M72 67h24v22H72zM103 67h25m-25 8h25m-25 8h25M72 99h56m-56 8h40" />
              </g>
              <path className="agent-scan" d="M53 75h94" />
              <circle className="agent-spark" cx="157" cy="39" r="5" />
            </svg>
            <div className="agent-status" role="status"><span aria-hidden="true" />{isBuilding ? "AI is building your edition" : "AI ready for your next edition"}</div>
            <p>Read · Connect · Write</p>
          </div>
          <nav aria-label="Settings sections">
            <a href="#editorial-brief"><span>01</span> Editorial brief <b>↗</b></a>
            <a href="#edition-controls"><span>02</span> Edition controls <b>↗</b></a>
            <a href="#privacy-boundaries"><span>03</span> Reading boundaries <b>↗</b></a>
            <a href="#social-pulse-settings"><span>04</span> Social Pulse <b>↗</b></a>
          </nav>
          <div className="settings-aside-foot">A sharper start.<br />An edition that works for you.</div>
        </aside>
        <div className="settings-scroll">
          <section id="editorial-brief" className="settings-section">
            <div className="section-heading"><h3><span>01</span> Editorial brief</h3><span className="settings-chip">YOUR DIRECTION, AI'S CRAFT</span></div>
            <p id="prompt-help" className="settings-help">Standing instructions applied to every build.</p>
            <textarea
              ref={promptRef}
              aria-label="Standing instructions applied to every build."
              aria-describedby="prompt-help"
              className="settings-prompt"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. 'Focus on tech news and Rust releases', 'Always surface unread GitHub PRs first'"
              spellCheck={false}
            />
            <p className="settings-caption">Make it yours. Your brief guides every edition.</p>
          </section>
          <section id="edition-controls" className="settings-section">
            <div className="section-heading"><h3><span>02</span> Edition controls</h3><span className="settings-caption">Changes apply immediately</span></div>
            <label className="settings-model">Model
              <select value={model} onChange={(e) => onChangeModel(e.target.value as HomepageModel)}>
                {MODEL_CHOICES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <div className="settings-schedule">
              <label className="settings-check"><input type="checkbox" checked={autoRebuild} onChange={(e) => onToggleAutoRebuild(e.target.checked)} />Rebuild automatically</label>
              <label className="settings-interval">Every
                <select value={intervalHours} disabled={!autoRebuild} onChange={(e) => onChangeInterval(Number(e.target.value))}>
                  {REBUILD_INTERVAL_CHOICES.map((h) => <option key={h} value={h}>{h === 24 ? "24 hours (daily)" : `${h} hours`}</option>)}
                </select>
              </label>
            </div>
            <p className="settings-help">When on, the extension rebuilds in the background once your homepage is this old, so
              your next tab shows a fresh one (uses your API key).</p>
          </section>
          <section id="privacy-boundaries" className="settings-section">
            <div className="section-heading"><h3><span>03</span> Reading boundaries</h3></div>
            <label className="settings-label">Sites the agent never reads
              <textarea value={blockedDraft} onChange={(e) => setBlockedDraft(e.target.value)} aria-describedby="blocked-sites-help" className="settings-blocked" />
            </label>
            <p id="blocked-sites-help" className="settings-help">One per line. Subdomains are included. Use *.example.com for wildcards.</p>
          </section>
          <section id="social-pulse-settings" className="settings-section">
            <SocialPulseSettings draft={socialDraft} onChange={setSocialDraft} lastStatus={socialStatus} />
          </section>
        </div>
      </div>
      <footer className="settings-footer">
        <p>Your next edition starts here.<span>Apply your brief, boundaries and Social Pulse.</span></p>
        <div><button className="settings-secondary" onClick={onClose}>Cancel</button><button className="settings-primary" onClick={save}>Save &amp; rebuild <span aria-hidden="true">↗</span></button></div>
      </footer>
    </dialog>
  );
}
