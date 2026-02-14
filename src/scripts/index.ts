import { ReflowService } from "../reflow/reflow.service";
import { WorkOrder } from "../reflow/types";
import { buildWorkCenter } from "../utils/work-center/work-center.factory";

import workCentersJson from "../../testdata/smallChange/workCenters.json";
import workOrdersJson from "../../testdata/smallChange/workOrders.json";
import { WorkCenterDTO } from "../utils/work-center/work-center.dto";

type WorkCentersFile = {
  workCenters: WorkCenterDTO[]
}

const rawWorkCenters = (workCentersJson as WorkCentersFile).workCenters

const workCenters = rawWorkCenters.map(buildWorkCenter);
const workOrders = workOrdersJson.workOrders as WorkOrder[];

const reflowService = new ReflowService();
const result = reflowService.reflow(workOrders, workCenters);
console.log(JSON.stringify(result, null, 2));

