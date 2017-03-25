export interface Classifier {
  baseClassifier: any;

  train(features: Array<number>, prediction: number);

  predict(features: Array<number>): number;
}
