"""Reporting calendar.

The BRD fixes four cadences:

    daily      T+1, 07:00 — covers the previous day
    weekly     Monday      — covers the previous Mon-Sun week
    monthly    3rd working day — covers the previous month
    quarterly  5th working day — covers the previous quarter

"Working day" is Monday-Friday minus the configured holiday list. Holidays are
configuration so a deployment can load the local (e.g. KSA) calendar without a
code change.
"""

from __future__ import annotations

import calendar
import datetime
from dataclasses import dataclass
from typing import Iterable

CADENCES = ("daily", "weekly", "monthly", "quarterly")

# Populated from settings at boot; ISO date strings.
HOLIDAYS: set[datetime.date] = set()


def set_holidays(dates: Iterable[str]) -> None:
    HOLIDAYS.clear()
    for value in dates:
        try:
            HOLIDAYS.add(datetime.date.fromisoformat(value))
        except ValueError:
            continue


def is_working_day(day: datetime.date) -> bool:
    return day.weekday() < 5 and day not in HOLIDAYS


def nth_working_day(year: int, month: int, n: int) -> datetime.date:
    """The n-th working day of a given month (1-indexed)."""
    day = datetime.date(year, month, 1)
    seen = 0
    last = calendar.monthrange(year, month)[1]
    while day.day <= last:
        if is_working_day(day):
            seen += 1
            if seen == n:
                return day
        if day.day == last:
            break
        day += datetime.timedelta(days=1)
    return day


@dataclass(frozen=True)
class Period:
    """A reporting window. `end` is exclusive."""

    start: datetime.datetime
    end: datetime.datetime
    label: str
    grain: str = "day"          # day | week | month | quarter | custom

    def previous(self) -> "Period":
        """The comparison window immediately before this one, same length."""
        span = self.end - self.start
        if self.grain == "month":
            start = _add_months(self.start, -1)
            return Period(start, self.start, _month_label(start), "month")
        if self.grain == "quarter":
            start = _add_months(self.start, -3)
            return Period(start, self.start, _quarter_label(start), "quarter")
        return Period(self.start - span, self.start, f"prior {self.label}", self.grain)

    def previous_year(self) -> "Period":
        return Period(
            _add_months(self.start, -12),
            _add_months(self.end, -12),
            f"{self.label} last year",
            self.grain,
        )


def _add_months(dt: datetime.datetime, months: int) -> datetime.datetime:
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _month_label(dt: datetime.datetime) -> str:
    return dt.strftime("%b %Y")


def _quarter_label(dt: datetime.datetime) -> str:
    return f"Q{(dt.month - 1) // 3 + 1} {dt.year}"


def _midnight(day: datetime.date) -> datetime.datetime:
    return datetime.datetime(day.year, day.month, day.day)


