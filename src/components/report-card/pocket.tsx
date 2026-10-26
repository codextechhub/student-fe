import type { ReactNode } from "react";

import type { CardLine, Cumulative, ReportCard } from "@/redux/services/report-card-types";

/**
 * The report card on a phone (design 2e): the school's paper card in small,
 * on the screen, with the same letterhead, facts, marks, figures, comments
 * and grading key as the A4 sheet that prints (`ReportCardSheet`).
 *
 * As with the sheet, every word and figure is the server's and only what the
 * payload carries is drawn: class figures, ratings, comments or the year
 * appear only where the school printed them and the reader may read them.
 * The marks table keeps to the columns a phone can hold; anything wider
 * (class figures) scrolls inside it rather than the screen. A last term's
 * card adds the year as its own small table under the term's. A subject's
 * written remark is the A4 sheet's, which the Download PDF button prints.
 */
export function ReportCardPocket({ card }: { card: ReportCard }) {
  const { letterhead } = card;
  const address = [letterhead.branch_name, letterhead.branch_address, letterhead.phone].filter(Boolean).join(" · ");
  const first = card.subjects[0] ?? {};
  const showCells = card.components.length > 0 && card.subjects.some((subject) => subject.cells);
  const showFigures = "total" in first;
  const showStats = card.subjects.some((subject) => "class_average" in subject);

  return (
    <article className="report-pocket" aria-label="Report card">
      <div className="report-pocket-head">
        {letterhead.logo_url && <img src={letterhead.logo_url} alt="" />}
        <div>
          <p className="report-pocket-school">{letterhead.school_name}</p>
          {address && <p className="report-pocket-address">{address}</p>}
          <p className="report-pocket-term">{card.term_line}</p>
        </div>
      </div>

      {card.facts.length > 0 && <Lines lines={card.facts} className="report-pocket-facts" />}

      {card.subjects.length > 0 ? (
        <div className="report-pocket-scroll">
          <table className="report-pocket-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                {showCells && card.components.map((component) => (
                  <th scope="col" key={component.short_name}>{component.short_name}<span>{component.max_score}</span></th>
                ))}
                {showFigures && <th scope="col">Total</th>}
                {showFigures && <th scope="col"><abbr title="Grade">Grd</abbr></th>}
                {showStats && <th scope="col">Class<span>avg</span></th>}
                {showStats && <th scope="col">High</th>}
                {showStats && <th scope="col">Low</th>}
              </tr>
            </thead>
            <tbody>
              {card.subjects.map((subject) => (
                <tr key={subject.name}>
                  <th scope="row">{subject.name}</th>
                  {showCells && card.components.map((component, index) => <td key={component.short_name}>{subject.cells?.[index] || "-"}</td>)}
                  {showFigures && <td className="is-total">{subject.total ?? "-"}</td>}
                  {showFigures && <td>{subject.grade ?? "-"}</td>}
                  {showStats && <td>{subject.class_average ?? "-"}</td>}
                  {showStats && <td>{subject.highest ?? "-"}</td>}
                  {showStats && <td>{subject.lowest ?? "-"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="report-pocket-empty">No subjects are listed on this card.</p>}

      {card.totals.length > 0 && <Lines lines={card.totals} className="report-pocket-totals" />}

      {card.cumulative && <Year cumulative={card.cumulative} />}

      {card.attendance && card.attendance.length > 0 && <Box title="Attendance"><Lines lines={card.attendance} className="report-pocket-totals" /></Box>}
      {card.ratings && card.ratings.length > 0 && (
        <Box title="Conduct and skills">
          {card.rating_key && <p className="report-pocket-key">{card.rating_key}</p>}
          <Lines lines={card.ratings.map((rating) => ({ label: rating.trait, value: String(rating.value) }))} className="report-pocket-totals" />
        </Box>
      )}
      {"teacher_comment" in card && <Box title="Class teacher's comment"><p>{card.teacher_comment || "-"}</p>{card.teacher_name && <small>{card.teacher_name}</small>}</Box>}
      {"principal_comment" in card && <Box title="Principal's comment"><p>{card.principal_comment || "-"}</p>{card.principal_name && <small>{card.principal_name}</small>}</Box>}

      <div className="report-pocket-foot">
        <p>{card.grading_key}</p>
        {card.next_term_line && <p className="is-strong">{card.next_term_line}</p>}
        {card.version > 1 && <p>Version {card.version}: corrected after publication.</p>}
      </div>
    </article>
  );
}

/** The year on a last term's card: each subject's total per term and the annual average, then the year's lines. */
function Year({ cumulative }: { cumulative: Cumulative }) {
  const showsTotals = cumulative.subjects.some((subject) => subject.totals);
  const showsAnnual = cumulative.subjects.some((subject) => "annual_average" in subject);
  const lines: CardLine[] = [
    ...(cumulative.annual_average ? [{ label: "Annual average", value: cumulative.annual_average }] : []),
    ...(cumulative.annual_position ? [{ label: "Annual position", value: cumulative.annual_position }] : []),
  ];
  return (
    <Box title="The school year">
      {(showsTotals || showsAnnual) && cumulative.subjects.length > 0 && (
        <div className="report-pocket-scroll">
          <table className="report-pocket-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                {showsTotals && cumulative.terms.map((term) => <th scope="col" key={term}>{term}</th>)}
                {showsAnnual && <th scope="col">Annual</th>}
              </tr>
            </thead>
            <tbody>
              {cumulative.subjects.map((subject) => (
                <tr key={subject.name}>
                  <th scope="row">{subject.name}</th>
                  {showsTotals && cumulative.terms.map((term, index) => <td key={term}>{subject.totals?.[index] || "-"}</td>)}
                  {showsAnnual && <td className="is-total">{subject.annual_average ?? "-"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lines.length > 0 && <Lines lines={lines} className="report-pocket-totals" />}
      {cumulative.promotion_line && <p className="report-pocket-promotion">{cumulative.promotion_line}</p>}
    </Box>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-pocket-box">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Lines({ lines, className }: { lines: CardLine[]; className: string }) {
  return (
    <dl className={className}>
      {lines.map((line) => (
        <div key={line.label}><dt>{line.label}</dt><dd>{line.value || "-"}</dd></div>
      ))}
    </dl>
  );
}
