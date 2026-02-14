import { DateTime } from "luxon";

export interface WorkOrder {
    docId: string;                  // Unique identifier
    docType: string;                // Document type
    data: {
        workOrderNumber: string;
        manufacturingOrderId: string;
        workCenterId: string;

        // Timing
        startDate: string;
        endDate: string;
        durationMinutes: number;        // Total working time required

        // Constraints
        isMaintenance: boolean;         // Cannot be rescheduled if true

        // Dependencies (can have multiple parents)
        dependsOnWorkOrderIds: string[]; // All must complete before this starts
    }
}

export class WorkCenter {
    docId: string;                  // Unique identifier
    docType: string;                // Document type
    calendar: WorkCenterCalendar    // Calendar with shifts and maintenance windows
    data: {
        name: string;

        // Shifts
        shifts: Array<{
            dayOfWeek: number;           // 0-6, Sunday = 0
            startHour: number;           // 0-23
            endHour: number;             // 0-23
        }>;

        // Maintenance windows (blocked time periods)
        maintenanceWindows: Array<{
            startDate: string;
            endDate: string;
            reason?: string; // Optional description
        }>;
    }

    constructor(
        docId: string,
        name: string,
        calendar: WorkCenterCalendar,
    ) {
        this.docId = docId;
        this.docType = "workCenter";
        this.calendar = calendar;
        this.data = {
            name,
            shifts: [],
            maintenanceWindows: []
        }
    }
}

export interface ManufacturingOrder {
    docId: string;                      // Unique identifier
    docType: "manufacturingOrder";      // Document type
    data: {
        manufacturingOrderNumber: string;
        itemId: string;
        quantity: number;
        dueDate: string;
    }
}

export interface Result {
    resultingWorkOrders: WorkOrder[];   // WorkOrder list with no conflicts
    changes: Change[];                  // List of changes made
}

export interface Change {
    workOrderId: string;                // WorkOrder changed
    oldStartTime: string;               // Previous start time
    newStartTime: string;               // New conflict-free start time
    oldEndTime: string;                 // Previous end time
    newEndTime: string;                 // New conflict-free end time
    delayReason: string;                // Human readable explanation for the new time
}

// Interface for work center calendar logic, including maintenance windows and shift definitions
export interface WorkCenterCalendar {

    getNextMaintenanceAfter(time: DateTime): MaintenanceWindow | null

    isWorkingTime(time: DateTime): boolean

    nextWorkingTimeAfter(time: DateTime): DateTime

    normalizeToWorkingTime(time: DateTime): DateTime

    allocateAroundMaintenance(
        earliest: DateTime,
        durationMinutes: number
    ): {
        start: DateTime
        logicalEnd: DateTime
    }

    allocateWorkingMinutes(
        start: DateTime,
        durationMinutes: number
    ): DateTime

}

// Simple implementation of WorkCenterCalendar that accounts for maintenance windows and shifts
export class SimpleWorkCenterCalendar implements WorkCenterCalendar {

    private maintenanceWindows: MaintenanceWindow[]

    private shifts: ShiftDefinition[]

    constructor(
        maintenanceWindows: MaintenanceWindow[],
        shifts: ShiftDefinition[]
    ) {
        this.maintenanceWindows = maintenanceWindows
            .slice()
            .sort((a, b) => a.start.toMillis() - b.start.toMillis())

        this.shifts = shifts
    }

    // Allocates a time slot for the given duration starting at the earliest possible time, while skipping over any maintenance windows
    allocateAroundMaintenance(
        earliest: DateTime,
        durationMinutes: number
    ): { start: DateTime; logicalEnd: DateTime } {

        let remaining = durationMinutes
        let cursor = earliest.toUTC()

        // We loop through maintenance windows until we've found enough time to fit the entire duration, moving the cursor forward as needed
        while (true) {
            const maintenance = this.getNextMaintenanceAfter(cursor)
            // console.log(`Next maintenance after ${cursor.toISO()} is ${maintenance ? maintenance.start.toISO() : "none"}`)
            if (!maintenance) {
                return {
                    start: cursor,
                    logicalEnd: cursor.plus({ minutes: remaining }).toUTC()
                }
            }

            // If the next maintenance window starts after the remaining duration can be completed, we can schedule the work order before that maintenance window
            const minutesUntilMaintenance = maintenance.start.diff(cursor, "minutes").minutes

            // console.log(`Minutes until maintenance: ${minutesUntilMaintenance}, remaining duration: ${remaining}`)

            if (minutesUntilMaintenance >= remaining) {
                return {
                    start: cursor,
                    logicalEnd: cursor.plus({ minutes: remaining }).toUTC()
                }
            } else {
                // Otherwise, we move the cursor to the end of the maintenance window and loop to check for the next maintenance window
                cursor = maintenance.end.plus({ milliseconds: 1 }).toUTC() // Add 1 ms to ensure we move past the maintenance window
            }
        }
    }

