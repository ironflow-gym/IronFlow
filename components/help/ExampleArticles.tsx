/// <reference types="vite/client" />
import React from 'react';

const Paragraph = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
const Details = ({ title, children }: { title: string; children: React.ReactNode }) => <details className="border-t border-slate-800 pt-2"><summary className="min-h-11 cursor-pointer py-3 font-semibold text-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-400">{title}</summary><div className="space-y-4 pb-4 text-slate-300">{children}</div></details>;
const Steps = ({ children }: { children: React.ReactNode }) => <ol className="list-decimal space-y-4 pl-5 marker:font-semibold marker:text-emerald-300 [&>li]:pl-1">{children}</ol>;
function Example({ file, alt, children }: { file: string; alt: string; children: React.ReactNode }) {
  return <figure className="my-6 space-y-3"><img src={`${import.meta.env.BASE_URL}help/${file}`} alt={alt} loading="lazy" className="mx-auto h-auto w-full max-w-[360px] rounded-xl border border-slate-800" /><figcaption className="space-y-1 text-sm leading-relaxed text-slate-400">{children}<span className="block pt-1 text-xs">Example screens use fictional records. Your values will differ.</span></figcaption></figure>;
}
const Article = ({ children }: { children: React.ReactNode }) => <div className="space-y-5 text-[15px] leading-7 text-slate-300 [&_strong]:font-semibold [&_strong]:text-slate-100">{children}</div>;

export function GettingStartedArticle() {
  return <Article>
    <Paragraph>Start with a saved workout, record what you do, and build up a picture of your progress. You can do all of this without an AI key.</Paragraph>
    <Steps>
      <li><strong>Choose a workout.</strong> On Today, open <strong>Manage routines</strong>. Create a routine yourself, use AI to help, or choose a training block if you want a longer plan.</li>
      <li><strong>Take a quick look.</strong> Return to Today and choose <strong>Preview workout</strong>. Check the exercises, weights and reps, then start when you’re ready.</li>
      <li><strong>Record your sets.</strong> Tap a weight or rep number to change it. Tick each set when you finish it. Choose <strong>Finish workout</strong> when you’re done; rating how hard it felt is optional.</li>
    </Steps>
    <Example file="first-workout.png" alt="Today screen showing A beside Manage routines and B beside Preview workout.">
      <p><strong>A</strong> — Find or create your saved workouts.</p><p><strong>B</strong> — Check the next workout before you start.</p>
    </Example>
    <Paragraph>If you stop partway through, return to Today and choose <strong>Resume workout</strong>. Wait for the app to show that your changes are saved before closing it.</Paragraph>
    <Details title="Finding your way around">
      <ul className="list-disc space-y-2 pl-5"><li><strong>Today:</strong> your next workout, training calendar and Manage routines.</li><li><strong>Workout:</strong> your current session. With no session running, Initialize Ad-hoc starts a workout without a saved routine.</li><li><strong>Food:</strong> log meals, reuse foods and review your daily totals.</li><li><strong>Stats:</strong> look back at training, nutrition and measurements. On mobile, use Bios for bodyweight; desktop calls this Biometrics.</li></ul>
      <Paragraph>Use the bottom bar on mobile or the sidebar on desktop. Library, Find a Workout, Vault Backup, Manage Data, Trash Can, Settings and Help are available from the mobile menu or desktop sidebar.</Paragraph>
    </Details>
    <Details title="What needs an internet connection?">
      <Paragraph>AI tools need a Gemini key and internet. You can dismiss key setup and use manual tracking. Once the app is available offline, saved workouts and ordinary tracking can work without AI. New online food searches and Drive backups need a connection.</Paragraph>
      <Paragraph>Your records are saved in this browser. Keep a separate backup using Vault Backup; saving locally alone does not protect against losing the device or clearing browser data. If a save fails, keep the tab open and choose Retry save.</Paragraph>
    </Details>
  </Article>;
}

