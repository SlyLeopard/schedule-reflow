export interface workOrder {
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

export interface workCenter {
    docId: string;                  // Unique identifier
    docType: string;                // Document type
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

export interface manufacturingOrder {
    docId: string;                  // Unique identifier
    docType: "manufacturingOrder";  // Document type
    data: {
        manufacturingOrderNumber: string;
        itemId: string;
        quantity: number;
        dueDate: string;
    }
}