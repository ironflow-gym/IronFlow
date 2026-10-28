/// <reference types="vite/client" />
import React from 'react';
import capturedSizes from './workflowImageSizes.json';
const imageSizes: Record<string, { width: number; height: number }> = capturedSizes;

interface WorkflowExample { file: string; title: string; alt: string; captions: string[]; }
export const workflowExamples: Record<string, WorkflowExample[]> = {
  'tr-logging': [
    { file: 'workout-values', title: 'Record a set', alt: 'Workout set showing A beside the weight, B beside reps and C beside the completion tick.', captions: ['A — Tap the weight to open its editor.', 'B — Tap reps to edit, or use the small minus/plus controls.', 'C — Tick the set after completing it.'] },
    { file: 'workout-actions', title: 'Exercise actions', alt: 'Machine Press exercise heading showing A beside Change exercise, B beside Increase weight and C beside More options.', captions: ['A — Change this exercise. Completed sets protect it from replacement.', 'B — Preview a weight increase for unfinished working sets.', 'C — Open coaching, history and instructions.'] },
    { file: 'workout-finish-rest', title: 'Rest and finish', alt: 'Workout header showing A beside Finish and B around the active rest timer.', captions: ['A — Finish records your completed sets; effort rating comes next.', 'B — Adjust or dismiss rest here. The bookmark action saves rest to a matching routine only when you choose it.'] },
  ],
  'tr-sets': [
    { file: 'set-warmup', title: 'Tap to change set type', alt: 'Set row after a short tap, showing A beside the set-number circle marked as a warmup.', captions: ['A — One short tap changes a working set to a warmup.'] },
    { file: 'set-deload', title: 'Tap again for deload', alt: 'The same set row after a second short tap, showing A beside the deload set-number circle.', captions: ['A — Another short tap changes it to deload. Tap again to return to working.'] },
    { file: 'set-delete', title: 'Hold to reveal delete', alt: 'Unfinished set showing A beside the held set number and B beside the red delete control that appears in place of the tick.', captions: ['A — Hold an unfinished set’s number to reveal deletion.', 'B — Then tap the red delete control to remove it. Holding alone does not delete the set.'] },
  ],
  'tr-blocks': [
    { file: 'block-structure', title: 'Set the block’s structure', alt: 'Training block fields showing A beside three days per week, B beside four different workouts, and C beside two rounds.', captions: ['A — How many days a week you intend to train.', 'B — How many different workouts make one round.', 'C — How many times to repeat that round. Here, four workouts × two rounds means eight sessions.'] },
    { file: 'block-session', title: 'Use an active block', alt: 'Workout A in an active block showing A beside Start session, B beside Schedule and C beside Skip session in the expanded options.', captions: ['A — Start this block session, or preview it first.', 'B — Open Session details and options to schedule it.', 'C — Skip asks for confirmation and does not count as completed training.'] },
  ],
  'tr-calendar': [
    { file: 'calendar-week', title: 'Read the week and selected day', alt: 'Populated training calendar showing A around the dated day strip with missed, rest, scheduled and completed markers, and B around today’s workout appointments.', captions: ['A — Choose a date. This example has missed training on Monday, rest on Tuesday, and both planned and completed training on Wednesday.', 'B — The selected day’s appointments appear below. Starting, editing or skipping applies to the appointment you choose.'] },
  ],
  'nu-meals': [
    { file: 'meal-repeat-action', title: 'Repeat a logged food', alt: 'Breakfast oats food entry showing A beside Repeat, alongside Edit and Delete.', captions: ['A — Repeat opens a review; it does not immediately add another entry.'] },
    { file: 'meal-repeat-review', title: 'Check the new date and amount', alt: 'Log meal review showing A beside the date, B beside Half, Same and Double amount shortcuts, and C beside Add to food log.', captions: ['A — Choose the date for the new entry.', 'B — Open Adjust amount to change the quantity. Nutrition totals change with it.', 'C — Confirm to add the reviewed copy. The original entry stays unchanged.'] },
    { file: 'meal-save-group', title: 'Save foods together', alt: 'Create saved meal showing A beside Usual breakfast, B beside selected foods and C beside Save meal.', captions: ['A — Give the reusable meal a name.', 'B — Select one or more logged foods to include.', 'C — Save the meal for later. Use View saved meals to log a reviewed copy.'] },
  ],
  'nu-barcode': [
    { file: 'barcode-basis', title: 'Check what the label values mean', alt: 'Fictional barcode product review showing A beside Values on the label set to per 100 ml and B beside Continue to amount.', captions: ['A — Match the package: per 100 g, per 100 ml or per serving. Correct any missing or wrong nutrients.', 'B — Continue to choose how much you actually had. This does not save a pantry food.'] },
    { file: 'barcode-amount', title: 'Enter the amount you had', alt: 'Food amount review showing A beside 250 ml, B beside the calculated 100 kcal total and C beside Add to food log.', captions: ['A — Enter the amount in the displayed units.', 'B — Check the resulting totals. In this fictional example, 250 ml at 40 kcal per 100 ml gives 100 kcal.', 'C — Add the entry only after checking its date and amount. Saving to the pantry is optional.'] },
  ],
  'tr-equipment': [
    { file: 'equipment-settings', title: 'Match your equipment', alt: 'Equipment settings showing A beside the 22.56 kg starting weight, B beside the 2.5 kg increment and C beside single loading.', captions: ['A — Enter the unloaded or starting weight.', 'B — Set the smallest plate or stack increment.', 'C — Choose whether that increment is added once or on both sides, then Save equipment.'] },
    { file: 'equipment-plates', title: 'Check the loading', alt: 'Plate loading details showing A beside the 30.06 kg total, B beside 5 kg and 2.5 kg plates, and C beside the 22.56 kg starting weight.', captions: ['Open this view by tapping a workout weight, expanding Plate loading and tapping its preview.', 'A — The total includes the equipment’s starting weight.', 'B — These are the added plates: 5 kg plus 2.5 kg in this example.', 'C — The configured starting weight is 22.56 kg. Check the total and plates against your equipment.'] },
  ],
  'bk-ironsync': [
    { file: 'drive-connected', title: 'Check your connected backup', alt: 'Mock-connected Drive backup settings showing A beside Vault Active and the backup date, B beside Example phone and C beside Backup Now.', captions: ['A — Check the connection and last backup date. This example uses a mocked connection.', 'B — Give this device a recognisable name.', 'C — Request a backup and check its result; keep the app open and online.'] },
    { file: 'drive-paused', title: 'After restoring a backup', alt: 'Backup and restore window showing A beside Drive backups paused after restore and B beside Back up restored data.', captions: ['A — Local saving continues, but Drive uploads stay paused.', 'B — Resume only when you are ready for the restored records to be backed up to Drive.'] },
  ],
};

export default function WorkflowExamples({ topic }: { topic: string }) {
  const examples = workflowExamples[topic];
  if (!examples) return null;
  return <section aria-label="Annotated examples" className="space-y-7">
    <p className="text-sm leading-relaxed text-slate-400">Example screens use fictional records. Your values will differ.</p>
    {examples.map(example => <figure key={example.file} className="space-y-3">
      <h4 className="text-base font-semibold text-slate-200">{example.title}</h4>
      <img src={`${import.meta.env.BASE_URL}help/${example.file}.png`} alt={example.alt} width={imageSizes[example.file]?.width} height={imageSizes[example.file]?.height} loading="lazy" className="mx-auto h-auto w-full max-w-[360px] rounded-xl border border-slate-800" />
      <figcaption className="space-y-2 text-sm leading-relaxed text-slate-400">{example.captions.map(caption => <p key={caption}>{caption}</p>)}</figcaption>
    </figure>)}
  </section>;
}
