/// <reference path="./declarations.d.ts" />

import { Configuration } from "./configuration";
import { Classifiers } from "./classifiers/classifiers";
import * as Rx from "rxjs";

const W_T = 0.7;
const W_E = 0.3;

let isCordovaApp = !!(window as MyWindow).cordova;
let wifiEnabled = true;

let reasearchData = [];

function cost(mT: number, mE: number): number {
    return (W_T * mT) + (W_E * mE);
}

export function offloadable(withCallback: boolean) {
    return function(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
        if (descriptor === undefined) {
            descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
        }

        let originalMethod = descriptor.value;

        descriptor.value = function(...args: any[]) {
            if (isCordovaApp) {
                (window as MyWindow).startPowerMeasurements(function(msg) {
                    if (msg) {
                        console.log(msg);
                    }
                });
            }

            if (typeof WifiWizard !== "undefined") {
                WifiWizard.isWifiEnabled(function(enabled: boolean) {
                    wifiEnabled = enabled;
                    console.log("WiFi enabled: " + wifiEnabled);
                }, function(err) { });
            }

            let strMethod = originalMethod.toString();
            let jsonArgs = JSON.stringify(args);
            let observable: Rx.Observable<any>;
            let start = performance.now();
            let local_cost, offload_pc_cost, offload_cloud_cost;
            let date = new Date();
            let online = navigator.onLine;
            let predict = Configuration.execution === Configuration.ExecutionType.PREDICTION;
            let features = [0, strMethod.length / 50000, args.length / 20, jsonArgs.length * 2 / 1024 / 1024 / 1024,
                date.getHours() / 24, wifiEnabled ? 1 : 0];

            console.log("code: ", strMethod.substring(0, 150), "...");
            console.log("args: ", args);
            console.log("online: ", online);

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
                if (withCallback) {
                    observable = Rx.Observable.create(function(observer) {
                        originalMethod.apply(this, args);
                    });
                } else {
                    let result = originalMethod.apply(this, args);
                    observable = Rx.Observable.of(result);
                }
            } else {
                execution = Configuration.execution === Configuration.ExecutionType.PREDICTION ?
                    (offload_pc_cost <= offload_cloud_cost ? Configuration.ExecutionType.PC_OFFLOADING : Configuration.ExecutionType.CLOUD_OFFLOADING)
                    : Configuration.execution;

                console.log("execution: " + Configuration.ExecutionType[execution]);
                const id = Date.now();
                let body = {
                    id: id,
                    code: strMethod,
                    args: args,
                    withCallback: withCallback
                };
                observable = Rx.Observable.create(function(observer) {
                    let localWebdisEndpoint = "http://" + Configuration.localEndpoint + ":7379";
                    let remoteWebdisEndpoint = "http://" + Configuration.remoteEndpoint + ":7379";
                    let url = execution === Configuration.ExecutionType.PC_OFFLOADING ? localWebdisEndpoint : remoteWebdisEndpoint;
                    offloadMethod(observer, url, JSON.stringify(body), id.toString());
                });
            }

            console.log("features: " + JSON.stringify(features));

            let subject = new Rx.ReplaySubject(1);
            subject.subscribe(
                function(x) {
                    console.log("Result: ", x);
                },
                function(e) { },
                function() {
                    let time = performance.now() - start;
                    console.log("time [ms]: ", time);
                    let executionTime = time < 500 ? -2 : (time < 1000 ? -1 :
                        (time < 5000 ? 0 : (time < 25000 ? 1 : 2)));

                    features[0] = execution;
                    let energyDrain = -2;
                    let batteryTotal = 0;
                    if (isCordovaApp) {
                        (window as MyWindow).stopPowerMeasurements(function(battery) {
                            console.log(JSON.stringify(battery));
                            batteryTotal = battery.total;
                            energyDrain = battery.total < 10 ? -2 :
                                (battery.total < 25 ? -1 :
                                    (battery.total < 50 ? 0 :
                                        (battery.total < 100 ? 1 : 2)));

                            Classifiers.getTimeClassifier().train(features, executionTime);
                            Classifiers.getEnergyClassifier().train(features, energyDrain);

                            reasearchData.push([Configuration.ClassifierType[Configuration.classifier], predict ? "PREDICT" : Configuration.ExecutionType[execution], time, batteryTotal]);
                            console.log(JSON.stringify(reasearchData));
                        });
                    } else {
                        // pc browser
                        console.log("learn: ", features, executionTime);

                        Classifiers.getTimeClassifier().train(features, executionTime);
                        Classifiers.getEnergyClassifier().train(features, energyDrain);

                        reasearchData.push([Configuration.ClassifierType[Configuration.classifier], predict ? "PREDICT" : Configuration.ExecutionType[execution], time, batteryTotal]);
                        console.log(JSON.stringify(reasearchData));
                    }
                }
            );
            observable.subscribe(subject);

            return subject;
        };

        return descriptor;
    };
}

function offloadMethod(observer: Rx.Observer<any>, webdisUrl: string, msgBody: string, id: string) {
    msgBody = msgBody.replace(/\\n/g, "").replace(/\//g, "%2f").replace(/\./g, "%2e");
    http("POST", webdisUrl + "/", "RPUSH/requests/" + encodeURIComponent(msgBody));
    let result = JSON.parse(http("GET", webdisUrl + "/BLPOP/" + id + "/300", null));
    console.debug("Parsed HTTP result: ", result);
    observer.next(result.BLPOP[1]);
    observer.complete();
}

function http(method: string, url: string, params: string) {
    let xmlHttp = new XMLHttpRequest();
    xmlHttp.open(method, url, false);
    xmlHttp.setRequestHeader("Content-type", "application/json");
    xmlHttp.send(params);
    return xmlHttp.responseText;
}
