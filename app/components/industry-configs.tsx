import type { Reaction } from "./ReactionSwarm";
import type { IndustryHeroConfig } from "./IndustryHero";

// Standard chip positions reused across configs so layout is consistent.
const POS = [
  { x: 6, y: 10, rotate: -3, delay: 600 },
  { x: 72, y: 4, rotate: 2, delay: 800 },
  { x: 78, y: 30, rotate: -1, delay: 1100 },
  { x: 4, y: 48, rotate: 1, delay: 1300 },
  { x: 84, y: 60, rotate: -2, delay: 1500 },
  { x: 2, y: 76, rotate: 2, delay: 1700 },
  { x: 70, y: 82, rotate: -3, delay: 1900 },
  { x: 36, y: 92, rotate: 1, delay: 2100 },
  { x: 48, y: -2, rotate: -1, delay: 2300 },
  { x: 16, y: 28, rotate: -2, delay: 2500 },
  { x: 86, y: 46, rotate: 2, delay: 2700 },
  { x: 12, y: 64, rotate: 1, delay: 2900 },
];

function mk(items: Array<Pick<Reaction, "body" | "handle" | "sentiment">>): Reaction[] {
  return items.map((it, i) => ({ ...it, ...POS[i % POS.length] }));
}

const DEFAULT_CTA = {
  primaryCta: { label: "Get early access", href: "/waitlist" },
  secondaryCta: { label: "Try the playground", href: "/#playground" },
};

export const FOUNDER_CONFIG: IndustryHeroConfig = {
  ...DEFAULT_CTA,
  kicker: "For founders",
  headline: (
    <>
      Your launch tweet is a{" "}
      <span style={{ fontStyle: "italic", color: "var(--butter-deep)" }}>
        public bet.
      </span>{" "}
      Hedge it.
    </>
  ),
  italicSubline:
    "1,000 fake users. 30 seconds. Reputation intact for the actual launch.",
  postLabel: "your launch post",
  postAuthor: "@you · scheduled in 4h",
  postBody: "we just shipped v2 — bigger context, faster, $19/mo from today",
  sentiment: { hostile: 50, positive: 25, noise: 25 },
  reactions: mk([
    { handle: "@dril_lite", body: "another wrapper", sentiment: "hostile" },
    { handle: "@notgenz", body: "honestly idk what this does", sentiment: "hostile" },
    { handle: "@buildlogs", body: "actually fire", sentiment: "positive" },
    { handle: "@quietquit", body: "ok PM", sentiment: "hostile" },
    { handle: "@reply_guy", body: "vc-coded", sentiment: "hostile" },
    { handle: "@bigfeels", body: "this is so cooked", sentiment: "hostile" },
    { handle: "@power_user", body: "shipping > posting", sentiment: "positive" },
    { handle: "@anon", body: "lol", sentiment: "noise" },
    { handle: "@receipts", body: "screenshotting for the GC", sentiment: "hostile" },
    { handle: "@og_user", body: "OG move", sentiment: "positive" },
    { handle: "@editor", body: "the copy slaps tho", sentiment: "positive" },
    { handle: "@noopinion", body: "huh", sentiment: "noise" },
  ]),
};

