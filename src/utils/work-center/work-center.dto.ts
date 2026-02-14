export type WorkCenterDTO = {
    docId: string
    docType: string
    data: {
        name: string
        shifts: ShiftDefinition[]
        maintenanceWindows: {
            start: string
            end: string
        }[]
    }
}

type ShiftDefinition = {
    dayOfWeek: number // 1–7 (Luxon)
    startHour: number // 0-23
    endHour: number // 0-23
}