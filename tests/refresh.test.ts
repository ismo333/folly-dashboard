import assert from "node:assert/strict";
import test from "node:test";
import { playbillCards, playbillProductionDates } from "../src/lib/refresh";

const londonSource = {
  url: "https://playbill.com/shows/london",
  city: "london",
  tier: "west-end",
  kind: "playbill-cards",
  status: "Running"
} as const;

test("Playbill cards retain announced preview dates and venues", () => {
  const shows = playbillCards(`
    <div class="flex flex-col flex-1 justify-between">
      <h3><a href="/production/affluenza-london-riverside-studios-2026">Affluenza</a></h3>
      <ul>
        <li>Begins Previews Sep 26, 2026</li>
        <li role="presentation"></li>
        <li>Riverside Studios</li>
      </ul>
      <a href="/production/affluenza-london-riverside-studios-2026">View Details</a>
      <a href="https://tickets.example/affluenza">Buy Tickets</a>
    </div>
  `, londonSource);

  assert.equal(shows.length, 1);
  assert.equal(shows[0].title, "Affluenza");
  assert.equal(shows[0].venue, "Riverside Studios");
  assert.equal(shows[0].previewsFrom, "2026-09-26");
  assert.equal(shows[0].status, "Upcoming");
  assert.equal(shows[0].ticketUrl, "https://tickets.example/affluenza");
});

test("Playbill production pages provide the full announced run", () => {
  const dates = playbillProductionDates(`
    <main>
      <span>FIRST PREVIEW</span><b>SEP</b><b>26</b><b>2026</b>
      <span>OPENING DATE</span><b>OCT</b><b>5</b><b>2026</b>
      <span>CLOSING DATE</span><b>NOV</b><b>21</b><b>2026</b>
    </main>
  `);

  assert.deepEqual(dates, {
    previewsFrom: "2026-09-26",
    opening: "2026-10-05",
    closing: "2026-11-21"
  });
});
