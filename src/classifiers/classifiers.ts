import { Classifier } from "./classifier";
import { KnnClassifier } from "./knn-classifier";
import { NNClassifier } from "./nn-classifier";
import { DTClassifier } from "./dt-classifier";
import { Configuration } from "../configuration";

export namespace Classifiers {
    export const KNN_TIME = new KnnClassifier();
    export const KNN_ENERGY = new KnnClassifier();
    export const NN_TIME = new NNClassifier();
    export const NN_ENERGY = new NNClassifier();
    export const DT_TIME = new DTClassifier();
    export const DT_ENERGY = new DTClassifier();

    export function getTimeClassifier(): Classifier {
        switch (Configuration.classifier) {
            case Configuration.ClassifierType.KNN:
                return Classifiers.KNN_TIME;
            case Configuration.ClassifierType.NEURAL_NETWORK:
                return Classifiers.NN_TIME;
            case Configuration.ClassifierType.DECISION_TREE:
                return Classifiers.DT_TIME;
        }
    }

    export function getEnergyClassifier(): Classifier {
        switch (Configuration.classifier) {
            case Configuration.ClassifierType.KNN:
                return Classifiers.KNN_ENERGY;
            case Configuration.ClassifierType.NEURAL_NETWORK:
                return Classifiers.NN_ENERGY;
            case Configuration.ClassifierType.DECISION_TREE:
                return Classifiers.DT_ENERGY;
        }
    }

    export function trainAllTime(features, executionTime) {
      KNN_TIME.train(features, executionTime);
      NN_TIME.train(features, executionTime);
      DT_TIME.train(features, executionTime);
    }

    export function trainAllEnergy(features, energyDrain) {
      KNN_ENERGY.train(features, energyDrain);
      NN_ENERGY.train(features, energyDrain);
      DT_ENERGY.train(features, energyDrain);
    }
}
