/// <reference path="./declarations.d.ts" />

import { Configuration } from "./configuration";
import * as Rx from "rxjs";
import * as MlKnn from "ml-knn";

const LOCAL_WEBDIS_ENDPOINT = "ws://localhost:7379/.json";
const REMOTE_WEBDIS_ENDPOINT = "ws://localhost:7379/.json";

// attributes: [local/offload, methodSize, argumentsCount, argumentsSize]
// labels: -2 = very low, -1 = low, 0 = medium, 1 = high, 2 = very high
const TIME_KNN_CLASSIFIER = new MlKnn();
const ENERGY_KNN_CLASSIFIER = new MlKnn();

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
        let observable: Rx.Observable<any>;
        console.log("code: ", strMethod.substring(0, 100));
        console.log("args: ", jsonArgs.substring(0, 100));

        let start = performance.now();

        var local_cost, offload_pc_cost, offload_cloud_cost;

        if (Configuration.execution === Configuration.Execution.PREDICTION) {
            let local_features = [0, strMethod.length, args.length, jsonArgs.length];
            console.log("local features: ", JSON.stringify(local_features));
            let offload_pc_features = [1, strMethod.length, args.length, jsonArgs.length];
            console.log("PC offload features: ", JSON.stringify(offload_pc_features));
            let offload_cloud_features = [2, strMethod.length, args.length, jsonArgs.length];
            console.log("Cloud offload features: ", JSON.stringify(offload_cloud_features));

            local_cost = cost(TIME_KNN_CLASSIFIER.predict([local_features])[0], ENERGY_KNN_CLASSIFIER.predict([local_features])[0]);
            offload_pc_cost = cost(TIME_KNN_CLASSIFIER.predict([offload_pc_features])[0], ENERGY_KNN_CLASSIFIER.predict([offload_pc_features])[0]);
            offload_cloud_cost = cost(TIME_KNN_CLASSIFIER.predict([offload_cloud_features])[0], ENERGY_KNN_CLASSIFIER.predict([offload_cloud_features])[0]);

            console.log("local cost: ", local_cost);
            console.log("PC offload cost: ", offload_pc_cost);
            console.log("Cloud offload cost: ", offload_cloud_cost);
        }

        if (Configuration.execution === Configuration.Execution.LOCAL
            || local_cost <= offload_pc_cost && local_cost <= offload_cloud_cost) {

            console.log("execution: LOCAL");
            observable = Rx.Observable.of(originalMethod.apply(this, args));
        } else {
            const execution = Configuration.execution === Configuration.Execution.PREDICTION ?
                (offload_pc_cost <= offload_cloud_cost ? Configuration.Execution.PC_OFFLOADING : Configuration.Execution.CLOUD_OFFLOADING)
                : Configuration.execution;

            console.log("execution: " + execution.toString());
            const id = Date.now();
            let body = {
                id: id,
                code: strMethod,
                args: args
            };
            observable = Rx.Observable.create(function(observer) {
                let url = execution === Configuration.Execution.PC_OFFLOADING ? LOCAL_WEBDIS_ENDPOINT : REMOTE_WEBDIS_ENDPOINT;
                offloadMethod(observer, url, JSON.stringify(body), id.toString());
            });
        }

        let subject = new Rx.Subject();
        subject.subscribe(
            function(x) { },
            function(e) { },
            function() {
                let end = performance.now();
                console.log("time [ms]: ", end - start);

                // TODO: train
                // CLASSIFIER.train(TRAINING_SET.data, TRAINING_SET.predictions);
            }
        );
        observable.subscribe(subject);

        return subject;
    };

    return descriptor;
}

function offloadMethod(observer: Rx.Observer<any>, webdisUrl: string, msgBody: string, id: string) {
    const requestSocket = new WebSocket(LOCAL_WEBDIS_ENDPOINT);
    requestSocket.onopen = function() {
        requestSocket.send(JSON.stringify(["RPUSH", "requests", msgBody]));
    };
    requestSocket.onmessage = function(messageEvent) {
        const obj = JSON.parse(messageEvent.data);
        console.log("Request sent " + messageEvent.data);

        const responseSocket = new WebSocket(webdisUrl);
        responseSocket.onopen = function() {
            responseSocket.send(JSON.stringify(["BLPOP", id, 30]));
        };
        responseSocket.onmessage = function(messageEvent) {
            console.log("Response received " + messageEvent.data);
            const response = JSON.parse(messageEvent.data);
            observer.next(JSON.parse(response.BLPOP[1]));
            observer.complete();
        };
        responseSocket.onerror = requestSocket.onerror;
    };
    requestSocket.onerror = function(e) {
        observer.error(e);
        observer.complete();
        console.log("Error " + JSON.stringify(e));
    };
}
