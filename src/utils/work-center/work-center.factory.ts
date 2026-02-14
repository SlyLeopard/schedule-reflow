import { DateTime } from "luxon"
import { SimpleWorkCenterCalendar, WorkCenter } from "../../reflow/types"
import { WorkCenterDTO } from "./work-center.dto"

export function buildWorkCenter(raw: WorkCenterDTO): WorkCenter {
  const maintenance = raw.data.maintenanceWindows.map(m => ({
    start: DateTime.fromISO(m.start),
    end: DateTime.fromISO(m.end)
  }))

  const calendar = new SimpleWorkCenterCalendar(
    maintenance,
    raw.data.shifts
  )

  return new WorkCenter(
    raw.docId,
    raw.data.name,
    calendar
  )
}