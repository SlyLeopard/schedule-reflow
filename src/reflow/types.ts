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

export interface WorkCenter {
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
        let cursor = earliest

        // We loop through maintenance windows until we've found enough time to fit the entire duration, moving the cursor forward as needed
        while (true) {
            const maintenance = this.getNextMaintenanceAfter(cursor)

            if (!maintenance) {
                return {
                    start: earliest,
                    logicalEnd: cursor.plus({ minutes: remaining })
                }
            }

            // If the next maintenance window starts after the remaining duration can be completed, we can schedule the work order before that maintenance window
            const minutesUntilMaintenance =
                maintenance.start.diff(cursor, "minutes").minutes

            if (minutesUntilMaintenance >= remaining) {
                return {
                    start: earliest,
                    logicalEnd: cursor.plus({ minutes: remaining })
                }
            }

            remaining -= minutesUntilMaintenance
            cursor = maintenance.end
        }
    }

    // Returns the next maintenance window that starts after the given time, or null if there are no more maintenance windows
    getNextMaintenanceAfter(time: DateTime): MaintenanceWindow | null {
        for (const window of this.maintenanceWindows) {
            if (window.end <= time) continue
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
                .set({ hour: shift.startHour, minute: 0, second: 0, millisecond: 0 })

            const shiftEnd = time
                .set({ hour: shift.endHour, minute: 0, second: 0, millisecond: 0 })

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
                })

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

    // If the given time is outside of working hours, returns the next working time. If it is within working hours, returns the same time.
    normalizeToWorkingTime(time: DateTime): DateTime {
        if (this.isWorkingTime(time)) {
            return time
        }

        return this.nextWorkingTimeAfter(time)
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