export function ChoosingWeightArticle() {
  return <Article>
    <Paragraph>IronFlow suggests a weight using your previous workouts and equipment settings. You can accept it or choose your own.</Paragraph>
    <Steps>
      <li><strong>Open Why?</strong> beside the suggestion in the workout preview or active exercise.</li>
      <li><strong>Compare the values.</strong> Check the previous date, weight and reps. The explanation tells you whether the suggestion uses your history, a related exercise or the routine’s starting values.</li>
      <li><strong>Make your choice.</strong> Use suggestion accepts the recommendation. Keep previous values reuses your last values when available. Enter my own lets you choose a weight and rep count.</li>
    </Steps>
    <Paragraph>Your choice changes sets you haven’t finished in this exercise. It does not change completed sets or your saved routine.</Paragraph>
    <Example file="choose-weight.png" alt="Expanded weight suggestion showing A beside Why?, previous and suggested sets, and B beside Use suggestion.">
      <p><strong>A</strong> — See what the recommendation is based on.</p><p><strong>B</strong> — Apply it, keep your previous values or enter your own.</p>
    </Example>
    <Details title="How are weight increases calculated?">
      <Paragraph>For a rep range of 8–12, every planned working set must reach 12 reps in one qualifying workout before the app suggests more weight. Reaching 12 on just one set is not enough. Warmup and deload sets do not qualify.</Paragraph>
      <Paragraph>The previous workout must match the routine, number of working sets and rep range. Older or incomplete records may help you compare, but cannot trigger an automatic increase. Otherwise the suggestion generally keeps the load and builds reps within the range.</Paragraph>
      <Paragraph>The suggested load follows the equipment base and increments you configured. For example, a 22.56 kg machine plus 5 kg and 2.5 kg totals 30.06 kg. If an old weight no longer fits your equipment settings, Keep previous values is unavailable; use the feasible suggestion or enter your own.</Paragraph>
    </Details>
    <Details title="What if I’m starting fresh or want to increase now?">
      <Paragraph>With no matching history, a suggestion may use a related-exercise estimate or the routine’s starting weight. If neither is available, the app uses the equipment’s starting weight, or 0 if unset, and asks you to choose. Zero does not mean you should train without a load.</Paragraph>
      <Paragraph>In an active exercise, the small dumbbell with a rising red line beside Change exercise previews one equipment step. Review and apply it explicitly. It changes only unfinished working sets, keeping reps, warmups, deloads, completed sets and routine defaults unchanged. That manual action alone does not qualify a future automatic increase.</Paragraph>
      <Paragraph>For future starting values, edit the saved routine separately. Save rest to protocol and Neural Refresh are separate actions that can change future routine settings; simply accepting a workout suggestion does not.</Paragraph>
    </Details>
    <Details title="Dumbbells, assisted exercises and timed workouts">
      <Paragraph>Dumbbell weights are per hand. For an assisted exercise, less assistance makes the exercise harder, so the manual action is Reduce assistance.</Paragraph>
      <Paragraph>Timed exercises and fixed-prescription block workouts do not use ordinary weight-and-rep progression. Adjust them manually where needed. A suggestion is a guide based on recorded information, not a test of what you can safely lift.</Paragraph>
    </Details>
  </Article>;
}

export function RestoreBackupArticle() {
  return <Article>
    <Paragraph>Use a backup to bring earlier records back onto this device. You’ll see a comparison before anything is replaced.</Paragraph>
    <aside className="border-l-2 border-amber-400 pl-4 text-slate-200" aria-label="Before restoring"><strong>Before you restore:</strong> this replaces your current records, including an unfinished workout. A category marked Missing will be cleared, not kept. Back up any current records you want to keep before continuing.</aside>
    <Steps>
      <li><strong>Open Vault Backup</strong> from the menu or desktop sidebar.</li>
      <li><strong>Choose your backup.</strong> Use Restore from File for a downloaded JSON file, or Restore from Google Drive to choose a device backup.</li>
      <li><strong>Check the comparison.</strong> Look at the backup name, date and category counts. Pay particular attention to anything marked Missing. Cancel if this is not the copy you want.</li>
      <li><strong>Restore and reopen.</strong> Choose Restore this backup, then Continue to reload the app with the restored records.</li>
    </Steps>
    <Example file="restore-backup.png" alt="Backup review showing A beside the replacement warning and B beside a food category marked Missing.">
      <p><strong>A</strong> — Read what will be replaced.</p><p><strong>B</strong> — Missing means this category will be cleared.</p>
    </Example>
    <Paragraph>After restoring, local saving continues. <strong>Drive backups stay paused</strong> so the restored copy does not immediately replace your cloud backup. Choose <strong>Back up restored data</strong> when you are ready.</Paragraph>
    <Details title="Can I undo a restore?">
      <Paragraph>Yes, while the local recovery copy is still available. Open Vault Backup → Review undo restore, check the comparison, then confirm Undo restore.</Paragraph>
      <Paragraph>Undo replaces changes made since the restore and can use that recovery copy only once. Another restore replaces the previous recovery copy. Clearing browser data removes it. Drive backups stay paused after undo too.</Paragraph>
    </Details>
    <Details title="What happens to settings and older backups?">
      <Paragraph>Device settings and the Google Drive connection stay as they are. Older backups can still load, but categories they do not contain are cleared. Restore does not merge records or let you select only part of a backup.</Paragraph>
      <Paragraph>Invalid files are rejected before replacement. The app saves a local recovery copy as part of restoring; if it cannot do that, the existing records are kept. Resolve failed local saves before trying again.</Paragraph>
      <Paragraph>A local JSON export currently leaves out your unfinished workout; Drive backups can contain its saved draft. CSV is not a full app backup. See JSON backup contents and export for the full list of included records.</Paragraph>
    </Details>
  </Article>;
}
