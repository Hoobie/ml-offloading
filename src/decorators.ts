/// <reference path="./declarations.d.ts" />

import * as Rx from "rxjs";
import * as MlKnn from "ml-knn";

const DOCKER_MACHINE_WEBDIS_ENDPOINT = "ws://192.168.99.100:7379/.json";

const TIME_TRAINING_SET = {
    data: [
        [0, 10, 1, 1],
        [0, 20, 2, 2],
        [0, 20, 3, 4],
        [0, 20, 1, 8],
        [0, 20, 2, 16],
        [0, 20, 3, 8],
        [0, 30, 1, 1],
        [0, 30, 2, 8],
        [0, 30, 3, 1024],
        [0, 30, 4, 512],
        [0, 30, 5, 2048],
        [0, 30, 5, 1024],
        [0, 50, 6, 512],
        [0, 50, 6, 1024],
        [0, 50, 5, 4096],
        [0, 100, 5, 2048],
        [0, 100, 4, 512],
        [0, 120, 3, 1024],
        [0, 200, 3, 256],
        [0, 200, 2, 512],
        [1, 10, 1, 1],
        [1, 20, 2, 2],
        [1, 20, 3, 4],
        [1, 20, 1, 8],
        [1, 20, 2, 16],
        [1, 20, 3, 8],
        [1, 30, 1, 1],
        [1, 30, 2, 8],
        [1, 30, 3, 1024],
        [1, 30, 4, 512],
        [1, 30, 5, 2048],
        [1, 30, 5, 1024],
        [1, 50, 6, 512],
        [1, 50, 6, 1024],
        [1, 50, 5, 4096],
        [1, 100, 5, 2048],
        [1, 100, 4, 512],
        [1, 120, 3, 1024],
        [1, 200, 3, 256],
        [1, 200, 2, 512]
    ],
    predictions: [-2, -2, -2, -2, -1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
        -2, -2, -2, -2, -2, -2, -2, -2, -1, -1, -1, -1, -1, -1, -1, -1]
}

const ENERGY_TRAINING_SET = {
    data: [
        [0, 10, 1, 1],
        [0, 20, 2, 2],
        [0, 20, 3, 4],
        [0, 20, 1, 8],
        [0, 20, 2, 16],
        [0, 20, 3, 8],
        [0, 30, 1, 1],
        [0, 30, 2, 8],
        [0, 30, 3, 1024],
        [0, 30, 4, 512],
        [0, 30, 5, 2048],
        [0, 30, 5, 1024],
        [0, 50, 6, 512],
        [0, 50, 6, 1024],
        [0, 50, 5, 4096],
        [0, 100, 5, 2048],
        [0, 100, 4, 512],
        [0, 120, 3, 1024],
        [0, 200, 3, 256],
        [0, 200, 2, 512],
        [1, 10, 1, 1],
        [1, 20, 2, 2],
        [1, 20, 3, 4],
        [1, 20, 1, 8],
        [1, 20, 2, 16],
        [1, 20, 3, 8],
        [1, 30, 1, 1],
        [1, 30, 2, 8],
        [1, 30, 3, 1024],
        [1, 30, 4, 512],
        [1, 30, 5, 2048],
        [1, 30, 5, 1024],
        [1, 50, 6, 512],
        [1, 50, 6, 1024],
        [1, 50, 5, 4096],
        [1, 100, 5, 2048],
        [1, 100, 4, 512],
        [1, 120, 3, 1024],
        [1, 200, 3, 256],
        [1, 200, 2, 512]
    ],
    predictions: [-2, -2, -2, -2, -1, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
        -1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0]
}

const TIME_CLASSIFIER = new MlKnn();
TIME_CLASSIFIER.train(TIME_TRAINING_SET.data, TIME_TRAINING_SET.predictions);

const ENERGY_CLASSIFIER = new MlKnn();
ENERGY_CLASSIFIER.train(ENERGY_TRAINING_SET.data, ENERGY_TRAINING_SET.predictions);

const W_T = 0.7;
const W_E = 0.3;
function cost(mT: number, mE: number): number {
    return (W_T * mT) + (W_E * mE);
}

export default function offloadable(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
    let originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {
        let strMethod = originalMethod.toString();
        let jsonArgs = JSON.stringify(args);
        let res;
        console.log("code: ", strMethod);
        console.log("args: ", jsonArgs.substring(0, 100));

        let start = performance.now();

        let local_features = [0, strMethod.length, args.length, jsonArgs.length];
        console.log("local features: ", JSON.stringify(local_features));
        let offload_features = [1, strMethod.length, args.length, jsonArgs.length];
        console.log("offload features: ", JSON.stringify(offload_features));

        let local_cost = cost(TIME_CLASSIFIER.predict([local_features])[0], ENERGY_CLASSIFIER.predict([local_features])[0]);
        console.log("local cost: ", local_cost);
        let offload_cost = cost(TIME_CLASSIFIER.predict([offload_features])[0], ENERGY_CLASSIFIER.predict([offload_features])[0]);
        console.log("offload cost: ", offload_cost);

        if (local_cost > offload_cost) {
            console.log("prediction: offload");
            const id = Date.now();
            let body = {
                id: id,
                code: strMethod,
                args: args
            };
            res = Rx.Observable.create(function(observer) {
                offloadMethod(observer, JSON.stringify(body), id.toString());
            });
        } else {
            console.log("prediction: local");
            res = Rx.Observable.of(originalMethod.apply(this, args));
        }

        let end = performance.now();
        console.log("time [ms]: ", end - start);
        console.log("Observable returned");

        return res;
    };

    return descriptor;
}

function offloadMethod(observer: Rx.Observer<any>, msgBody: string, id: string) {
    const requestSocket = new WebSocket(DOCKER_MACHINE_WEBDIS_ENDPOINT);
    requestSocket.onopen = function() {
        requestSocket.send(JSON.stringify(["RPUSH", "requests", msgBody]));
    };
    requestSocket.onmessage = function(messageEvent) {
        const obj = JSON.parse(messageEvent.data);
        console.log("Request sent " + messageEvent.data);

        const responseSocket = new WebSocket(DOCKER_MACHINE_WEBDIS_ENDPOINT);
        responseSocket.onopen = function() {
            responseSocket.send(JSON.stringify(["BLPOP", id, 30]));
        };
        responseSocket.onmessage = function(messageEvent) {
            console.log("Response received " + messageEvent.data);
            const response = JSON.parse(messageEvent.data);
            observer.next(JSON.parse(response.BLPOP[1]));
            observer.complete();
        }
        responseSocket.onerror = requestSocket.onerror;
    };
    requestSocket.onerror = function(e) {
        observer.error(e);
        observer.complete();
        console.log("Error " + JSON.stringify(e));
    }
}