    // Returns the next maintenance window that starts after the given time, or null if there are no more maintenance windows
    getNextMaintenanceAfter(time: DateTime): MaintenanceWindow | null {
        for (const window of this.maintenanceWindows) {
            window.end = window.end.toUTC()
            window.start = window.start.toUTC()
            if (window.end <= time.toUTC()) continue
            return window
        }
        return null
    }

    // Checks if the given time falls within any of the defined shifts
    isWorkingTime(time: DateTime): boolean {
        const day = time.weekday

        // Check if time falls within any shift for the day
        for (const shift of this.shifts) {
            // If the shift isn't even on the same day, skip
            if (shift.dayOfWeek !== day) continue

            const shiftStart = time
                .set({ hour: shift.startHour, minute: 0, second: 0, millisecond: 0 }).toUTC()

            const shiftEnd = time
                .set({ hour: shift.endHour, minute: 0, second: 0, millisecond: 0 }).toUTC()

            // console.log(`Checking if ${time.toISO()} is between ${shiftStart.toISO()} and ${shiftEnd.toISO()}`)

            if (time >= shiftStart && time < shiftEnd) {
                return true
            }
        }

        return false
    }

    // If the given time is not within working hours, returns the next time that is. If it is already within working hours, returns the same time.
    nextWorkingTimeAfter(time: DateTime): DateTime {

        // If already working, return as-is
        if (this.isWorkingTime(time)) {
            return time
        }

        let cursor = time

        // Search up to 7 days ahead (covers weekly pattern)
        for (let i = 0; i < 7; i++) {

            const day = cursor.weekday

            // Find shifts for this day
            const shiftsToday = this.shifts
                .filter(s => s.dayOfWeek === day)
                .sort((a, b) => a.startHour - b.startHour)

            // Find the first shift that starts after the current time
            for (const shift of shiftsToday) {
                const shiftStart = cursor.set({
                    hour: shift.startHour,
                    minute: 0,
                    second: 0,
                    millisecond: 0
                }).toUTC()

                // If the shift starts after the current time, return the start of that shift
                if (cursor <= shiftStart) {
                    return shiftStart
                }
            }

            // Move to next day at midnight
            cursor = cursor
                .plus({ days: 1 })
                .startOf("day")
        }

        throw new Error("No working time found within next 7 days")
    }

    // Allocates the given duration starting at the earliest possible time while accounting for both maintenance windows and working hours
    allocateWorkingMinutes(
        start: DateTime,
        durationMinutes: number
    ): DateTime {

        let current = this.normalizeToWorkingTime(start)
        let remaining = durationMinutes

        // We loop until we've allocated the full duration, moving the current time forward as we account for maintenance and non-working hours
        while (remaining > 0) {

            // Take note of the end of the current shift so we don't schedule past it
            const shiftEnd = this.getShiftEndFor(current)
            const availableMinutes = shiftEnd.diff(current, "minutes").minutes

            // If there's enough time in the current shift to complete the remaining duration, we can return the end time
            if (remaining <= availableMinutes) {
                return current.plus({ minutes: remaining }).toUTC()
            }

            remaining -= availableMinutes

            // Move current to the next working time after the end of the shift
            current = this.nextWorkingTimeAfter(
                shiftEnd.plus({ milliseconds: 1 }).toUTC()
            )
        }

        return current
    }

    // If the given time is outside of working hours, returns the next working time. If it is within working hours, returns the same time.
    normalizeToWorkingTime(time: DateTime): DateTime {
        if (this.isWorkingTime(time)) {
            return time
        }

        return this.nextWorkingTimeAfter(time)
    }

    // Helper function to get the end time of the current shift given a time that falls within that shift
    getShiftEndFor(time: DateTime): DateTime {
        const day = time.weekday

        // Find the shift that matches the current time
        const shift = this.shifts.find(
            s => s.dayOfWeek === day &&
                time.hour >= s.startHour &&
                time.hour < s.endHour
        )

        if (!shift) {
            throw new Error("Time is not within a shift")
        }

        return time.set({
            hour: shift.endHour,
            minute: 0,
            second: 0,
            millisecond: 0
        }).toUTC()
    }

}

type MaintenanceWindow = {
    start: DateTime
    end: DateTime
}

type ShiftDefinition = {
    dayOfWeek: number // 1–7 (Luxon)
    startHour: number // 0-23
    endHour: number // 0-23
}