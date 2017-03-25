import { Classifier } from "./classifier";

export class NNClassifier implements Classifier {

    baseClassifier = (window as MyWindow).Mind();

    train(features: Array<number>, prediction: number) {
        this.baseClassifier.learn([{ input: features, output: [prediction] }]);
    }

    predict(features: Array<number>): number {
        return this.baseClassifier.predict(features);
    }
}
