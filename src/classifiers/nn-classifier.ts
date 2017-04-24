import { Classifier } from "./classifier";
import * as fnn from "ml-fnn";

export class NNClassifier implements Classifier {

    baseClassifier = new fnn();

    train(features: Array<number>, prediction: number) {
        this.baseClassifier.train([features], [prediction]);
    }

    predict(features: Array<number>): number {
        let prediction = this.baseClassifier.predict([features])[0];
        return prediction;
    }
}
