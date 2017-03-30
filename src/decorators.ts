/// <reference path="./declarations.d.ts" />

import { Configuration } from "./configuration";
import { Classifiers } from "./classifiers/classifiers";
import * as Rx from "rxjs";

const LOCAL_WEBDIS_ENDPOINT = "http://localhost:7379";
const REMOTE_WEBDIS_ENDPOINT = "http://localhost:7379";

const W_T = 0.7;
const W_E = 0.3;

let isCordovaApp = !!(window as MyWindow).cordova;
let wifiEnabled = true;

function cost(mT: number, mE: number): number {
    return (W_T * mT) + (W_E * mE);
}

export function offloadable(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
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
        let features = [0, strMethod.length, args.length, jsonArgs.length,
            date.getHours(), wifiEnabled ? 1 : 0];

        console.log("code: ", strMethod.substring(0, 100));
        console.log("args: ", jsonArgs.substring(0, 100));
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

        console.log("features: " + JSON.stringify(features));

        let subject = new Rx.ReplaySubject(1);
        subject.subscribe(
            function(x) { },
            function(e) { },
            function() {
                let time = performance.now() - start;
                console.log("time [ms]: ", time);

                features[0] = execution;
                let energyDrain = -2;
                if (isCordovaApp) {
                    (window as MyWindow).stopPowerMeasurements(function(battery) {
                        console.log(JSON.stringify(battery));
                        energyDrain = battery.total < 10 ? -2 :
                            (battery.total < 25 ? -1 :
                                (battery.total < 50 ? 0 :
                                    (battery.total < 100 ? 1 : 2)));
                    });
                }

                let executionTime = time < 300 ? -2 : (time < 1000 ? -1 :
                    (time < 2000 ? 0 : (time < 5000 ? 1 : 2)));
                Classifiers.getTimeClassifier().train(features, executionTime);
                Classifiers.getEnergyClassifier().train(features, energyDrain);
            }
        );
        observable.subscribe(subject);

        return subject;
    };

    return descriptor;
}

function offloadMethod(observer: Rx.Observer<any>, webdisUrl: string, msgBody: string, id: string) {
    http("POST", webdisUrl + "/", "RPUSH/requests/" + msgBody);
    let result = JSON.parse(http("GET", webdisUrl + "/BLPOP/" + id + "/300", null)).BLPOP[1];
    console.debug("Parsed HTTP result: " + result);
    observer.next(result);
    observer.complete();
}

function http(method: string, url: string, params: string) {
    let xmlHttp = new XMLHttpRequest();
    xmlHttp.open(method, url, false);
    xmlHttp.setRequestHeader("Content-type", "application/json");
    xmlHttp.send(params);
    console.debug("HTTP result: ", xmlHttp.responseText);
    return xmlHttp.responseText;
}
