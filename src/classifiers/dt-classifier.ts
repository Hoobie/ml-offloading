import { Classifier } from "./classifier";
import * as cart from "ml-cart";

export class DTClassifier implements Classifier {

    baseClassifier = new cart.DecisionTreeClassifier();
    examples = [];
    predictions = [];

    train(features: Array<number>, prediction: number) {
      this.examples.push(features);
      this.predictions.push(prediction);
      this.baseClassifier.train(this.examples, this.predictions);
    }

    predict(features: Array<number>): number {
        return this.baseClassifier.predict([features])[0];
    }
}