export const VC_CONFIG: IndustryHeroConfig = {
  ...DEFAULT_CTA,
  kicker: "For investors",
  headline: (
    <>
      Stress-test the{" "}
      <span style={{ fontStyle: "italic", color: "var(--butter-deep)" }}>
        portfolio bombshell
      </span>{" "}
      before they ship it.
    </>
  ),
  italicSubline:
    "Layoffs, down rounds, pivots — preview the public reaction first.",
  postLabel: "portco's layoff memo",
  postAuthor: "@portco · sent 9 minutes ago",
  postBody: "we're restructuring — 12% reduction in force, effective today",
  sentiment: { hostile: 55, positive: 20, noise: 25 },
  reactions: mk([
    { handle: "@ex_employee", body: "where's the severance detail", sentiment: "hostile" },
    { handle: "@founder_x", body: "down round vibes", sentiment: "hostile" },
    { handle: "@reply_guy", body: "another one", sentiment: "hostile" },
    { handle: "@vc_anon", body: "necessary cleanup", sentiment: "positive" },
    { handle: "@vesting_eng", body: "what about my equity", sentiment: "hostile" },
    { handle: "@power_user", body: "actually a bull signal", sentiment: "positive" },
    { handle: "@analyst", body: "burn rate corrected", sentiment: "positive" },
    { handle: "@hr_panic", body: "messaging is rough", sentiment: "hostile" },
    { handle: "@receipts", body: "i called this last quarter", sentiment: "hostile" },
    { handle: "@journalist", body: "asking for comment", sentiment: "hostile" },
    { handle: "@noopinion", body: "interesting", sentiment: "noise" },
    { handle: "@anon", body: "rip", sentiment: "noise" },
  ]),
};

export const PM_CONFIG: IndustryHeroConfig = {
  ...DEFAULT_CTA,
  kicker: "For product marketing",
  headline: (
    <>
      QA the launch post{" "}
      <span style={{ fontStyle: "italic", color: "var(--butter-deep)" }}>
        before legal does.
      </span>
    </>
  ),
  italicSubline:
    "Drop the draft. See the objections in 30 seconds. Iterate before you ship.",
  postLabel: "pricing announcement",
  postAuthor: "@yourcompany · posted 4m ago",
  postBody: "introducing our new pricing — Pro is now $39/mo",
  sentiment: { hostile: 45, positive: 25, noise: 30 },
  reactions: mk([
    { handle: "@sde2", body: "is this a soft hike", sentiment: "hostile" },
    { handle: "@ic_eng", body: "where's the legacy plan", sentiment: "hostile" },
    { handle: "@cto_buyer", body: "annual still 20%?", sentiment: "noise" },
    { handle: "@pm_anon", body: "the comms is clean tho", sentiment: "positive" },
    { handle: "@reply_guy", body: "predictable", sentiment: "hostile" },
    { handle: "@power_user", body: "worth it for the new feature", sentiment: "positive" },
    { handle: "@startup_buyer", body: "indie hacker rate?", sentiment: "hostile" },
    { handle: "@vp_eng", body: "show me the changelog", sentiment: "noise" },
    { handle: "@editor", body: "the page is gorgeous", sentiment: "positive" },
    { handle: "@bigfeels", body: "im downgrading", sentiment: "hostile" },
    { handle: "@anon", body: "lol $39", sentiment: "noise" },
    { handle: "@noopinion", body: "hmm", sentiment: "noise" },
  ]),
};

export const ALIGNMENT_CONFIG: IndustryHeroConfig = {
  ...DEFAULT_CTA,
  kicker: "For research labs",
  headline: (
    <>
      A million synthetic users.{" "}
      <span style={{ fontStyle: "italic", color: "var(--butter-deep)" }}>
        One API call.
      </span>
    </>
  ),
  italicSubline:
    "Population-scale agent simulations for contagion, persuasion, and content studies.",
  postLabel: "experiment design",
  postAuthor: "@yourlab · draft 1m ago",
  postBody:
    "running misinformation contagion experiment, n=5,000 synthetic agents",
  sentiment: { hostile: 40, positive: 30, noise: 30 },
  reactions: mk([
    { handle: "@reviewer_2", body: "n=5000 still too small", sentiment: "hostile" },
    { handle: "@phd_anon", body: "preregister this", sentiment: "hostile" },
    { handle: "@nlp_lab", body: "robust to seed?", sentiment: "noise" },
    { handle: "@postdoc", body: "this beats MTurk", sentiment: "positive" },
    { handle: "@prof", body: "what's the ground truth?", sentiment: "hostile" },
    { handle: "@safety_lead", body: "alignment-relevant", sentiment: "positive" },
    { handle: "@gradstudent", body: "could be a paper", sentiment: "positive" },
    { handle: "@reply_guy", body: "human eval pls", sentiment: "hostile" },
    { handle: "@ml_twitter", body: "share the dataset", sentiment: "noise" },
    { handle: "@iclr_anon", body: "novelty?", sentiment: "hostile" },
    { handle: "@noopinion", body: "hmm", sentiment: "noise" },
    { handle: "@anon", body: "rad", sentiment: "positive" },
  ]),
};

