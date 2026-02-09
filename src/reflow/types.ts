export interface workOrder {
    docId: string;                  // Unique identifier
    docType: string;                // Document type
}

export interface workCenter {
    docId: string;                  // Unique identifier
    docType: string;                // Document type
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