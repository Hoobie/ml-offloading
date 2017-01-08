/// <reference path="./declarations.d.ts" />

import * as Rx from "rxjs";
import * as MlKnn from "ml-knn";

const DOCKER_MACHINE_WEBDIS_ENDPOINT = "ws://192.168.99.100:7379/.json";

const TRAINING_SET = {
    data: [
        [10, 1, 1],
        [20, 2, 2],
        [20, 3, 4],
        [20, 1, 8],
        [20, 2, 16],
        [20, 3, 8],
        [30, 1, 1],
        [30, 2, 8],
        [30, 3, 4],
        [30, 4, 2],
        [30, 5, 2048],
        [30, 5, 1024],
        [50, 6, 512],
        [50, 6, 1024],
        [50, 5, 4096],
        [100, 5, 2048],
        [100, 4, 512],
        [120, 3, 1024],
        [200, 3, 256],
        [200, 2, 512]
    ],
    predictions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
}

const CLASSIFIER = new MlKnn();
CLASSIFIER.train(TRAINING_SET.data, TRAINING_SET.predictions);

export default function offloadable(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
    let originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {
        let strMethod = originalMethod.toString();
        let jsonArgs = JSON.stringify(args);
        let res;
        console.log("code: ", strMethod);
        console.log("args: ", jsonArgs.substring(0, 100));

        let start = performance.now();

        let features = [strMethod.length, args.length, jsonArgs.length];
        console.log("features: ", JSON.stringify(features));

        if (CLASSIFIER.predict([features])[0] === 1) {
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
