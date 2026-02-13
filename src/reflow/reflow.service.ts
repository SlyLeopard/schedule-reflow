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
        let scheduledWorkOrderMap = new Map<string, WorkOrder>()
        let changes = []             // Initialize the adjustment notes array

        // Topographically sort all work orders to account for dependencies
        let sortedWorkOrders = this.sortWorkOrders(workOrders)

        // Create a quick lookup for work centers by Id
        let wcIdLookup = new Map<string, WorkCenter>();
        for (const wc of workCenters) {
            wcIdLookup.set(wc.docId, wc);
        }

        // Initialize all work centers time pointer to the first work order's start time
        let timePointers = DateUtils.initializeTimePointers(workCenters, sortedWorkOrders[0].data.startDate)

        // Begin iterating through all work orders and make schedule changes as needed
        for (const wo of sortedWorkOrders) {

            //@upgrade('0.0.2') - Add logic to check for invalid work center

            // Schedule the next order in line, passing all work centers and the current time pointer array
            let [scheduledWorkOrder, change] = this.scheduleWorkOrder(
                wo, 
                wcIdLookup.get(wo.data.workCenterId)!, 
                timePointers,
                scheduledWorkOrderMap
            )

            // Save the resulting work order
            scheduledWorkOrders.push(scheduledWorkOrder)
            scheduledWorkOrderMap.set(scheduledWorkOrder.docId, scheduledWorkOrder)

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
                // @upgrade('0.0.2') - Add logic to check for invalid parent in test data
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
        workCenter: WorkCenter,
        timePointers: Map<string, DateTime>,
        scheduledWorkOrdersMap: Map<string, WorkOrder>
    ): [WorkOrder, Change | null] {

        // Initalize the work order's original timing to help with determining if a change has occurred
        const timePointer = timePointers.get(workCenter.docId)!
        const initialStartTime = DateUtils.stringToDateTime(workOrder.data.startDate) as DateTime
        const initialEndTime = DateUtils.stringToDateTime(workOrder.data.endDate) as DateTime
        const duration = workOrder.data.durationMinutes
        const dependencyMetTime = this.getDependenciesMetTime(workOrder, scheduledWorkOrdersMap)
        const startTimeMillis = Math.max(timePointer.toMillis(), initialStartTime.toMillis(), dependencyMetTime.toMillis())

        //@upgrade('0.0.2') - Add logic to account for maintenance delays and work shifts when working through work orders

        const newTime = DateTime.fromMillis(startTimeMillis)
        const endTime = DateTime.fromMillis(startTimeMillis).plus({ minutes: duration })
        let change: Change | null = null

        if (startTimeMillis !== initialStartTime.toMillis() || endTime.toMillis() !== initialEndTime.toMillis()) {
            workOrder.data.startDate = DateUtils.stringUTCtoISO(newTime.toISO()!)
            workOrder.data.endDate = DateUtils.stringUTCtoISO(endTime.toISO()!)
            change = {
                workOrderId: workOrder.docId,
                oldStartTime: initialStartTime.toISO()!,
                newStartTime: DateUtils.stringUTCtoISO(newTime.toISO()!),
                oldEndTime: initialEndTime.toISO()!,
                newEndTime: DateUtils.stringUTCtoISO(endTime.toISO()!),
                delayReason: "Delayed due to dependencies" //@upgrade('0.0.2') - Add logic to determine exact reason when accounting for maintenance
            }
        }

        scheduledWorkOrdersMap.set(workOrder.docId, workOrder)
        timePointers.set(workCenter.docId, endTime)
        return [workOrder, change]
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

    // Helper function to confirm whether all dependencies for a given work order have been met and return the minimum time
    getDependenciesMetTime(workOrder: WorkOrder, scheduledWorkOrdersMap: Map<string, WorkOrder>): DateTime {
        let dependenciesMetTime = DateTime.fromMillis(0)
        for(const parentId of workOrder.data.dependsOnWorkOrderIds) {
            const parentEndDate = DateUtils.stringToDateTime(scheduledWorkOrdersMap.get(parentId)!.data.endDate)
            dependenciesMetTime = parentEndDate > dependenciesMetTime ? parentEndDate : dependenciesMetTime
        }
        return dependenciesMetTime
    }

}
