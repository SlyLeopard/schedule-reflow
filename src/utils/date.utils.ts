import { DateTime } from "luxon";
import { WorkCenter } from "../reflow/types";

export class DateUtils {

    static stringToDateTime(dateStr: string): DateTime {
        return DateTime.fromISO(dateStr);
    }

    static initializeTimePointers(workCenters: WorkCenter[], startTime: string): Map<string, DateTime> {
        let startDateTime = this.stringToDateTime(startTime);
        let timePointers = new Map<string, DateTime>();
        for (const wc of workCenters) {
            timePointers.set(wc.docId, startDateTime);
        }
        return timePointers
    }

}