export const EMIL_CONFIG: IndustryHeroConfig = {
  ...DEFAULT_CTA,
  kicker: "Hey Emil — built this for you.",
  headline: (
    <>
      Ship the component library.{" "}
      <span style={{ fontStyle: "italic", color: "var(--butter-deep)" }}>
        Then watch dev-twitter
      </span>{" "}
      decide if it lives or dies.
    </>
  ),
  italicSubline:
    "Design engineers ship to a brutal audience. Pre-test the launch tweet against 60 synthetic engineers — see the dunks, the actually-fire crowd, and the bikeshedders before the real thread starts forming.",
  postLabel: "your launch tweet",
  postAuthor: "@emil · scheduled for tomorrow",
  postBody:
    "shipped a new component library today — fully typed, RSC-friendly, animations baked in, MIT licensed",
  sentiment: { hostile: 30, positive: 45, noise: 25 },
  reactions: mk([
    { handle: "@bikeshedder", body: "another one?", sentiment: "hostile" },
    { handle: "@radix_stan", body: "is this just radix", sentiment: "hostile" },
    { handle: "@buildlogs", body: "the API is clean tho", sentiment: "positive" },
    { handle: "@og_user", body: "finally someone who gets RSC", sentiment: "positive" },
    { handle: "@reply_guy", body: "what about a11y", sentiment: "hostile" },
    { handle: "@anon", body: "starring", sentiment: "positive" },
    { handle: "@designsys_diehard", body: "tokens?", sentiment: "noise" },
    { handle: "@power_user", body: "ssr just works?", sentiment: "positive" },
    { handle: "@fontnerd", body: "shadcn killer", sentiment: "positive" },
    { handle: "@noopinion", body: "ok", sentiment: "noise" },
    { handle: "@dx_andy", body: "pure CSS or styled?", sentiment: "noise" },
    { handle: "@receipts", body: "the docs slap", sentiment: "positive" },
  ]),
};

export const COMMS_CONFIG: IndustryHeroConfig = {
  ...DEFAULT_CTA,
  kicker: "For internal comms",
  headline: (
    <>
      Practice the{" "}
      <span style={{ fontStyle: "italic", color: "var(--butter-deep)" }}>
        all-hands email
      </span>{" "}
      on a fake company first.
    </>
  ),
  italicSubline:
    "Layoffs, RTO mandates, comp restructures — rehearse the leak before it leaks.",
  postLabel: "RTO announcement",
  postAuthor: "@ceo · just posted in #all-company",
  postBody: "team — we're moving to a 5-day in-office policy starting June",
  sentiment: { hostile: 60, positive: 20, noise: 20 },
  reactions: mk([
    { handle: "@senior_eng", body: "im updating my linkedin", sentiment: "hostile" },
    { handle: "@new_hire", body: "is this a soft layoff", sentiment: "hostile" },
    { handle: "@hr_panic", body: "we'll lose the parents", sentiment: "hostile" },
    { handle: "@vesting_eng", body: "what about my move", sentiment: "hostile" },
    { handle: "@manager", body: "timing is rough", sentiment: "hostile" },
    { handle: "@loyal_ic", body: "appreciate the transparency", sentiment: "positive" },
    { handle: "@founder_friend", body: "back to building", sentiment: "positive" },
    { handle: "@employee_x", body: "where's the rationale", sentiment: "hostile" },
    { handle: "@noopinion", body: "huh", sentiment: "noise" },
    { handle: "@anon", body: "lol bye", sentiment: "noise" },
    { handle: "@screenshotter", body: "this is leaking", sentiment: "hostile" },
    { handle: "@veteran", body: "this is fine", sentiment: "positive" },
  ]),
};
