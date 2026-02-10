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
import { ConstraintChecker } from "./constraint.checker";

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

            // Save the resulting work order
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

    sortWorkOrders(
        workOrders: WorkOrder[]
    ): WorkOrder[] {

        // Start off with a startTime based sort before handling dependencies with Kahn's algorithm.
        workOrders.sort(this.sortByPlannedStartTimeThenId)

        // Create a quick lookup map to get work orders by their Id
        const idLookup = new Map<string, WorkOrder>();
        for (const wo of workOrders) {
            idLookup.set(wo.docId, wo);
        }

        // Initialize empty children and inDegree maps to build our DAG
        let childWorkOrders = new Map<string, string[]>();
        let inDegree = new Map<string, number>();
        for (const wo of workOrders) {
            childWorkOrders.set(wo.docId, [])
            inDegree.set(wo.docId, 0)
        }

        // For each work order, iterate through the parents it depends on 
        for (const wo of workOrders) {
            for (const parentId of wo.data.dependsOnWorkOrderIds) {
                //Creates a map that connects parent work order to an array of its child work orders
                childWorkOrders.get(parentId)?.push(wo.docId)

                //Checks the number of incoming vertices (work orders it depends on) per work order
                //For every work order that has the child as a parent, inDegree will increment
                inDegree.set(wo.docId, (inDegree.get(wo.docId) ?? 0) + 1)
            }
        }

        // Initialize DAG Queue with all non dependent work orders
        const queue: WorkOrder[] = []
        for (const wo of workOrders) {
            if (inDegree.get(wo.docId) === 0) {
                queue.push(wo);
            }
        }

        // Instantiate our finally sorted work order list
        let topologicallySortedWorkOrders: WorkOrder[] = []

        // Create a revolving queue that adds work orders as dependencies are resolved
        while(queue.length > 0) {

            // Pop the next work order with resolved dependencies and add it to the sorted list
            const currentWorkOrder = queue.shift()!;
            topologicallySortedWorkOrders.push(currentWorkOrder);

            // Iterate through current worker's children and reduce inDegree by 1
            for(const childId of childWorkOrders.get(currentWorkOrder.docId)!){
                inDegree.set(childId, inDegree.get(childId)! - 1);

                // Add children to the queue once we resolve dependencies (inDegree = 0)
                if (inDegree.get(childId) == 0) queue.push(idLookup.get(childId)!);
            }
        }

        // Quick check for cyclic dependencies by ensuring the number of work orders hasn't changed
        if(ConstraintChecker.checkForCyclicDependencies(workOrders, topologicallySortedWorkOrders)) {
            throw new Error("Cyclic dependency detected. Cannot proceed with scheduling")
        }
        return topologicallySortedWorkOrders;
    }

    scheduleWorkOrder(
        workOrder: WorkOrder,
        workCenters: WorkCenter[],
        timePointers: Map<string, DateTime>
    ): [WorkOrder, Change] {

    }

    // Helper function to have lower startTime work orders get processed first with Id as a tiebreaker
    sortByPlannedStartTimeThenId(a: WorkOrder, b: WorkOrder) {
        const aDateTime = DateUtils.stringToDateTime(a.data.startDate)
        const bDateTime = DateUtils.stringToDateTime(b.data.startDate)
        const diff = aDateTime.toMillis() - bDateTime.toMillis()
        if(diff !== 0) {
            return diff
        } else {
            return a.docId.localeCompare(b.docId);
        }
    }

}
