import {Classifiers} from "./classifiers/classifiers";

export namespace Configuration {
    export enum ExecutionType { LOCAL, PC_OFFLOADING, CLOUD_OFFLOADING, PREDICTION };
    export enum ClassifierType { KNN, NEURAL_NETWORK, DECISION_TREE };

    export const EXECUTION_MULTIPLIER = 5;
    
    export var execution: ExecutionType = ExecutionType.LOCAL;
    export var classifier: ClassifierType = ClassifierType.KNN;
    export var localEndpoint: string;
    export var remoteEndpoint: string;
    export var shouldTrain: boolean = true;
    export var shouldTrainAllClassifiers: boolean = false;
    export var roundId = -1;

    export function resetClassifiers(): void {
      Classifiers.reset();
    }
}
