import { ReflowService } from "../reflow/reflow.service";
import { WorkOrder, WorkCenter } from "../reflow/types";

import workCentersJson from "../../testdata/smallChange/workCenters.json";
import workOrdersJson from "../../testdata/smallChange/workOrders.json";

const workCenters = workCentersJson.workCenters as WorkCenter[];
const workOrders = workOrdersJson.workOrders as WorkOrder[];

const reflowService = new ReflowService();
const result = reflowService.reflow(workOrders, workCenters);
console.log(JSON.stringify(result, null, 2));