def period_for(cadence: str, as_of: datetime.datetime) -> Period:
    """The window a run started at `as_of` should report on."""
    today = as_of.date()

    if cadence == "daily":
        start = today - datetime.timedelta(days=1)
        return Period(_midnight(start), _midnight(today), start.strftime("%d %b %Y"), "day")

    if cadence == "weekly":
        this_monday = today - datetime.timedelta(days=today.weekday())
        last_monday = this_monday - datetime.timedelta(days=7)
        iso_week = last_monday.isocalendar()
        return Period(
            _midnight(last_monday),
            _midnight(this_monday),
            f"Week {iso_week.week} {iso_week.year}",
            "week",
        )

    if cadence == "monthly":
        first_this = today.replace(day=1)
        last_month_end = first_this
        first_last = (first_this - datetime.timedelta(days=1)).replace(day=1)
        return Period(
            _midnight(first_last), _midnight(last_month_end),
            first_last.strftime("%b %Y"), "month",
        )

    if cadence == "quarterly":
        quarter_start_month = (today.month - 1) // 3 * 3 + 1
        this_q_start = today.replace(month=quarter_start_month, day=1)
        prev_q_end = this_q_start
        prev_q_start = (this_q_start - datetime.timedelta(days=1)).replace(day=1)
        prev_q_start = prev_q_start.replace(month=(prev_q_start.month - 1) // 3 * 3 + 1, day=1)
        return Period(
            _midnight(prev_q_start), _midnight(prev_q_end),
            f"Q{(prev_q_start.month - 1) // 3 + 1} {prev_q_start.year}", "quarter",
        )

    raise ValueError(f"unknown cadence: {cadence}")


def next_run_at(cadence: str, after: datetime.datetime, hour: int = 7) -> datetime.datetime:
    """When the next run of `cadence` is due, strictly after `after`."""
    day = after.date()

    if cadence == "daily":
        candidate = datetime.datetime.combine(day, datetime.time(hour))
        if candidate <= after:
            candidate += datetime.timedelta(days=1)
        return candidate

    if cadence == "weekly":
        days_ahead = (0 - day.weekday()) % 7
        candidate = datetime.datetime.combine(
            day + datetime.timedelta(days=days_ahead), datetime.time(hour)
        )
        if candidate <= after:
            candidate += datetime.timedelta(days=7)
        return candidate

    if cadence == "monthly":
        candidate = datetime.datetime.combine(
            nth_working_day(day.year, day.month, 3), datetime.time(hour)
        )
        if candidate <= after:
            nxt = _add_months(datetime.datetime.combine(day.replace(day=1), datetime.time(hour)), 1)
            candidate = datetime.datetime.combine(
                nth_working_day(nxt.year, nxt.month, 3), datetime.time(hour)
            )
        return candidate

    if cadence == "quarterly":
        quarter_start_month = (day.month - 1) // 3 * 3 + 1
        candidate = datetime.datetime.combine(
            nth_working_day(day.year, quarter_start_month, 5), datetime.time(hour)
        )
        if candidate <= after:
            nxt = _add_months(
                datetime.datetime(day.year, quarter_start_month, 1, hour), 3
            )
            candidate = datetime.datetime.combine(
                nth_working_day(nxt.year, nxt.month, 5), datetime.time(hour)
            )
        return candidate

    raise ValueError(f"unknown cadence: {cadence}")


def named_period(name: str, as_of: datetime.datetime) -> Period | None:
    """Resolve the period phrases the chat agent understands."""
    today = as_of.date()
    name = (name or "").strip().lower()

    if name in ("this month", "current month", "month to date", "mtd"):
        start = today.replace(day=1)
        return Period(_midnight(start), _midnight(today) + datetime.timedelta(days=1),
                      start.strftime("%b %Y"), "month")
    if name in ("last month", "previous month"):
        return period_for("monthly", as_of)
    if name in ("this quarter", "current quarter", "qtd"):
        start = today.replace(month=(today.month - 1) // 3 * 3 + 1, day=1)
        return Period(_midnight(start), _midnight(today) + datetime.timedelta(days=1),
                      _quarter_label(_midnight(start)), "quarter")
    if name in ("last quarter", "previous quarter"):
        return period_for("quarterly", as_of)
    if name in ("this year", "ytd", "year to date"):
        start = today.replace(month=1, day=1)
        return Period(_midnight(start), _midnight(today) + datetime.timedelta(days=1),
                      str(today.year), "custom")
    if name in ("last year", "previous year"):
        start = today.replace(year=today.year - 1, month=1, day=1)
        end = today.replace(month=1, day=1)
        return Period(_midnight(start), _midnight(end), str(start.year), "custom")
    if name in ("today",):
        return Period(_midnight(today), _midnight(today) + datetime.timedelta(days=1),
                      "today", "day")
    if name in ("yesterday",):
        return period_for("daily", as_of)
    if name in ("last 7 days", "last week", "past week"):
        start = today - datetime.timedelta(days=7)
        return Period(_midnight(start), _midnight(today) + datetime.timedelta(days=1),
                      "last 7 days", "day")
    if name in ("last 30 days", "past 30 days"):
        start = today - datetime.timedelta(days=30)
        return Period(_midnight(start), _midnight(today) + datetime.timedelta(days=1),
                      "last 30 days", "day")
    if name in ("last 90 days", "past 90 days"):
        start = today - datetime.timedelta(days=90)
        return Period(_midnight(start), _midnight(today) + datetime.timedelta(days=1),
                      "last 90 days", "day")
    return None
