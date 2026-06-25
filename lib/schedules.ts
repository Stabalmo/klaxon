import { responders, type Responder } from "./incidents"

export type Shift = {
  /** index of the weekday this shift starts on (0 = Mon ... 6 = Sun) */
  startDay: number
  /** how many consecutive days the shift spans */
  spanDays: number
  responder: Responder
}

export type ServiceSchedule = {
  id: string
  service: string
  /** responder currently on call */
  current: Responder
  /** local time the current shift ends, e.g. "18:00" */
  onCallUntil: string
  /** who takes over next */
  next: Responder
  /** the local time / day the next shift starts, e.g. "Today 18:00" */
  nextStarts: string
  /** weekly rotation, one entry per contiguous block */
  rotation: Shift[]
}

export const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** index of "today" in the weekdays array, used to highlight the current column */
export const todayIndex = 2 // Wednesday

export const schedules: ServiceSchedule[] = [
  {
    id: "checkout",
    service: "checkout-service",
    current: responders.maya,
    onCallUntil: "18:00",
    next: responders.dev,
    nextStarts: "Today 18:00",
    rotation: [
      { startDay: 0, spanDays: 3, responder: responders.maya },
      { startDay: 3, spanDays: 2, responder: responders.dev },
      { startDay: 5, spanDays: 2, responder: responders.sam },
    ],
  },
  {
    id: "payments",
    service: "payments-api",
    current: responders.dev,
    onCallUntil: "20:00",
    next: responders.jordan,
    nextStarts: "Today 20:00",
    rotation: [
      { startDay: 0, spanDays: 2, responder: responders.dev },
      { startDay: 2, spanDays: 2, responder: responders.jordan },
      { startDay: 4, spanDays: 3, responder: responders.alex },
    ],
  },
  {
    id: "auth",
    service: "auth-gateway",
    current: responders.sam,
    onCallUntil: "12:00",
    next: responders.alex,
    nextStarts: "Today 12:00",
    rotation: [
      { startDay: 0, spanDays: 1, responder: responders.sam },
      { startDay: 1, spanDays: 3, responder: responders.alex },
      { startDay: 4, spanDays: 3, responder: responders.maya },
    ],
  },
  {
    id: "notifications",
    service: "notifications-worker",
    current: responders.jordan,
    onCallUntil: "09:00",
    next: responders.maya,
    nextStarts: "Tomorrow 09:00",
    rotation: [
      { startDay: 0, spanDays: 4, responder: responders.jordan },
      { startDay: 4, spanDays: 3, responder: responders.maya },
    ],
  },
  {
    id: "search",
    service: "search-indexer",
    current: responders.alex,
    onCallUntil: "16:00",
    next: responders.sam,
    nextStarts: "Today 16:00",
    rotation: [
      { startDay: 0, spanDays: 2, responder: responders.alex },
      { startDay: 2, spanDays: 3, responder: responders.sam },
      { startDay: 5, spanDays: 2, responder: responders.dev },
    ],
  },
]
