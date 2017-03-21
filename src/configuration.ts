export namespace Configuration {
    export enum Execution {
        LOCAL,
        PC_OFFLOADING,
        CLOUD_OFFLOADING,
        PREDICTION
    }

    export enum Classifier {
        KNN,
        NAIVE_BAYES,
        RANDOM_FOREST
    }

    export var execution: Execution = Execution.PC_OFFLOADING;
    export var classifier: Classifier = Classifier.KNN;
}
