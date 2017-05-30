import { Configuration } from "../configuration";
import { Classifier } from "./classifier";
import * as cart from "ml-cart";

export class DTClassifier implements Classifier {

  baseClassifier;
  examples = [];
  predictions = [];

  train(features: Array<number>, prediction: number) {
    let features_copy = features.slice();
    features_copy[0] /= Configuration.EXECUTION_MULTIPLIER;
    features_copy[0] += 1;
    features_copy[0] *= Configuration.EXECUTION_MULTIPLIER;
    features_copy.map(Math.abs);
    this.examples.push(features_copy);
    this.predictions.push(prediction + 2);
    this.baseClassifier = new cart.DecisionTreeClassifier({
      gainFunction: "gini",
      maxDepth: 10,
      minNumSamples: 1
    });
    this.baseClassifier.train(this.examples, this.predictions);
  }

  predict(features: Array<number>): number {
    let features_copy = features.slice();
    features_copy[0] /= Configuration.EXECUTION_MULTIPLIER;
    features_copy[0] += 1;
    features_copy[0] *= Configuration.EXECUTION_MULTIPLIER;
    features_copy.map(Math.abs);
    return this.baseClassifier.predict([features_copy])[0] - 2;
  }
}
