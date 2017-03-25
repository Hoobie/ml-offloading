import * as KNear from "knear";
import { Classifier } from "./classifier";

export class KnnClassifier implements Classifier {

    baseClassifier = new KNear.kNear(3);

    train(features: Array<number>, prediction: number) {
        this.baseClassifier.learn(features, prediction);
    }

    predict(features: Array<number>): number {
        return this.baseClassifier.classify(features);
    }
}
