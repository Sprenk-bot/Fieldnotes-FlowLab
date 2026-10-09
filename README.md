# Fieldnotes — FlowLab

A responsive, browser-based classroom tool for investigating water movement through soil and rock. Teachers can tailor the class and roster to their needs.

## Open the website

Open `index.html` in a modern browser. For reliable save and student-link behaviour, serve the folder as a static website and open it on `localhost` or a hosted domain.

The teacher desk displays a student version link ending in `?mode=join&code=...`, which fills in the current class code for students. Each class receives a random student class code and a separate random teacher recovery code. Share only the class code with students and keep the teacher code private. Enter both codes in **Reopen a saved class** to recover a shared class on another device. The teacher desk also includes an encrypted URL backup as an additional manual recovery option. Students enter the first or full name their teacher added to the roster. Names are checked without case sensitivity. A unique first name is accepted.

## Included

- Large, high-contrast text and more spacing throughout the activity and teacher pages.
- Ten illustrated materials available in both Simple and Advanced modes, with a visual material picker and a selected-material illustration.
- A large animated permeameter illustration beside the cumulative water graph. Comparison samples stack vertically so each can be read and watched together.
- A 0–120-second trial timeline and 10-second advance button. Scrubbing backward inspects stored values; moving forward extends the cumulative simulation using the current settings.
- One comparison graph for one to three materials, with a shared linear millilitre axis, nice dynamic tick intervals and a shared 0–120-second time axis. Solid lines preserve recorded cumulative results; dotted lines estimate future results under the current settings. Small volumes may sit close to zero when compared with much larger volumes.
- Parameter changes during a trial are stored as per-material simulation events, so collected water before a change stays fixed and later flow changes the line slope. Saved trial exports include the settings in effect at each recorded point.
- Newest-first Activity History with the water head, material depth, compaction, collected volume, elapsed time and pore space for each saved attempt. Saved result lines can be overlaid on the graph, and each attempt can be downloaded as CSV.
- Short graph explanations, glossary meanings and everyday examples. Glossary help works with hover, keyboard focus and click/touch.
- A four-step Investigation Guide that updates with learner progress and links directly to its questions.
- A short inquiry sequence that students can answer using Simple mode. Teachers can edit the task, learning intention, prompts and step notes for each class.
- A teacher desk with multiple saved classes, editable names, random class codes, teacher class-code recovery, expandable lesson history, alphabetised rosters, bulk name pasting, learner add/edit/remove controls, class closing, student join link, learner profiles, manual marks and feedback, full comparison-aware session replay, and CSV export.
- A student join URL and QR-code dialog in the header, plus a teacher-only learner preview route with a clear return to the Teacher Desk. The QR image is requested from QRServer when opened; the encoded destination is the public student join URL.
- Shared Supabase storage for class settings, roster names, published lesson versions, learner answers, progress and replay events. Browser storage is retained as a local cache; students can rejoin on another device using the class code and roster name.

## Classroom storage boundary

This GitHub Pages site uses a Supabase Edge Function as the access-controlled server layer. The browser contains only a publishable key; the database service key stays in the Edge Function. Row-level security is enabled and direct browser access to classroom tables is denied. Teachers use a class code plus private teacher recovery code; students use the class code and a roster name. Student work is stored per learner to prevent simultaneous saves from overwriting another learner’s records. This is a class-code access model, not a personal sign-in system. Class names, learner roster names, answers and activity/replay data are stored in the Supabase project so they can be shared across devices. Use only data appropriate for your setting, keep codes private, and delete class records when no longer needed. The encrypted URL backup remains available as a manual snapshot; treat its link and both codes as private, and note that browser history/message apps may retain the link.

The student join URL is generated from the website’s current origin, so it points to the published domain. The Pages workflow copies `supabase-config.js` to both the main site and classroom route.

## Publish with GitHub Pages

The included `.github/workflows/pages.yml` deploys `index.html`, `app.js`, `styles.css` and `supabase-config.js` to GitHub Pages whenever `main` is updated, including a direct classroom route at `/local-geology/water-movement-permeability-and-porosity/`. In the repository’s **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. GitHub Pages is public; the repository source will also be public on the free plan.

## Shared-class deployment path

The Supabase project is `fieldnotes-flowlab` in the `ap-southeast-2` (Sydney) region. Its current quoted project cost was $0/month when created. Review current Supabase plan limits and usage in its dashboard; project pricing and quotas can change.

## Teaching model and scope

The investigation supports a three-material comparison and a classroom rain-garden inquiry. It is one learning resource, not a substitute for other lesson activities or the class assessment form. The prompts support prediction, fair testing, observing, interpreting patterns and evaluating model limits. The teacher can copy or edit prompt wording in the Teacher desk.

The Master Project Planner specifies Microsoft Forms while the concept notes mention Google Forms. The interface says “class form” and does not assume or embed either platform.

Material artwork is a representative classroom illustration rather than a photograph. The displayed porosity bands and flow categories are teaching-model outputs, not field measurements. Advanced hydraulic-conductivity values are illustrative inputs. Natural samples vary, and compaction is represented with a simplified classroom curve.
