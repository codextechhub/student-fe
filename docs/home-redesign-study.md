# Student home redesign: first review

## What the current app does

The signed-in home in `src/pages/home.tsx` shows identity, today's timetable,
attendance, fees, and the latest notice. The surrounding `AppShell` already
uses a floating, translucent five-slot tab bar. The existing home blocks have
similar borders, padding, and visual weight, so the next class and any urgent
notice are harder to pick out at a glance. The header also repeats information
shown in the greeting.

The backend delivers these home blocks together, and each block can be
unavailable independently. The redesign must keep that behavior, the existing
links, and the per-pupil data boundaries. The prototype is deliberately separate
from the live route while the direction is under review.

## References studied

- [Apple, Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass): glass belongs mainly on the top navigation layer. The content beneath still needs a clear hierarchy and readable surfaces. This is native platform guidance; the PWA prototype interprets its visual principles in CSS.
- [Apple, Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): stable, recognizable destinations and a More destination when space is limited. The existing app already follows this structure.
- [Dribbble, School App Dashboard — Student & Parent Experience](https://dribbble.com/shots/26566489-School-App-Dashboard-Student-Parent-Experience): compact overview cards and a prominent daily schedule.
- [Dribbble, School Management Mobile App](https://dribbble.com/shots/26961550-School-Management-Mobile-App-UI-Design): grouped school information, soft palette, and clear status cues.
- [Mobbin](https://mobbin.com/): surveyed its public design library and mobile-screen framing. Individual screen detail was not available from its public page, so no specific Mobbin screen was copied.

## Proposed home direction

1. A compact school header and a vivid welcome cover establish identity.
2. Translucency stays on the cover chips and floating tab bar. Timetable, fees,
   and notices sit on opaque cards for legibility.
3. Today's classes become the first content block. A simple timeline highlights
   the current and next period. The live implementation will use the server's
   `now` and `next` states; the sample in the prototype is illustrative.
4. Attendance and fee balance become two quick-glance cards. They retain their
   labels and status text, rather than relying on color alone.
5. The latest notice sits below the overview with a clear unread cue.
6. The layout uses one column on a phone and two columns on larger screens.
   Safe-area spacing leaves room for the floating tab bar on an installed PWA.

## Review boundary

The approved direction is implemented in `src/pages/home.tsx` against the
existing `home/` response, including unavailable, empty, unpublished, offline,
and unread states. The sample-data prototype was removed after implementation.
