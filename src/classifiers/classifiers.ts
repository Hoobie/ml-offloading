import { Classifier } from "./classifier";
import { KnnClassifier } from "./knn-classifier";
import { NNClassifier } from "./nn-classifier";
import { Configuration } from "../configuration";

export namespace Classifiers {
    export const KNN_TIME = new KnnClassifier();
    export const KNN_ENERGY = new KnnClassifier();
    export const NN_TIME = new NNClassifier();
    export const NN_ENERGY = new NNClassifier();

    export function getTimeClassifier(): Classifier {
        switch (Configuration.classifier) {
            case Configuration.ClassifierType.KNN:
                return Classifiers.KNN_TIME;
            case Configuration.ClassifierType.NEURAL_NETWORK:
                return Classifiers.NN_TIME;
        }
    }

    export function getEnergyClassifier(): Classifier {
        switch (Configuration.classifier) {
            case Configuration.ClassifierType.KNN:
                return Classifiers.KNN_ENERGY;
            case Configuration.ClassifierType.NEURAL_NETWORK:
                return Classifiers.NN_ENERGY;
        }
    }
}
