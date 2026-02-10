import { ReflowService } from "./src/reflow/reflow.service";
import { WorkOrder, WorkCenter } from "./src/reflow/types";

import workCentersJson from "./testdata/basic/workCenters.json";
import workOrdersJson from "./testdata/basic/workOrders.json";
const workCenters : WorkCenter[] = JSON.parse(JSON.stringify(workCentersJson));
const workOrders : WorkOrder[] = JSON.parse(JSON.stringify(workOrdersJson)); 

const reflowService = new ReflowService();
const result = reflowService.reflow(workOrders, workCenters);
console.log(result);