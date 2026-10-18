# Timetable redesign: review prototype

The current timetable repeats today's classes above a second day-by-day week
list. On a phone that makes the schedule longer than it needs to be. The new
prototype makes the **current lesson** the focal point, then gives pupils a
five-day selector and one chronological class list. On wider screens, a compact
week summary sits below the day view. The same visual language as Home carries
through: one vivid cover, glass only for short chips and navigation, and opaque
cards for detailed text.

References: [Student Scheduling Mobile App on Dribbble](https://dribbble.com/shots/27696305-Student-Scheduling-Mobile-App), [School timetable V2 on Dribbble](https://dribbble.com/shots/1111355-School-Education-App-timetable-V2), and [Apple's picker guidance](https://developer.apple.com/design/human-interface-guidelines/pickers). A week strip fits this fixed school schedule more directly than a month calendar.

The approved direction is implemented in `src/pages/timetable.tsx`: current
and next lesson come from the server's period states, each day's classes come
from `timetable/`, and the unpublished state keeps its existing explanation.
The API does not supply a date for each weekday, so the live weekday selector
uses day names rather than guessed dates. The sample-data prototype was removed
after implementation.
