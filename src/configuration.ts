export namespace Configuration {
    export enum ExecutionType { LOCAL, PC_OFFLOADING, CLOUD_OFFLOADING, PREDICTION };
    export enum ClassifierType { KNN, NEURAL_NETWORK };

    export var execution: ExecutionType = ExecutionType.LOCAL;
    export var classifier: ClassifierType = ClassifierType.KNN;
}
