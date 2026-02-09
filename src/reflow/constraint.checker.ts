import { WorkOrder } from "./types";

export class ConstraintChecker {
    static checkForCyclicDependencies(originalWorkOrders: WorkOrder[], sortedWorkOrders: WorkOrder[]): boolean {
        return originalWorkOrders.length !== sortedWorkOrders.length;
    }
}
