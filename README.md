# Production Schedule Reflow
- Take home assignment with the goal of creating a work order and work center based reflow scheduler.

## My Approach
- In reality, production grade schedulers typically use advanced techniques such as event driven scheduling. While I would certainly love to implement the best possible solution, part of the challenge of the assignment was considering the soft time limit of 6 hours. Given this constraint, I opted to focus on creating a basic single loop scheduler that was "valid but dumb" or non-work conserving. For example, Kahn's algorithm won't care that a child workOrder is eligible to be run at 11:00 if the work order with no dependencies is scheduled for 15:00. It will prioritize the work order without dependencies regardless as work orders with ```inDegree = 0``` will be shifted into the queue first. If time allowed after, I could look into potentially implementing a tick-based scheduler that was slightly better at being work-conserving but still has its own drawbacks, or look into event driven systems but in the end this was not the case. My system can be broken up into 6 major steps.
  
### 1. Data Intake
- Read test data from the ```testdata``` folder and format it into the ```WorkOrder``` and ```WorkCenter``` TypeScript classes to be ready for reflow.

### 2. Initial Sorting
- Initially I took for granted the fact that the test data typically was in chronological order to begin with, but this is not necessarily a hard requirement. Quickly run a time-based then id-based tie breaker sort to get the list of work orders in chronological order. This is accomplished with the ```workOrders.sort(this.sortByPlannedStartTimeThenId)``` command on line 73 of reflow.service.ts

### 3. DAG Initialization
- After sorting the work orders, we opt to create a DAG to ensure work orders can only be processed after their dependencies have been run. As mentioned before, this is not work-conserving but it will always ensure dependencies are handled. The sorting step is a quick and dirty fix to generally reduce the amount of time a work center is idle despite technically having work orders in the queue that it could run. This step is done by creating 2 maps: ```childWorkOrders``` and ```inDegree```. The former creates a map where a given parent work order has the id of any child work order in an array. The latter creates a map where the number of parents the work order has is measured. These are the parameters needed to then iterate through the queue and create an optimal work order execution order.

### 4. DAG Topological Sort and Queue Iteration
- To begin, any work order with ```inDegree = 0``` is added to the queue. The algorithm then grabs the child work orders of the parent and reduces their ```inDegree``` value by 1. If ```inDegree``` is finally brought down to 0, that child work order is then placed in the back of the queue as we've ensured all of its parents are now in front of it in the queue. After a work order is processed in the queue, it's added to our final list of sorted work orders.

### 5. Reflow Scheduler
- Take the first work order's start time and initialize all work center's time pointers to this time. We can do this thanks to the initial time-based sort as all work orders with ```inDegree = 0``` will be at the front and are sorted chronologically. Next we begin iterating through all work orders and attempting to run them. First we take note of the time the order was planned for. If this ends up being delayed, we will take note of it and document it in the next step. Next, we find the true minimum start time by comparing the current workCenter's time pointer, the initial start time, and the end time of dependencies being met. Finally with our start time in mind, we have to check for maintenance windows. Since maintenance cannot be moved, any start time must be moved till after it finishes. Lastly, we must consider work center shifts and any job in progress that is not complete by the end of the shift must stop and then resume on the next eligible work day.

### 6. Change Documentation
- Whenever a change occurs to the start and end time of a work order, we create a ```Change``` instance which acts as our documentation of the change. Any change will be saved as part of the ```Result``` class which has the changelog and the sorted list of work orders as its output. Once sorting is complete, the results are printed to the console.

## Setup Instructions & Requirements
- Pull the latest version of the repo
- Ensure you have ```npm```, ```node``` and TypeScript installed on your machine
- Run ```npm install``` to grab packages
- To run the basic test script, run ```npm run test```
- The base script is located in ```src/scripts/index.ts``` so if you'd like to use custom data or run your own tests, just modify that script.
- Test data is stored in the ```testdata``` folder so unique input cases can be added by adding your custom folder and files.


