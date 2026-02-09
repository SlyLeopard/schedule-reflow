import {
    WorkOrder,
    WorkCenter,
    Result,
    Change
} from "./types";
import {
    DateTime
} from "luxon";
import { 
    DateUtils 
} from "../utils/date.utils";

export class ReflowService {

    reflow(
        workOrders: WorkOrder[],
        workCenters: WorkCenter[]
    ): Result {
        let scheduledWorkOrders = [] // Initialize the adjusted work orders result array
        let changes = []             // Initialize the adjustment notes array

        // Topographically sort all work orders to account for dependencies
        let sortedWorkOrders = this.sortWorkOrders(workOrders)

        // Initialize all work centers time pointer to the first work order's start time
        let timePointers = DateUtils.initializeTimePointers(workCenters, sortedWorkOrders[0].data.startDate)

        // Begin iterating through all work orders and make schedule changes as needed
        for (const wo of sortedWorkOrders) {

            // Schedule the next order in line, passing all work centers and the current time pointer array
            let [scheduledWorkOrder, change] = this.scheduleWorkOrder(wo, workCenters, timePointers)

            // Save the resulting work order no matter what
            scheduledWorkOrders.push(scheduledWorkOrder)

            // We only document changes if a work order had its time changed by delays or maintenance
            if (change) {
                changes.push(change)
            }
        }

        return {
            resultingWorkOrders: scheduledWorkOrders,
            changes: changes
        }
    }



}
