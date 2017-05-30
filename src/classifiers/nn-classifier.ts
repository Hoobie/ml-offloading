import { Classifier } from "./classifier";
import * as fnn from "ml-fnn";

export class NNClassifier implements Classifier {

  baseClassifier = new fnn();
  examples = [];
  predictions = [];

  train(features: Array<number>, prediction: number) {
    this.examples.push(features);
    this.predictions.push(prediction);
    this.baseClassifier = new fnn();
    this.baseClassifier.train(this.examples, this.predictions);
  }

  predict(features: Array<number>): number {
    return this.baseClassifier.predict([features])[0];
  }
}
