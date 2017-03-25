/// <reference path="./declarations.d.ts" />

import { Configuration } from "./configuration";
import { Classifiers } from "./classifiers/classifiers";
import * as Rx from "rxjs";

const LOCAL_WEBDIS_ENDPOINT = "ws://localhost:7379/.json";
const REMOTE_WEBDIS_ENDPOINT = "ws://localhost:7379/.json";

const W_T = 0.7;
const W_E = 0.3;

function cost(mT: number, mE: number): number {
    return (W_T * mT) + (W_E * mE);
}

export function offloadable(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
    let originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {
        let strMethod = originalMethod.toString();
        let jsonArgs = JSON.stringify(args);
        let observable: Rx.Observable<any>;
        console.log("code: ", strMethod.substring(0, 100));
        console.log("args: ", jsonArgs.substring(0, 100));

        let start = performance.now();

        let local_cost, offload_pc_cost, offload_cloud_cost;
        let features = [0, strMethod.length, args.length, jsonArgs.length];
        console.log("features: ", JSON.stringify(features));

        if (Configuration.execution === Configuration.ExecutionType.PREDICTION) {
            local_cost = cost(Classifiers.getTimeClassifier().predict(features),
                Classifiers.getEnergyClassifier().predict(features));
            features[0] = Configuration.ExecutionType.PC_OFFLOADING;
            offload_pc_cost = cost(Classifiers.getTimeClassifier().predict(features),
                Classifiers.getEnergyClassifier().predict(features));
            features[0] = Configuration.ExecutionType.CLOUD_OFFLOADING;
            offload_cloud_cost = cost(Classifiers.getTimeClassifier().predict(features),
                Classifiers.getEnergyClassifier().predict(features));

            console.log("local cost: ", local_cost);
            console.log("PC offload cost: ", offload_pc_cost);
            console.log("Cloud offload cost: ", offload_cloud_cost);
        }

        let execution = Configuration.ExecutionType.LOCAL;
        if (Configuration.execution === Configuration.ExecutionType.LOCAL
            || local_cost <= offload_pc_cost && local_cost <= offload_cloud_cost) {

            console.log("execution: LOCAL");
            observable = Rx.Observable.of(originalMethod.apply(this, args));
        } else {
            execution = Configuration.execution === Configuration.ExecutionType.PREDICTION ?
                (offload_pc_cost <= offload_cloud_cost ? Configuration.ExecutionType.PC_OFFLOADING : Configuration.ExecutionType.CLOUD_OFFLOADING)
                : Configuration.execution;

            console.log("execution: " + Configuration.ExecutionType[execution]);
            const id = Date.now();
            let body = {
                id: id,
                code: strMethod,
                args: args
            };
            observable = Rx.Observable.create(function(observer) {
                let url = execution === Configuration.ExecutionType.PC_OFFLOADING ? LOCAL_WEBDIS_ENDPOINT : REMOTE_WEBDIS_ENDPOINT;
                offloadMethod(observer, url, JSON.stringify(body), id.toString());
            });
        }

        console.log("features: " + features);

        let subject = new Rx.Subject();
        subject.subscribe(
            function(x) { },
            function(e) { },
            function() {
                let time  = performance.now() - start;
                console.log("time [ms]: ", time);

                features[0] = execution;
                Classifiers.trainTimeClassifiers(features, time < 5000 ? -1 : -0.5);
                Classifiers.trainEnergyClassifiers(features, -2);
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
